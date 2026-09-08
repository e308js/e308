import { describe, expect, it } from "vitest";
import { createGameKit, defineGame, nativeNumbers } from "../../packages/core/src/index.js";

describe("defineGame", () => {
  it("freezes a valid deterministic definition", () => {
    const game = defineGame({ id: "wireworks", simulationVersion: 1, stepMs: 50 });
    expect(game).toEqual({ id: "wireworks", simulationVersion: 1, stepMs: 50 });
    expect(Object.isFrozen(game)).toBe(true);
  });

  it.each([
    [{ id: "Bad ID", simulationVersion: 1, stepMs: 50 }, "Invalid game id"],
    [{ id: "game", simulationVersion: 0, stepMs: 50 }, "simulationVersion"],
    [{ id: "game", simulationVersion: 1, stepMs: 0 }, "stepMs"],
  ])("rejects an invalid definition", (input, message) => {
    expect(() => defineGame(input)).toThrow(message);
  });
});

describe("owned game definitions", () => {
  it("rejects duplicate and foreign mechanics", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const other = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const foreignRun = other.scope("run");
    const value = kit.resource("value", { scope: run, initial: 0 });
    const foreignValue = other.resource("value", { scope: foreignRun, initial: 0 });
    const flow = kit.flow("make", {
      scope: run,
      rate: kit.rates.constant(1),
      produces: [[value, 1]],
    });
    const foreignFlow = other.flow("make", {
      scope: foreignRun,
      rate: other.rates.constant(1),
      produces: [[foreignValue, 1]],
    });
    const input = {
      id: "owned",
      simulationVersion: 1,
      stepMs: 1000,
      resources: [value],
    } as const;
    expect(() => kit.defineGame({ ...input, resources: [value, value] })).toThrow(
      "Duplicate resource",
    );
    expect(() => kit.defineGame({ ...input, flows: [flow, flow] })).toThrow("Duplicate flow");
    expect(() => kit.defineGame({ ...input, flows: [foreignFlow] })).toThrow("another game kit");
    expect(() => kit.defineGame({ ...input, resources: [foreignValue] })).toThrow(
      "another game kit",
    );
  });
});
