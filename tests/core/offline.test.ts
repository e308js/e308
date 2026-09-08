import { describe, expect, it } from "vitest";
import {
  acknowledgeCatchup,
  beginCatchup,
  cancelCatchup,
  createGame,
  createGameKit,
  createSaveCodec,
  discardPendingTime,
  nativeNumbers,
  processCatchupChunk,
  resolveEntitlement,
} from "../../packages/core/src/index.js";
import { persistenceFixture } from "../helpers/persistence-fixture.js";

describe("offline policy and sessions", () => {
  it("resolves disabled, fixed, dynamic, unlimited, discard, and bank policies", () => {
    const fixture = persistenceFixture();
    const snapshot = fixture.game.getSnapshot();
    expect(
      resolveEntitlement(
        { policyVersion: "off", enabled: false, cap: { kind: "unlimited" }, excess: "discard" },
        snapshot,
      ),
    ).toMatchObject({ enabled: false, capMs: null });
    expect(
      resolveEntitlement(
        {
          policyVersion: "fixed",
          enabled: true,
          cap: { kind: "duration", milliseconds: 500 },
          excess: "discard",
        },
        snapshot,
      ),
    ).toMatchObject({ enabled: true, capMs: 500 });
    expect(
      resolveEntitlement(
        {
          policyVersion: "dynamic",
          enabled: () => true,
          cap: { kind: "dynamic", resolve: (state) => state.resources.points as number },
          excess: "bank",
        },
        snapshot,
      ),
    ).toMatchObject({ capMs: 10, excess: "bank" });
    expect(() =>
      resolveEntitlement(
        {
          policyVersion: "bad",
          enabled: true,
          cap: { kind: "duration", milliseconds: -1 },
          excess: "discard",
        },
        snapshot,
      ),
    ).toThrow("Offline cap");
  });

  it("applies a 30-hour absence and eight-hour cap once across resumes", () => {
    const fixture = persistenceFixture();
    const checkpoint = loadCheckpoint(fixture, 0, fixture.entitlement);
    const thirtyHours = 30 * 60 * 60 * 1000;
    const started = beginCatchup(fixture.definition, checkpoint, thirtyHours, "absence-1");
    expect(started.wallAnchorMs).toBe(thirtyHours);
    expect(started.catchup).toMatchObject({
      eligibleRealMs: 8 * 60 * 60 * 1000,
      pendingRealMs: 8 * 60 * 60 * 1000,
      discardedRealMs: 22 * 60 * 60 * 1000,
      bankedRealMs: 0,
    });
    const resumed = beginCatchup(fixture.definition, started, thirtyHours + 10_000, "new-id");
    expect(resumed.catchup).toBe(started.catchup);
    expect(resumed.wallAnchorMs).toBe(thirtyHours);
  });

  it("records future-clock anomalies without moving the anchor", () => {
    const fixture = persistenceFixture();
    const checkpoint = loadCheckpoint(fixture, 1_000, fixture.entitlement);
    const result = beginCatchup(fixture.definition, checkpoint, 900, "clock-change");
    expect(result.clockAnomaly).toEqual({ anchorMs: 1_000, observedMs: 900 });
    expect(result.wallAnchorMs).toBe(1_000);
    expect(result.catchup).toBeNull();
    expect(() => beginCatchup(fixture.definition, checkpoint, -1, "bad")).toThrow("Return time");
    expect(() => beginCatchup(fixture.definition, checkpoint, 1_000, "")).toThrow("session ID");
  });

  it("accounts for unlimited, disabled, and banked excess independently", () => {
    const fixture = persistenceFixture();
    const unlimited = loadCheckpoint(fixture, 0, { ...fixture.entitlement, capMs: null });
    expect(beginCatchup(fixture.definition, unlimited, 1_000, "unlimited").catchup).toMatchObject({
      eligibleRealMs: 1_000,
      discardedRealMs: 0,
    });
    const disabled = loadCheckpoint(fixture, 0, {
      ...fixture.entitlement,
      enabled: false,
      capMs: null,
      excess: "bank",
    });
    expect(beginCatchup(fixture.definition, disabled, 1_000, "disabled").catchup).toMatchObject({
      eligibleRealMs: 0,
      discardedRealMs: 1_000,
      bankedRealMs: 0,
    });
    const banked = loadCheckpoint(fixture, 0, {
      ...fixture.entitlement,
      capMs: 400,
      excess: "bank",
    });
    expect(beginCatchup(fixture.definition, banked, 1_000, "banked").catchup).toMatchObject({
      eligibleRealMs: 400,
      discardedRealMs: 0,
      bankedRealMs: 600,
    });
  });

  it("commits bounded canonical chunks and preserves pending work", () => {
    const fixture = persistenceFixture();
    const entitlement = { ...fixture.entitlement, capMs: 1_000 };
    const checkpoint = loadCheckpoint(fixture, 0, entitlement);
    const started = beginCatchup(fixture.definition, checkpoint, 1_000, "chunked");
    const firstGame = createGame(fixture.definition, { snapshot: started.snapshot });
    const first = processCatchupChunk(
      fixture.definition,
      firstGame,
      requiredSession(started.catchup),
      5,
    );
    expect(first).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
    if (first.ok) throw new TypeError("Expected a bounded pending result");
    expect(first.error.session).toMatchObject({ processedRealMs: 500, pendingRealMs: 500 });
    expect(first.error.snapshot.resources.points).toBeCloseTo(11, 12);

    const secondGame = createGame(fixture.definition, { snapshot: first.error.snapshot });
    const second = processCatchupChunk(fixture.definition, secondGame, first.error.session, 5);
    if (!second.ok) throw new TypeError("Expected catch-up completion");
    expect(second.value.complete).toBe(true);
    expect(second.value.snapshot.resources.points).toBeCloseTo(12, 12);
    expect(second.value.session.report).toMatchObject({
      processedRealMs: 1_000,
      pendingRealMs: 0,
      advancedGameMs: 1_000,
    });
    const points = second.value.session.report.resources.find((item) => item.id === "points");
    expect(Number(points?.after)).toBeCloseTo(12, 12);
    expect(Number(points?.produced)).toBeCloseTo(2, 12);
    expect(second.value.session.report.progression).toEqual([
      {
        eventId: "chunked:1",
        kind: "milestone",
        id: "started",
        atGameMs: 100,
      },
    ]);
  });

  it("distinguishes pausing from explicitly discarding pending time", () => {
    const fixture = persistenceFixture();
    const checkpoint = loadCheckpoint(fixture, 0, { ...fixture.entitlement, capMs: 1_000 });
    const started = beginCatchup(fixture.definition, checkpoint, 1_000, "cancel");
    const paused = cancelCatchup(requiredSession(started.catchup));
    expect(paused).toMatchObject({ pendingRealMs: 1_000, report: { stopReason: "cancelled" } });
    const discarded = discardPendingTime(paused);
    expect(discarded).toMatchObject({
      eligibleRealMs: 0,
      pendingRealMs: 0,
      discardedRealMs: 1_000,
    });
    const complete = processCatchupChunk(fixture.definition, fixture.game, discarded, 1);
    expect(complete).toMatchObject({ ok: true, value: { complete: true } });
    expect(() => processCatchupChunk(fixture.definition, fixture.game, paused, 0)).toThrow(
      "work budget",
    );
    expect(() => acknowledgeCatchup({ ...started, catchup: paused })).toThrow("remains pending");
    const acknowledged = acknowledgeCatchup({
      ...started,
      snapshot: complete.ok ? complete.value.snapshot : complete.error.snapshot,
      catchup: discarded,
    });
    expect(acknowledged.catchup).toBeNull();
    expect(acknowledgeCatchup(acknowledged)).toBe(acknowledged);
  });

  it("pauses with the original snapshot when simulation rejects a chunk", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const failure = kit.steppedRule("failure", {
      scope: run,
      update: () => {
        throw new TypeError("fixture failure");
      },
    });
    const definition = kit.defineGame({
      id: "offline-failure",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points],
      steppedRules: [failure],
    });
    const game = createGame(definition);
    const codec = createSaveCodec(definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "failure",
    });
    const entitlement = {
      policyVersion: "1",
      enabled: true,
      capMs: null,
      excess: "discard" as const,
    };
    const checkpoint = codec.decode(
      codec.encode(game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    const started = beginCatchup(definition, checkpoint, 100, "failure");
    const result = processCatchupChunk(definition, game, requiredSession(started.catchup), 1);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "simulation-failed", session: { report: { stopReason: "error" } } },
    });
    expect(game.getSnapshot().resources.points).toBe(0);
  });

  it("runs game-authored custom rewards inside the same catch-up accounting", () => {
    const fixture = persistenceFixture();
    const checkpoint = loadCheckpoint(fixture, 0, { ...fixture.entitlement, capMs: 500 });
    const started = beginCatchup(fixture.definition, checkpoint, 500, "custom");
    const result = processCatchupChunk(
      fixture.definition,
      createGame(fixture.definition, { snapshot: started.snapshot }),
      requiredSession(started.catchup),
      5,
      {
        kind: "custom-reward",
        apply: (transaction, advancedGameMs) => {
          transaction.add(fixture.points, advancedGameMs / 10);
          transaction.setProgress("milestone", fixture.milestone.id);
        },
      },
    );
    if (!result.ok) throw new TypeError("Expected custom catch-up completion");
    expect(result.value.snapshot.resources.points).toBe(60);
    expect(result.value.session.report.fidelity).toBe("custom-reward");
    expect(result.value.session.report.progression).toEqual([
      {
        eventId: "custom:1",
        kind: "milestone",
        id: "started",
        atGameMs: 500,
      },
    ]);
    const resumed = { ...result.value.session, pendingRealMs: 100, eligibleRealMs: 600 };
    expect(() =>
      processCatchupChunk(fixture.definition, fixture.game, resumed, 1, { kind: "canonical" }),
    ).toThrow("cannot change");
  });
});

function loadCheckpoint(
  fixture: ReturnType<typeof persistenceFixture>,
  wallAnchorMs: number,
  entitlement: ReturnType<typeof persistenceFixture>["entitlement"],
) {
  const codec = createSaveCodec(fixture.definition, fixture.configuration);
  return codec.decode(
    codec.encode(fixture.game.getSnapshot(), { wallAnchorMs, entitlement, catchup: null }),
  );
}

function requiredSession<T>(value: T | null): T {
  if (!value) throw new TypeError("Missing catch-up session");
  return value;
}
