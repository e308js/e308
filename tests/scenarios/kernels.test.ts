import { describe, expect, it } from "vitest";
import {
  allocationCommand,
  createGame,
  createGameKit,
  nativeNumbers,
  recipeCommand,
} from "../../packages/core/src/index.js";

describe("S02 headless game kernels", () => {
  it("runs Wireworks as an input- and power-constrained factory", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("industry");
    const matter = kit.resource("matter", { scope: run, initial: 5 });
    const power = kit.resource("power", { scope: run, initial: 2 });
    const wire = kit.resource("wire", { scope: run, initial: 0 });
    const grid = kit.allocation("grid", { scope: run, budget: power, targets: ["extruder"] });
    const extruder = kit.flow("extruder", {
      scope: run,
      rate: kit.rates.allocated(grid, "extruder", 2),
      consumes: [[matter, 1]],
      produces: [[wire, 3]],
    });
    const game = createGame(
      kit.defineGame({
        id: "wireworks-kernel",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [matter, power, wire],
        allocations: [grid],
        flows: [extruder],
      }),
    );
    game.dispatch(allocationCommand(grid, "extruder", 2));
    const trace = [game.getSnapshot().resources];
    game.advance(1000);
    trace.push(game.getSnapshot().resources);
    game.advance(1000);
    trace.push(game.getSnapshot().resources);
    expect(trace).toEqual([
      { matter: 5, power: 2, wire: 0 },
      { matter: 1, power: 2, wire: 12 },
      { matter: 0, power: 2, wire: 15 },
    ]);
  });

  it("runs Cascade as a delayed producer chain", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("cascade");
    const currency = kit.resource("currency", { scope: run, initial: 0 });
    const tier1 = kit.resource("tier-1", { scope: run, initial: 0 });
    const tier2 = kit.resource("tier-2", { scope: run, initial: 1 });
    const descend = kit.flow("tier-2-produces-tier-1", {
      scope: run,
      rate: kit.rates.proportional(tier2, 1),
      produces: [[tier1, 1]],
    });
    const base = kit.flow("tier-1-produces-currency", {
      scope: run,
      rate: kit.rates.proportional(tier1, 1),
      produces: [[currency, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: "cascade-kernel",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [currency, tier1, tier2],
        flows: [base, descend],
      }),
    );
    const trace: number[] = [];
    for (let step = 0; step < 4; step += 1) {
      trace.push(game.getSnapshot().resources.currency ?? Number.NaN);
      game.advance(1000);
    }
    expect(trace).toEqual([0, 0, 1, 3]);
  });

  it("runs Hearth as allocated gathering followed by an atomic recipe", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("settlement");
    const workers = kit.resource("workers", { scope: run, initial: 3 });
    const food = kit.resource("food", { scope: run, initial: 0, capacity: 8 });
    const wood = kit.resource("wood", { scope: run, initial: 4 });
    const meals = kit.resource("meals", { scope: run, initial: 0 });
    const jobs = kit.allocation("jobs", { scope: run, budget: workers, targets: ["farm"] });
    const farm = kit.flow("farm", {
      scope: run,
      rate: kit.rates.allocated(jobs, "farm", 1),
      produces: [[food, 1]],
    });
    const cook = kit.recipe("cook", {
      scope: run,
      consumes: [
        [food, 2],
        [wood, 1],
      ],
      produces: [[meals, 1]],
    });
    const game = createGame(
      kit.defineGame({
        id: "hearth-kernel",
        simulationVersion: 1,
        stepMs: 1000,
        resources: [workers, food, wood, meals],
        allocations: [jobs],
        flows: [farm],
        recipes: [cook],
      }),
    );
    game.dispatch(allocationCommand(jobs, "farm", 2));
    game.advance(3000);
    expect(game.dispatch(recipeCommand(cook, { count: 3 })).ok).toBe(true);
    expect(game.getSnapshot().resources).toEqual({ workers: 3, food: 0, wood: 1, meals: 3 });
  });
});
