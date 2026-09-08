import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  beginCatchup,
  createGame,
  createGameKit,
  createSaveCodec,
  eternityNumbers,
  nativeNumbers,
  type SaveEnvelope,
} from "../../packages/core/src/index.js";
import { envelopeChecksum } from "../../packages/core/src/persistence/checksum.js";
import { persistenceFixture, populateFixture } from "../helpers/persistence-fixture.js";

function resign(envelope: SaveEnvelope): string {
  const { checksum: _, ...payload } = envelope;
  return JSON.stringify({ ...payload, checksum: envelopeChecksum(payload) });
}

describe("save codec", () => {
  it("round-trips all current state, RNG, clocks, and metadata", () => {
    const fixture = persistenceFixture();
    populateFixture(fixture);
    const codec = createSaveCodec(fixture.definition, fixture.configuration);
    const encoded = codec.encode(fixture.game.getSnapshot(), {
      wallAnchorMs: 1_000,
      entitlement: fixture.entitlement,
      catchup: null,
      migrationLedger: ["seed"],
      lastDeliveredEvent: "7",
    });
    const loaded = codec.decode(encoded);
    expect(loaded.snapshot).toEqual(fixture.game.getSnapshot());
    expect(loaded).toMatchObject({ wallAnchorMs: 1_000, catchup: null, lastDeliveredEvent: "7" });
    const restored = createGame(fixture.definition, { snapshot: loaded.snapshot });
    expect(restored.getSnapshot()).toEqual(fixture.game.getSnapshot());
    const nextOriginal = draw(fixture.game);
    const nextRestored = draw(restored);
    expect(nextRestored).toBe(nextOriginal);
  });

  it("rejects corrupt, oversized, future, mismatched, and unknown state", () => {
    const fixture = persistenceFixture();
    const codec = createSaveCodec(fixture.definition, fixture.configuration);
    const raw = codec.encode(fixture.game.getSnapshot(), {
      wallAnchorMs: 0,
      entitlement: fixture.entitlement,
      catchup: null,
    });
    expect(() => codec.decode("{")).toThrow("valid JSON");
    expect(() => codec.decode("[]")).toThrow("must be an object");
    expect(() => codec.decode(JSON.stringify({ format: "other", formatVersion: 1 }))).toThrow(
      "Unsupported save format",
    );
    expect(() => codec.decode(raw.replace("fixture-v1", "fixture-v2"))).toThrow("checksum");
    expect(() =>
      createSaveCodec(fixture.definition, { ...fixture.configuration, maximumBytes: 10 }).decode(
        raw,
      ),
    ).toThrow("size limit");

    const future = { ...codec.inspect(raw), stateSchemaVersion: 2 };
    expect(() => codec.decode(resign(future))).toThrow("future state schema");
    const numeric = {
      ...codec.inspect(raw),
      simulation: { ...codec.inspect(raw).simulation, numericAdapter: "other" },
    };
    expect(() => codec.decode(resign(numeric))).toThrow("numeric codec");
    const envelope = codec.inspect(raw);
    expect(() =>
      createSaveCodec(fixture.definition, {
        ...fixture.configuration,
        contentDigest: "another-build",
      }).decode(raw),
    ).toThrow("explicit migration");
    const run = required(envelope.state.scopes.run, "run scope");
    const unknown = {
      ...envelope,
      state: {
        ...envelope.state,
        scopes: {
          ...envelope.state.scopes,
          run: { ...run, resources: { ...run.resources, unknown: "1" } },
        },
      },
    };
    expect(() => codec.decode(resign(unknown))).toThrow("Unknown saved resource");
    expect(() => codec.decode(resign({ ...envelope, gameId: "other" }))).toThrow("another game");
    expect(() =>
      codec.decode(resign({ ...envelope, simulation: { ...envelope.simulation, stepMs: 50 } })),
    ).toThrow("quantum");
    expect(() =>
      codec.decode(resign({ ...envelope, clock: { ...envelope.clock, wallAnchorMs: -1 } })),
    ).toThrow("save clock");
    expect(() =>
      codec.decode(resign({ ...envelope, state: { ...envelope.state, won: "yes" as never } })),
    ).toThrow("win state");
    expect(() => codec.decode(resign({ ...envelope, lastDeliveredEvent: "01" }))).toThrow(
      "delivery cursor",
    );
    expect(() =>
      codec.decode(resign({ ...envelope, rng: { ...envelope.rng, algorithm: "other" as never } })),
    ).toThrow("random state");
    expect(() => codec.decode(resign({ ...envelope, migrationLedger: [1 as never] }))).toThrow(
      "migration ledger",
    );
  });

  it("validates configuration, metadata, and pending-session accounting", () => {
    const fixture = persistenceFixture();
    expect(() =>
      createSaveCodec(fixture.definition, {
        stateSchemaVersion: 0,
        contentVersion: "1",
        contentDigest: "x",
      }),
    ).toThrow("schema version");
    expect(() =>
      createSaveCodec(fixture.definition, {
        stateSchemaVersion: 1,
        contentVersion: "",
        contentDigest: "",
      }),
    ).toThrow("Content version");
    expect(() =>
      createSaveCodec(fixture.definition, { ...fixture.configuration, maximumBytes: 0 }),
    ).toThrow("size limit");
    const codec = createSaveCodec(fixture.definition, fixture.configuration);
    expect(() =>
      codec.encode(fixture.game.getSnapshot(), {
        wallAnchorMs: -1,
        entitlement: fixture.entitlement,
        catchup: null,
      }),
    ).toThrow("Wall anchor");
    expect(() =>
      codec.encode(fixture.game.getSnapshot(), {
        wallAnchorMs: 0,
        entitlement: { ...fixture.entitlement, capMs: -1 },
        catchup: null,
      }),
    ).toThrow("Offline cap");

    const base = codec.decode(
      codec.encode(fixture.game.getSnapshot(), {
        wallAnchorMs: 0,
        entitlement: { ...fixture.entitlement, capMs: 1_000 },
        catchup: null,
      }),
    );
    const started = beginCatchup(fixture.definition, base, 1_000, "validation");
    const withSession = codec.inspect(codec.encode(started.snapshot, started));
    const session = required(withSession.catchup, "catch-up session");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: { ...session, pendingRealMs: session.pendingRealMs - 1 },
        }),
      ),
    ).toThrow("accounting invariant");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: { ...session, startWallMs: 100, endWallMs: 99 },
        }),
      ),
    ).toThrow("wall interval");
    expect(() =>
      codec.decode(resign({ ...withSession, catchup: { ...session, bankedRealMs: -1 } })),
    ).toThrow("catch-up duration");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: { ...session, deliveryCursor: "01" },
        }),
      ),
    ).toThrow("catch-up identity");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: {
            ...session,
            entitlement: { ...session.entitlement, excess: "lost" as never },
          },
        }),
      ),
    ).toThrow("offline entitlement");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: {
            ...session,
            segments: [{ simulationVersion: 0, processedRealMs: 0 }],
          },
        }),
      ),
    ).toThrow("catch-up segment");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: {
            ...session,
            report: { ...session.report, processedRealMs: 1 },
          },
        }),
      ),
    ).toThrow("report does not match");
    const resource = required(session.report.resources[0], "resource report");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: {
            ...session,
            report: { ...session.report, resources: [resource, resource] },
          },
        }),
      ),
    ).toThrow("resource report");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          catchup: {
            ...session,
            report: {
              ...session.report,
              progression: [{ eventId: "", kind: "other" as never, id: "x", atGameMs: 0 }],
            },
          },
        }),
      ),
    ).toThrow("progression report");
    expect(() =>
      codec.decode(
        resign({
          ...withSession,
          state: {
            ...withSession.state,
            progressionEvents: [{ sequence: "0", kind: "win", id: "game", atGameMs: 0 }],
          },
        }),
      ),
    ).toThrow("event ledger");
  });

  it("loads the committed non-null interrupted-session fixture", async () => {
    const schema = JSON.parse(
      await readFile("packages/core/schema/save-v1.schema.json", "utf8"),
    ) as { title?: string };
    expect(schema.title).toBe("e308 save envelope v1");
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 10 });
    const income = kit.flow("income", {
      scope: run,
      rate: kit.rates.constant(2),
      produces: [[points, 1]],
    });
    const started = kit.milestone("started", {
      scope: run,
      when: (state) => state.get(points) >= 10,
    });
    const definition = kit.defineGame({
      id: "save-example",
      simulationVersion: 1,
      rootSeed: "0123456789abcdef",
      stepMs: 100,
      resources: [points],
      flows: [income],
      triggers: [started],
    });
    const codec = createSaveCodec(definition, {
      stateSchemaVersion: 1,
      contentVersion: "1.0.0",
      contentDigest: "save-example-v1",
    });
    const raw = await readFile("tests/fixtures/saves/pending-v1.json", "utf8");
    const loaded = codec.decode(raw);
    expect(loaded.catchup).toMatchObject({
      sessionId: "fixture-pending-v1",
      processedRealMs: 400,
      pendingRealMs: 600,
    });
    expect(loaded.snapshot.progression.events).toEqual([
      { sequence: 1n, kind: "milestone", id: "started", atGameMs: 100 },
    ]);
  });

  it("runs sequential rename migrations once and preserves their ledger", () => {
    const oldKit = createGameKit({ numbers: nativeNumbers });
    const oldScope = oldKit.scope("run");
    const oldPoints = oldKit.resource("old-points", { scope: oldScope, initial: 5 });
    const oldDefinition = oldKit.defineGame({
      id: "migration-test",
      simulationVersion: 1,
      stepMs: 100,
      resources: [oldPoints],
    });
    const oldGame = createGame(oldDefinition);
    const oldCodec = createSaveCodec(oldDefinition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "old",
    });
    const entitlement = {
      policyVersion: "1",
      enabled: true,
      capMs: null,
      excess: "discard" as const,
    };
    const raw = oldCodec.encode(oldGame.getSnapshot(), {
      wallAnchorMs: 0,
      entitlement,
      catchup: null,
    });

    const nextKit = createGameKit({ numbers: nativeNumbers });
    const nextScope = nextKit.scope("run");
    const points = nextKit.resource("points", { scope: nextScope, initial: 0 });
    const definition = nextKit.defineGame({
      id: "migration-test",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points],
    });
    const codec = createSaveCodec(
      definition,
      { stateSchemaVersion: 2, contentVersion: "2", contentDigest: "new" },
      {
        migrations: [
          {
            id: "rename-points",
            fromVersion: 1,
            toVersion: 2,
            migrate: (source) => {
              const run = required(source.state.scopes.run, "run scope");
              const { "old-points": value, ...rest } = run.resources;
              const { "old-points": produced, ...otherTotals } = source.state.productionTotals;
              return {
                ...source,
                stateSchemaVersion: 2,
                content: { ...source.content, version: "2", digest: "new" },
                state: {
                  ...source.state,
                  productionTotals: { ...otherTotals, points: produced as string },
                  scopes: {
                    ...source.state.scopes,
                    run: { ...run, resources: { ...rest, points: value as string } },
                  },
                },
              };
            },
          },
        ],
      },
    );
    const loaded = codec.decode(raw);
    expect(loaded.snapshot.resources.points).toBe(5);
    expect(loaded.migrationLedger).toEqual(["rename-points"]);
  });

  it("AD06 round-trips a quantity beyond native finite range", () => {
    const kit = createGameKit({ numbers: eternityNumbers });
    const run = kit.scope("run");
    const antimatter = kit.resource("antimatter", { scope: run, initial: kit.q("1e1000") });
    const definition = kit.defineGame({
      id: "ad-save",
      simulationVersion: 1,
      stepMs: 100,
      resources: [antimatter],
    });
    const game = createGame(definition);
    const codec = createSaveCodec(definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "ad06",
    });
    const entitlement = {
      policyVersion: "1",
      enabled: true,
      capMs: null,
      excess: "discard" as const,
    };
    const loaded = codec.decode(
      codec.encode(game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    expect(
      eternityNumbers.codec.serialize(required(loaded.snapshot.resources.antimatter, "antimatter")),
    ).toBe("1e1000");
  });
});

function draw(game: ReturnType<typeof persistenceFixture>["game"]): number {
  let value = -1;
  game.dispatch({
    id: "draw-next",
    execute: (transaction) => {
      value = transaction.random(["events"]).nextUint32();
    },
  });
  return value;
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) throw new TypeError(`Missing ${label}`);
  return value;
}
