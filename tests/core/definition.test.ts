import { describe, expect, it } from "vitest";
import { defineGame } from "../../packages/core/src/index.js";

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
