import { describe, expect, it } from "vitest";
import { createGame, createGameKit, nativeNumbers } from "../../packages/core/src/index.js";
import {
  AdvanceBacklog,
  advanceOptimized,
  type BulkCapability,
  eventBoundedCapability,
  profileAdvancement,
} from "../../packages/core/src/optimize/index.js";
import { generousLimits } from "../helpers/optimizer-fixture.js";

describe("registered bulk capabilities", () => {
  it("requires explicit approximate mode and reports the declared error", () => {
    const fixture = customFixture();
    const approximate: BulkCapability<number> = {
      id: "fixture/approximate",
      version: "1",
      fidelity: "approximate",
      dependencies: ["points"],
      approximation: {
        methodId: "single-euler-step",
        maximumAbsoluteError: 5,
        maximumRelativeError: 0.1,
        appliesTo: "points",
      },
      plan: ({ requestedSteps }) => ({
        eligible: true,
        steps: requestedSteps,
        apply: (transaction) => transaction.add(fixture.points, requestedSteps + 5),
      }),
    };
    const exact = advanceOptimized(createGame(fixture.definition), fixture.definition, 3_000, {
      mode: "exact",
      limits: generousLimits,
      capabilities: [approximate],
    });
    expect(exact.fidelity).toBe("canonical");
    expect(exact.snapshot.resources.points).toBe(3);
    const report = advanceOptimized(createGame(fixture.definition), fixture.definition, 3_000, {
      mode: "approximate",
      limits: generousLimits,
      capabilities: [approximate],
    });
    expect(report.fidelity).toBe("approximate");
    expect(report.snapshot.resources.points).toBe(8);
    expect(report.segments[0]?.approximation?.methodId).toBe("single-euler-step");
  });

  it("bounds an exact custom recurrence strictly before authored events", () => {
    const fixture = customFixture();
    const exact: BulkCapability<number> = {
      id: "fixture/exact",
      version: "1",
      fidelity: "validated-bulk",
      dependencies: ["points"],
      plan: ({ requestedSteps }) => ({
        eligible: true,
        steps: requestedSteps,
        apply: (transaction) => transaction.add(fixture.points, requestedSteps),
      }),
    };
    const bounded = eventBoundedCapability(
      exact,
      ({ snapshot }) => (Math.floor(snapshot.gameTimeMs / 3_000) + 1) * 3_000,
    );
    const canonical = createGame(fixture.definition);
    canonical.advance(7_000);
    const report = advanceOptimized(createGame(fixture.definition), fixture.definition, 7_000, {
      limits: generousLimits,
      capabilities: [bounded],
    });
    expect({ ...report.snapshot, revision: 0n }).toEqual({
      ...canonical.getSnapshot(),
      revision: 0n,
    });
    expect(report.segments.map((segment) => [segment.kind, segment.steps])).toEqual([
      ["bulk", 2],
      ["canonical", 1],
      ["bulk", 2],
      ["canonical", 1],
      ["bulk", 1],
    ]);
  });

  it("falls back from invalid and throwing planners and preserves rejected work", () => {
    const fixture = customFixture();
    const invalid = capability("invalid", ({ requestedSteps }) => ({
      eligible: true,
      steps: requestedSteps + 1,
      apply: () => undefined,
    }));
    const throwing = capability("throwing", () => {
      throw new Error("planner fault");
    });
    const fallback = advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
      limits: generousLimits,
      capabilities: [invalid, throwing],
    });
    expect(fallback.status).toBe("completed");
    expect(fallback.diagnostics).toContain("invalid:invalid-step-count");
    expect(fallback.diagnostics).toContain("throwing:planner-threw:planner fault");

    const rejected = capability("rejected", ({ requestedSteps }) => ({
      eligible: true,
      steps: requestedSteps,
      apply: (transaction) => transaction.reject({ code: "invalid-target", id: "bulk" }),
    }));
    const failed = advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
      limits: generousLimits,
      capabilities: [rejected],
    });
    expect(failed).toMatchObject({
      status: "failed",
      error: "invalid-target",
      processedRealMs: 0,
      pendingRealMs: 1_000,
    });
  });

  it("rejects ambiguous capability identities and invalid fidelity declarations", () => {
    const fixture = customFixture();
    const duplicate = capability("same", () => ({ eligible: false, reason: "no" }));
    expect(() =>
      advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
        limits: generousLimits,
        capabilities: [duplicate, duplicate],
      }),
    ).toThrow("Duplicate bulk capability");
    expect(() =>
      advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
        limits: generousLimits,
        capabilities: [{ ...duplicate, id: "approx", fidelity: "approximate" }],
      }),
    ).toThrow("requires an error declaration");
  });
});

