import {
  createGameKit,
  type GameKit,
  nativeNumbers,
  type Resource,
  type Scope,
} from "../../packages/core/src/index.js";

export function createKittensModel() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const settlement = kit.scope("settlement");
  const legacy = kit.scope("legacy");
  const workshop = kit.scope("workshop");
  const resources = createResources(kit, settlement, legacy);
  const { barns, catnip, wood, minerals, science, beam, huts, kittens } = resources;
  const workers = kit.allocation("workers", {
    scope: settlement,
    budget: kittens,
    targets: ["farmer", "woodcutter", "miner", "scholar"],
  });
  const year = kit.calendar("year", {
    scope: settlement,
    phases: ["spring", "summer", "autumn", "winter"].map((id) => ({ id, durationMs: 200_000 })),
  });
  const construction = kit.upgrade("construction", {
    scope: settlement,
    costs: [[science, 10]],
    prerequisiteIds: [],
    unlocked: () => true,
  });
  const workshopActive = kit.scopeActivation("workshop-active", {
    scope: workshop,
    active: (state) => state.hasUpgrade(construction.id),
  });
  const refineWood = kit.recipe("refine-wood", {
    scope: settlement,
    consumes: [[catnip, 100]],
    produces: [[wood, 1]],
  });
  const craftBeam = kit.recipe("craft-beam", {
    scope: workshop,
    consumes: [[wood, 175]],
    produces: [[beam, 1]],
  });
  const buildBarn = kit.recipe("build-barn", {
    scope: settlement,
    consumes: [[wood, 50]],
    produces: [[barns, 1]],
  });
  const buildHut = kit.recipe("build-hut", {
    scope: settlement,
    consumes: [[wood, 5]],
    produces: [[huts, 1]],
  });
  const seasonRule = kit.steppedRule("settlement-production", {
    scope: settlement,
    update: (transaction) =>
      runSettlementTick(transaction, { catnip, wood, minerals, science, kittens, workers, year }),
  });
  const definition = kit.defineGame({
    id: "kittens-laboratory",
    simulationVersion: 1,
    stepMs: 200,
    resources: Object.values(resources),
    allocations: [workers],
    recipes: [refineWood, craftBeam, buildBarn, buildHut],
    upgrades: [construction],
    scopeActivations: [workshopActive],
    steppedRules: [seasonRule],
    calendars: [year],
  });
  return {
    kit,
    settlement,
    legacy,
    workshop,
    resources,
    workers,
    year,
    construction,
    recipes: { refineWood, craftBeam, buildBarn, buildHut },
    definition,
  };
}

function createResources(kit: GameKit<number>, settlement: Scope, legacy: Scope) {
  const barns = kit.resource("barns", { scope: settlement, initial: 0 });
  const catnip = kit.resource("catnip", {
    scope: settlement,
    initial: 0,
    capacityFor: (get) => 5_000 + get(barns) * 5_000,
    overflow: "clamp",
  });
  const wood = kit.resource("wood", {
    scope: settlement,
    initial: 0,
    capacityFor: (get) => 200 + get(barns) * 200,
    overflow: "clamp",
  });
  const minerals = kit.resource("minerals", {
    scope: settlement,
    initial: 0,
    capacityFor: (get) => 250 + get(barns) * 250,
    overflow: "clamp",
  });
  const science = kit.resource("science", {
    scope: settlement,
    initial: 0,
    capacity: 100,
    overflow: "clamp",
  });
  const beam = kit.resource("beam", { scope: settlement, initial: 0 });
  const huts = kit.resource("huts", { scope: settlement, initial: 0 });
  const kittens = kit.resource("kittens", { scope: settlement, initial: 0 });
  const paragon = kit.resource("paragon", { scope: legacy, initial: 0 });
  return { catnip, wood, minerals, science, beam, huts, barns, kittens, paragon };
}

function runSettlementTick(
  transaction: import("../../packages/core/src/index.js").Transaction<number>,
  model: {
    catnip: Resource<number>;
    wood: Resource<number>;
    minerals: Resource<number>;
    science: Resource<number>;
    kittens: Resource<number>;
    workers: import("../../packages/core/src/index.js").AllocationDefinition<number>;
    year: import("../../packages/core/src/index.js").CalendarDefinition;
  },
): void {
  const season = transaction.getCalendarState(model.year).phaseIndex;
  const catnipRatio = [1.5, 1, 1, 0.25][season] as number;
  const assigned = (job: string) => transaction.getAllocation(model.workers.id, job);
  const catnip =
    transaction.get(model.catnip) +
    assigned("farmer") * catnipRatio -
    transaction.get(model.kittens) * 0.85;
  transaction.set(model.catnip, Math.max(0, catnip));
  transaction.add(model.wood, assigned("woodcutter") * 0.018);
  transaction.add(model.minerals, assigned("miner") * 0.05);
  transaction.add(model.science, assigned("scholar") * 0.035);
}

export type KittensModel = ReturnType<typeof createKittensModel>;
