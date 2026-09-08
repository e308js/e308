import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  nativeNumbers,
  recipeCommand,
} from "../../packages/core/src/index.js";

function fixture(inputAmount: number, outputAmount = 0, capacity?: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const input = kit.resource("input", { scope: run, initial: inputAmount });
  const output = kit.resource("output", {
    scope: run,
    initial: outputAmount,
    ...(capacity === undefined ? {} : { capacity }),
  });
  const recipe = kit.recipe("craft", {
    scope: run,
    consumes: [
      [input, 1],
      [input, 1],
    ],
    produces: [[output, 3]],
  });
  const game = createGame(
    kit.defineGame({
      id: "recipes",
      simulationVersion: 1,
      stepMs: 50,
      resources: [input, output],
      recipes: [recipe],
    }),
  );
  return { game, input, kit, output, recipe, run };
}

describe("instant recipes", () => {
  it("executes an exact whole count atomically", () => {
    const { game, recipe } = fixture(10);
    expect(game.dispatch(recipeCommand(recipe, { count: 3 }))).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({ input: 4, output: 9 });
  });

  it("executes up to the available input", () => {
    const { game, recipe } = fixture(5);
    game.dispatch(recipeCommand(recipe, { count: 10, mode: "up-to" }));
    expect(game.getSnapshot().resources).toMatchObject({ input: 1, output: 6 });
  });

  it("returns an insufficient failure without partial exact execution", () => {
    const { game, recipe } = fixture(5);
    expect(game.dispatch(recipeCommand(recipe, { count: 3 }))).toEqual({
      ok: false,
      error: { code: "insufficient", resourceId: "input", required: 6, available: 5 },
    });
    expect(game.getSnapshot().resources).toMatchObject({ input: 5, output: 0 });
  });

  it("constrains up-to counts and rejects exact counts at blocking capacity", () => {
    const partial = fixture(10, 7, 10);
    partial.game.dispatch(recipeCommand(partial.recipe, { count: 3, mode: "up-to" }));
    expect(partial.game.getSnapshot().resources).toMatchObject({ input: 8, output: 10 });

    const exact = fixture(10, 7, 10);
    expect(exact.game.dispatch(recipeCommand(exact.recipe, { count: 3 }))).toEqual({
      ok: false,
      error: { code: "capacity-blocked", resourceId: "output", attempted: 16, capacity: 10 },
    });
  });

  it("uses net output for a same-resource recipe", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const value = kit.resource("value", { scope: run, initial: 8, capacity: 10 });
    const recipe = kit.recipe("refine", {
      scope: run,
      consumes: [[value, 1]],
      produces: [[value, 2]],
    });
    const game = createGame(
      kit.defineGame({
        id: "net-recipe",
        simulationVersion: 1,
        stepMs: 50,
        resources: [value],
        recipes: [recipe],
      }),
    );
    game.dispatch(recipeCommand(recipe, { count: 2 }));
    expect(game.getSnapshot().resources.value).toBe(10);
  });

  it("validates counts and definitions", () => {
    const { game, input, kit, recipe, run } = fixture(1);
    expect(game.dispatch(recipeCommand(recipe, { count: 0 }))).toEqual({
      ok: false,
      error: { code: "invalid-count", requested: 0 },
    });
    expect(game.dispatch(recipeCommand(recipe, { count: 1, mode: "up-to" }))).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
    expect(() => kit.recipe("empty", { scope: run, produces: [] })).toThrow("at least one");
    expect(() =>
      kit.recipe("bad", { scope: run, produces: [[input, Number.POSITIVE_INFINITY]] }),
    ).toThrow("coefficients");
  });
});