describe("backlogs and profiling", () => {
  it("retains pending work and refuses additions beyond its bound", () => {
    const fixture = customFixture();
    const game = createGame(fixture.definition);
    const backlog = new AdvanceBacklog(game, fixture.definition, 6_000, 5_000);
    expect(backlog.add(2_000)).toEqual({ ok: false, reason: "backlog-overflow" });
    expect(backlog.pendingMs).toBe(5_000);
    const partial = backlog.process({
      mode: "canonical",
      limits: { maximumWork: 2, maximumBulkBatches: 1 },
    });
    expect(partial).toMatchObject({ status: "pending", backlogMs: 3_000 });
    expect(backlog.add(1_000)).toEqual({ ok: true });
    const complete = backlog.process({ mode: "canonical", limits: generousLimits });
    expect(complete).toMatchObject({ status: "completed", backlogMs: 0 });
    expect(game.getSnapshot().gameTimeMs).toBe(6_000);
  });

  it("profiles with an injected monotonic clock", () => {
    const fixture = customFixture();
    const times = [0, 2, 2, 5];
    const profile = profileAdvancement({
      fixtureId: "custom",
      fixtureVersion: "1",
      label: "warm",
      repetitions: 2,
      elapsedMs: 2_000,
      definition: fixture.definition,
      createGame: () => createGame(fixture.definition),
      advancement: { limits: generousLimits },
      now: () => times.shift() ?? 5,
    });
    expect(profile.elapsed).toEqual({ medianMs: 2, p95Ms: 3, maximumMs: 3 });
    expect(profile).toMatchObject({ bulkSteps: 0, canonicalSteps: 2, pendingMs: 0 });
    expect(profile.throughputGameMsPerWallMs).toBe(800);
  });

  it("validates profiling inputs and clock samples", () => {
    const fixture = customFixture();
    const base = {
      fixtureId: "custom",
      fixtureVersion: "1",
      label: "cold" as const,
      repetitions: 1,
      elapsedMs: 0,
      definition: fixture.definition,
      createGame: () => createGame(fixture.definition),
      advancement: { limits: generousLimits },
      now: () => 1,
    };
    expect(profileAdvancement(base).throughputGameMsPerWallMs).toBeNull();
    expect(() => profileAdvancement({ ...base, repetitions: 0 })).toThrow("repetitions");
    expect(() => profileAdvancement({ ...base, elapsedMs: -1 })).toThrow("elapsed time");
    const reversed = [2, 1];
    expect(() => profileAdvancement({ ...base, now: () => reversed.shift() ?? 0 })).toThrow(
      "monotonic",
    );
    expect(() => profileAdvancement({ ...base, now: () => Number.NaN })).toThrow("monotonic");
  });
});

function customFixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const rule = kit.steppedRule("increment", {
    scope: run,
    update: (transaction) => transaction.add(points, 1),
  });
  const definition = kit.defineGame({
    id: "custom-bulk",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [points],
    steppedRules: [rule],
  });
  return { definition, points };
}

function capability(id: string, plan: BulkCapability<number>["plan"]): BulkCapability<number> {
  return { id, version: "1", fidelity: "validated-bulk", dependencies: [], plan };
}
