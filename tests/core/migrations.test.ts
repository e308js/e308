import { describe, expect, it } from "vitest";
import {
  beginCatchup,
  createGame,
  createGameKit,
  createSaveCodec,
  nativeNumbers,
  processCatchupChunk,
  type SaveEnvelope,
} from "../../packages/core/src/index.js";
import { envelopeChecksum } from "../../packages/core/src/persistence/checksum.js";

function versioned(version: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 1 });
  const definition = kit.defineGame({
    id: "versioned",
    simulationVersion: version,
    stepMs: 100,
    resources: [points],
  });
  return { definition, game: createGame(definition) };
}

const entitlement = {
  policyVersion: "1",
  enabled: true,
  capMs: 1_000,
  excess: "discard" as const,
};

describe("save and pending-session migrations", () => {
  it("requires an explicit pending-session rules transition", () => {
    const old = versioned(1);
    const oldCodec = createSaveCodec(old.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "old",
    });
    const base = oldCodec.decode(
      oldCodec.encode(old.game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    const pending = beginCatchup(old.definition, base, 1_000, "pending-update");
    const raw = oldCodec.encode(pending.snapshot, pending);
    const next = versioned(2);
    const configuration = { stateSchemaVersion: 1, contentVersion: "2", contentDigest: "new" };
    expect(() => createSaveCodec(next.definition, configuration).decode(raw)).toThrow(
      "incompatible with installed rules",
    );
    const codec = createSaveCodec(next.definition, configuration, {
      pendingTransitions: [
        {
          id: "rules-1-to-2",
          fromSimulationVersion: 1,
          toSimulationVersion: 2,
          transition: (source) => ({
            ...source,
            content: { ...source.content, version: "2", digest: "new" },
            simulation: { ...source.simulation, version: 2 },
          }),
        },
      ],
    });
    const loaded = codec.decode(raw);
    expect(loaded.catchup?.entitlement).toEqual(entitlement);
    expect(loaded.migrationLedger).toEqual(["rules-1-to-2"]);
    const rewritten = codec.encode(loaded.snapshot, loaded);
    expect(codec.decode(rewritten).migrationLedger).toEqual(["rules-1-to-2"]);
  });

  it("rejects missing, duplicate, and malformed schema migrations", () => {
    const fixture = versioned(1);
    const sourceCodec = createSaveCodec(fixture.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "one",
    });
    const raw = sourceCodec.encode(fixture.game.getSnapshot(), {
      wallAnchorMs: 0,
      entitlement,
      catchup: null,
    });
    const target = { stateSchemaVersion: 2, contentVersion: "2", contentDigest: "two" };
    expect(() => createSaveCodec(fixture.definition, target).decode(raw)).toThrow(
      "Missing migration",
    );
    const wrong = createSaveCodec(fixture.definition, target, {
      migrations: [
        {
          id: "wrong",
          fromVersion: 1,
          toVersion: 2,
          migrate: (source) => source,
        },
      ],
    });
    expect(() => wrong.decode(raw)).toThrow("wrong schema version");
    const duplicate = createSaveCodec(fixture.definition, target, {
      migrations: [
        {
          id: "already",
          fromVersion: 1,
          toVersion: 2,
          migrate: (source) => ({ ...source, stateSchemaVersion: 2 }),
        },
      ],
    });
    const inspected = sourceCodec.inspect(raw);
    const withLedger: SaveEnvelope = { ...inspected, migrationLedger: ["already"] };
    expect(() => duplicate.decode(resign(withLedger))).toThrow("already applied");
  });

  it("continues a partially processed absence across an explicit rules transition", () => {
    const old = versioned(1);
    const oldCodec = createSaveCodec(old.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "old",
    });
    const base = oldCodec.decode(
      oldCodec.encode(old.game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    const started = beginCatchup(old.definition, base, 1_000, "partial-update");
    const first = processCatchupChunk(
      old.definition,
      createGame(old.definition, { snapshot: started.snapshot }),
      started.catchup as NonNullable<typeof started.catchup>,
      4,
    );
    if (first.ok) throw new TypeError("Expected a pending first chunk");
    const pendingRaw = oldCodec.encode(first.error.snapshot, {
      ...started,
      catchup: first.error.session,
    });

    const next = versioned(2);
    const nextCodec = createSaveCodec(
      next.definition,
      { stateSchemaVersion: 1, contentVersion: "2", contentDigest: "new" },
      {
        pendingTransitions: [
          {
            id: "partial-rules-1-to-2",
            fromSimulationVersion: 1,
            toSimulationVersion: 2,
            transition: (source) => ({
              ...source,
              content: { ...source.content, version: "2", digest: "new" },
              simulation: { ...source.simulation, version: 2 },
            }),
          },
        ],
      },
    );
    const loaded = nextCodec.decode(pendingRaw);
    const second = processCatchupChunk(
      next.definition,
      createGame(next.definition, { snapshot: loaded.snapshot }),
      loaded.catchup as NonNullable<typeof loaded.catchup>,
      6,
    );
    if (!second.ok) throw new TypeError("Expected transitioned catch-up completion");
    expect(second.value.session.entitlement).toEqual(entitlement);
    expect(second.value.session.segments).toEqual([
      { simulationVersion: 1, processedRealMs: 400 },
      { simulationVersion: 2, processedRealMs: 600 },
    ]);
    expect(second.value.session.processedRealMs).toBe(1_000);
  });
});

function resign(envelope: SaveEnvelope): string {
  const { checksum: _, ...payload } = envelope;
  return JSON.stringify({ ...payload, checksum: envelopeChecksum(payload) });
}
