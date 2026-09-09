import {
  allocationCommand,
  createGame,
  createGameKit,
  nativeNumbers,
  recipeCommand,
} from "@e308/core";

export function createWireworksKernel() {
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
  const definition = kit.defineGame({
    id: "wireworks-kernel",
    simulationVersion: 1,
    stepMs: 1000,
    resources: [matter, power, wire],
    allocations: [grid],
    flows: [extruder],
  });
  const game = createGame(definition);
  game.dispatch(allocationCommand(grid, "extruder", 2));
  return { definition, game };
}

export function createCascadeKernel() {
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
  const definition = kit.defineGame({
    id: "cascade-kernel",
    simulationVersion: 1,
    stepMs: 1000,
    resources: [currency, tier1, tier2],
    flows: [base, descend],
  });
  return { definition, game: createGame(definition) };
}

export function createHearthKernel(foodCost = 2) {
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
      [food, foodCost],
      [wood, 1],
    ],
    produces: [[meals, 1]],
  });
  const definition = kit.defineGame({
    id: "hearth-kernel",
    simulationVersion: 1,
    stepMs: 1000,
    resources: [workers, food, wood, meals],
    allocations: [jobs],
    flows: [farm],
    recipes: [cook],
  });
  const game = createGame(definition);
  game.dispatch(allocationCommand(jobs, "farm", 2));
  const cookCommand = (count: number) => recipeCommand(cook, { count });
  return {
    definition,
    game,
    cookCommand,
    cook: (count: number) => game.dispatch(cookCommand(count)),
  };
}
