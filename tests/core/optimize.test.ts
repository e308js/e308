import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createGame, createGameKit, nativeNumbers } from "../../packages/core/src/index.js";
import { advanceOptimized } from "../../packages/core/src/optimize/index.js";
import { createChainFixture, generousLimits } from "../helpers/optimizer-fixture.js";

describe("validated affine advancement", () => {
  it("rejects a definition from a different game before advancing", () => {
    const left = constantFixture(0, 1);
    const right = constantFixture(0, 2);
    const game = left.create();

    expect(() =>
      advanceOptimized(game, right.definition, 1_000, { limits: generousLimits }),
    ).toThrow("identical ownership");
    expect(game.getSnapshot().gameTimeMs).toBe(0);
    expect(game.getDefinition()).toBe(left.definition);
  });

  it("matches the independent recurrence over property-generated safe integers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 100 }),
        (initial, rate, steps) => {
          const fixture = constantFixture(initial, rate);
          const canonical = fixture.create();
          const optimized = fixture.create();
          expect(canonical.advance(steps * 1_000).ok).toBe(true);
          const report = advanceOptimized(optimized, fixture.definition, steps * 1_000, {
            mode: "exact",
            limits: generousLimits,
          });
          expect(report.status).toBe("completed");
          expect(report.fidelity).toBe("validated-bulk");
          expect(report.snapshot).toEqual(canonical.getSnapshot());
        },
      ),
    );
  });

  it("matches delayed chain and product recurrences including production totals", () => {
    const fixture = createChainFixture({ initial: [2, 1, 0], baseRate: 3 });
    const canonical = fixture.create();
    const optimized = fixture.create();
    canonical.advance(20_000);
    const report = advanceOptimized(optimized, fixture.definition, 20_000, {
      limits: generousLimits,
    });
    expect(report).toMatchObject({
      status: "completed",
      fidelity: "validated-bulk",
      canonicalSteps: 0,
      bulkSteps: 20,
      workUsed: 1,
    });
    expectEquivalent(report.snapshot, canonical.getSnapshot());
  });

  it("stops before automation boundaries and rechecks after canonical mutations", () => {
    const fixture = createChainFixture({ automation: true });
    const canonical = fixture.create();
    const optimized = fixture.create();
    canonical.advance(12_000);
    const report = advanceOptimized(optimized, fixture.definition, 12_000, {
      limits: generousLimits,
    });
    expectEquivalent(report.snapshot, canonical.getSnapshot());
    expect(report.segments.map((segment) => [segment.kind, segment.steps])).toEqual([
      ["bulk", 4],
      ["canonical", 1],
      ["bulk", 4],
      ["canonical", 1],
      ["bulk", 2],
    ]);
  });

  it("handles leading remainder and a zero-step trailing remainder", () => {
    const fixture = constantFixture(0, 2);
    const canonical = fixture.create();
    const optimized = fixture.create();
    canonical.advance(500);
    optimized.advance(500);
    canonical.advance(2_750);
    const report = advanceOptimized(optimized, fixture.definition, 2_750, {
      limits: generousLimits,
    });
    expect(report.snapshot).toEqual(canonical.getSnapshot());
    expect(report.processedRealMs).toBe(2_750);
    expect(report.bulkSteps).toBe(3);
  });

  it("treats an allocated rate as a checked constant", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const workers = kit.resource("workers", { scope: run, initial: 3 });
    const points = kit.resource("points", { scope: run, initial: 0 });
    const jobs = kit.allocation("jobs", {
      scope: run,
      budget: workers,
      targets: ["farm"],
      initial: { farm: 2 },
    });
    const farm = kit.flow("farm", {
      scope: run,
      rate: kit.rates.allocated(jobs, "farm", 3),
      produces: [[points, 1]],
    });
    const definition = kit.defineGame({
      id: "allocated",
      simulationVersion: 1,
      stepMs: 1_000,
      resources: [workers, points],
      allocations: [jobs],
      flows: [farm],
    });
    const report = advanceOptimized(createGame(definition), definition, 4_000, {
      limits: generousLimits,
    });
    expect(report.snapshot.resources.points).toBe(24);
    expect(report.fidelity).toBe("validated-bulk");
  });
});

function expectEquivalent(
  actual: ReturnType<
    ReturnType<typeof createChainFixture>["create"]
  >["getSnapshot"] extends () => infer S
    ? S
    : never,
  expected: typeof actual,
): void {
  expect({ ...actual, revision: 0n }).toEqual({ ...expected, revision: 0n });
}

function constantFixture(initial: number, rate: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial });
  const income = kit.flow("income", {
    scope: run,
    rate: kit.rates.constant(rate),
    produces: [[points, 1]],
  });
  const definition = kit.defineGame({
    id: "constant",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [points],
    flows: [income],
  });
  return { definition, create: () => createGame(definition) };
}
