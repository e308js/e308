import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  evaluateRate,
  nativeNumbers,
  type Resource,
} from "../../packages/core/src/index.js";

function economy(options: { input?: number; output?: number; capacity?: number } = {}) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const input = kit.resource("input", { scope: run, initial: options.input ?? 0 });
  const output = kit.resource("output", {
    scope: run,
    initial: options.output ?? 0,
    ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
  });
  return { kit, run, input, output };
}

function value(resources: Readonly<Record<string, number>>, resource: Resource<number>): number {
  return resources[resource.id] ?? Number.NaN;
}

describe("flows", () => {
  it("produces at a typed constant rate", () => {
    const { kit, run, output } = economy();
    const flow = kit.flow("make", {
      scope: run,
      rate: kit.rates.constant(kit.q(2)),
      produces: [[output, kit.q(3)]],
    });
    const game = createGame(
      kit.defineGame({
        id: "flow",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [output],
        flows: [flow],
      }),
    );
    expect(game.advance(2000).ok).toBe(true);
    expect(value(game.getSnapshot().resources, output)).toBe(12);
    expect(game.getSnapshot().productionTotals.output).toBe(12);
  });

  it("reserves shared inputs by explicit priority and ID", () => {
    const { kit, run, input, output } = economy({ input: 5 });
    const other = kit.resource("other", { scope: run, initial: 0 });
    const later = kit.flow("z-later", {
      scope: run,
      priority: 1,
      rate: kit.rates.constant(10),
      consumes: [[input, 1]],
      produces: [[other, 1]],
    });
    const first = kit.flow("a-first", {
      scope: run,
      priority: 0,
      rate: kit.rates.constant(3),
      consumes: [[input, 1]],
      produces: [[output, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: "priority",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [input, output, other],
        flows: [later, first],
      }),
    );
    game.advance(1000);
    expect(game.getSnapshot().resources).toMatchObject({ input: 0, output: 3, other: 2 });
  });

  it("does not feed outputs into downstream inputs until the next step", () => {
    const { kit, run, input, output } = economy({ input: 2 });
    const final = kit.resource("final", { scope: run, initial: 0 });
    const upstream = kit.flow("upstream", {
      scope: run,
      rate: kit.rates.constant(1),
      consumes: [[input, 1]],
      produces: [[output, 1]],
    });
    const downstream = kit.flow("downstream", {
      scope: run,
      rate: kit.rates.constant(1),
      consumes: [[output, 1]],
      produces: [[final, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: "chain",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [input, output, final],
        flows: [downstream, upstream],
      }),
    );
    game.advance(1000);
    expect(game.getSnapshot().resources).toMatchObject({ input: 1, output: 1, final: 0 });
    game.advance(1000);
    expect(game.getSnapshot().resources).toMatchObject({ input: 0, output: 1, final: 1 });
  });

  it("distinguishes throttle from all-or-nothing input blocking", () => {
    const throttled = economy({ input: 4 });
    const throttle = throttled.kit.flow("throttle", {
      scope: throttled.run,
      rate: throttled.kit.rates.constant(5),
      consumes: [
        [throttled.input, 1],
        [throttled.input, 1],
      ],
      produces: [[throttled.output, 1]],
    });
    const throttleGame = createGame(
      throttled.kit.defineGame({
        id: "throttle",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [throttled.input, throttled.output],
        flows: [throttle],
      }),
    );
    throttleGame.advance(1000);
    expect(throttleGame.getSnapshot().resources).toMatchObject({ input: 0, output: 2 });

    const blocked = economy({ input: 4 });
    const block = blocked.kit.flow("block", {
      scope: blocked.run,
      rate: blocked.kit.rates.constant(5),
      consumes: [[blocked.input, 1]],
      produces: [[blocked.output, 1]],
      onInputShortage: "block",
    });
    const blockGame = createGame(
      blocked.kit.defineGame({
        id: "block",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [blocked.input, blocked.output],
        flows: [block],
      }),
    );
    blockGame.advance(1000);
    expect(blockGame.getSnapshot().resources).toMatchObject({ input: 4, output: 0 });
  });

  it.each(["block", "clamp", "discard"] as const)("honors %s output capacity", (overflow) => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const output = kit.resource("output", { scope: run, initial: 8, capacity: 10, overflow });
    const flow = kit.flow("capacity", {
      scope: run,
      rate: kit.rates.constant(5),
      produces: [[output, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: `cap-${overflow}`,
        simulationVersion: 1,
        stepMs: 1000,
        resources: [output],
        flows: [flow],
      }),
    );
    game.advance(1000);
    expect(game.getSnapshot().resources.output).toBe(10);
  });

  it("uses net production when one flow consumes and produces the capped resource", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const resource = kit.resource("value", { scope: run, initial: 9, capacity: 10 });
    const flow = kit.flow("refine", {
      scope: run,
      rate: kit.rates.constant(4),
      consumes: [[resource, 1]],
      produces: [[resource, 2]],
    });
    const game = createGame(
      kit.defineGame({
        id: "net-cap",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [resource],
        flows: [flow],
      }),
    );
    game.advance(1000);
    expect(game.getSnapshot().resources.value).toBe(10);
  });

  it("supports proportional, product, and custom rates", () => {
    const { kit, input } = economy({ input: 3 });
    const rate = kit.rates.product(
      kit.rates.proportional(input, 2),
      kit.rates.custom((state) => state.get(input) - 1),
    );
    expect(evaluateRate(rate, { get: () => 3, getAllocation: () => 0 }, nativeNumbers)).toBe(12);
  });

  it("rolls back invalid custom rates", () => {
    const { kit, run, output } = economy();
    const flow = kit.flow("invalid", {
      scope: run,
      rate: kit.rates.custom(() => -1),
      produces: [[output, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: "invalid-rate",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [output],
        flows: [flow],
      }),
    );
    expect(game.advance(1000)).toEqual({
      ok: false,
      error: { code: "transaction-failed", message: "Flow invalid produced an invalid rate" },
    });
    expect(game.getSnapshot().resources.output).toBe(0);
  });
});

describe("flow definitions", () => {
  it("validates ownership, coefficients, capacity, priority, and output", () => {
    const { kit, run, input } = economy();
    const other = economy();
    expect(() => kit.rates.proportional(other.input, 1)).toThrow("another game kit");
    expect(() => kit.rates.constant(Number.NaN)).toThrow("must be finite");
    expect(() => kit.rates.proportional(input, Number.NaN)).toThrow("must be finite");
    expect(() => kit.rates.product()).toThrow("at least one factor");
    expect(() =>
      kit.flow("bad", {
        scope: run,
        priority: 1.2,
        rate: kit.rates.constant(1),
        produces: [[input, 1]],
      }),
    ).toThrow("safe integer");
    expect(() =>
      kit.flow("bad", { scope: run, rate: kit.rates.constant(1), produces: [[input, 0]] }),
    ).toThrow("coefficients");
    expect(() =>
      kit.flow("bad", { scope: run, rate: kit.rates.constant(1), produces: [] }),
    ).toThrow("at least one");
    expect(() =>
      kit.flow("bad", { scope: other.run, rate: kit.rates.constant(1), produces: [[input, 1]] }),
    ).toThrow("another game kit");
    expect(() =>
      kit.flow("bad", { scope: run, rate: kit.rates.constant(1), produces: [[other.output, 1]] }),
    ).toThrow("another game kit");
    expect(() => kit.resource("bad-cap", { scope: run, initial: 2, capacity: 1 })).toThrow(
      "at least its initial value",
    );
    expect(() => kit.resource("bad-cap", { scope: run, initial: 0, capacity: Number.NaN })).toThrow(
      "must be finite",
    );
  });
});
