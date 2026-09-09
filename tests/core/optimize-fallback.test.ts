import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  eternityNumbers,
  nativeNumbers,
} from "../../packages/core/src/index.js";
import { advanceOptimized } from "../../packages/core/src/optimize/index.js";
import { generousLimits } from "../helpers/optimizer-fixture.js";

describe("optimizer fallback rules", () => {
  it.each([
    ["capacity", { capacity: true }],
    ["custom-rate", { customRate: true }],
    ["fractional-step", { fractionalStep: true }],
    ["flow-inputs", { consumes: true }],
    ["stepped-rule", { stepped: true }],
    ["calendar", { calendar: true }],
    ["task", { task: true }],
    ["trigger", { trigger: true }],
    ["scope activation", { activation: true }],
    ["win callback", { win: true }],
    ["nonlinear rate", { nonlinear: true }],
  ])("falls back canonically for %s", (_name, feature) => {
    const fixture = fallbackFixture(feature);
    const canonical = createGame(fixture.definition);
    const optimized = createGame(fixture.definition);
    canonical.advance(fixture.elapsed);
    const report = advanceOptimized(optimized, fixture.definition, fixture.elapsed, {
      limits: generousLimits,
    });
    expect(report.fidelity).toBe("canonical");
    expect({ ...report.snapshot, revision: 0n }).toEqual({
      ...canonical.getSnapshot(),
      revision: 0n,
    });
    expect(report.diagnostics[0]).toMatch(/^e308\/native-affine:/);
  });

  it("falls back without changing random draw order", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const random = kit.steppedRule("random", {
      scope: run,
      update: (transaction) => transaction.add(points, transaction.random(["roll"]).bounded(10)),
    });
    const definition = kit.defineGame({
      id: "random-fallback",
      simulationVersion: 1,
      stepMs: 1_000,
      resources: [points],
      steppedRules: [random],
    });
    const canonical = createGame(definition);
    const optimized = createGame(definition);
    canonical.advance(10_000);
    const report = advanceOptimized(optimized, definition, 10_000, {
      limits: generousLimits,
    });
    expect({ ...report.snapshot, revision: 0n }).toEqual({
      ...canonical.getSnapshot(),
      revision: 0n,
    });
  });

  it("does not classify non-native arithmetic as exact bulk", () => {
    const kit = createGameKit({ numbers: eternityNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: kit.q("1e100") });
    const flow = kit.flow("flow", {
      scope: run,
      rate: kit.rates.constant(kit.q("1e90")),
      produces: [[points, kit.q(1)]],
    });
    const definition = kit.defineGame({
      id: "eternity-fallback",
      simulationVersion: 1,
      stepMs: 1_000,
      resources: [points],
      flows: [flow],
    });
    const report = advanceOptimized(createGame(definition), definition, 2_000, {
      limits: generousLimits,
    });
    expect(report.fidelity).toBe("canonical");
    expect(report.diagnostics).toContain("e308/native-affine:numeric-adapter");
  });

  it("falls back when checked integer recurrence arithmetic overflows", () => {
    const fixture = fallbackFixture({ unsafeArithmetic: true });
    const report = advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
      limits: generousLimits,
    });
    expect(report.fidelity).toBe("canonical");
    expect(report.diagnostics).toContain("e308/native-affine:unsafe-integer-arithmetic");
  });
});

function fallbackFixture(features: Readonly<Record<string, boolean>>) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const input = kit.resource("input", { scope: run, initial: 10 });
  const points = kit.resource("points", {
    scope: run,
    initial: features.unsafeArithmetic ? Number.MAX_SAFE_INTEGER : 0,
    ...(features.capacity ? { capacity: 100 } : {}),
  });
  const rate = features.customRate
    ? kit.rates.custom(() => 1)
    : features.nonlinear
      ? kit.rates.product(kit.rates.proportional(input, 1), kit.rates.proportional(points, 1))
      : kit.rates.constant(1);
  const flow = kit.flow("flow", {
    scope: run,
    rate,
    ...(features.consumes ? { consumes: [[input, 1] as const] } : {}),
    produces: [[points, 1]],
  });
  const stepped = features.stepped
    ? [
        kit.steppedRule("custom", {
          scope: run,
          update: (transaction) => transaction.add(points, 1),
        }),
      ]
    : [];
  const calendars = features.calendar
    ? [
        kit.calendar("season", {
          scope: run,
          phases: [{ id: "one", durationMs: 1_000 }],
        }),
      ]
    : [];
  const tasks = features.task
    ? [
        kit.task("job", {
          scope: run,
          inputs: [],
          outputs: [[points, 1]],
          work: { kind: "fixed-duration", durationMs: 1_000 },
          delivery: "block",
          cancellation: { refund: "none" },
          queueLimit: 1,
        }),
      ]
    : [];
  const triggers = features.trigger
    ? [kit.milestone("first", { scope: run, when: (state) => state.get(points) >= 1 })]
    : [];
  const activations = features.activation
    ? [kit.scopeActivation("active", { scope: run, active: () => true })]
    : [];
  const stepMs = features.fractionalStep ? 100 : 1_000;
  const definition = kit.defineGame({
    id: "fallback",
    simulationVersion: 1,
    stepMs,
    resources: [input, points],
    flows: [flow],
    steppedRules: stepped,
    calendars,
    tasks,
    triggers,
    scopeActivations: activations,
    ...(features.win ? { win: (state) => state.get(points) >= 2 } : {}),
  });
  return { definition, elapsed: stepMs * 3 };
}
