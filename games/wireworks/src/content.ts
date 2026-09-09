import {
  createGameKit,
  type MarketDefinition,
  nativeNumbers,
  type ProgressionContext,
  type Transaction,
  type UpgradeDefinition,
} from "@e308/core";

const kit = createGameKit({ numbers: nativeNumbers });
const economy = kit.scope("economy");
const workshop = kit.scope("workshop");
const industry = kit.scope("industry");
const autonomy = kit.scope("autonomy");

export const wireworksResources = {
  cash: kit.resource("cash", { scope: economy, initial: 20 }),
  matter: kit.resource("matter", { scope: economy, initial: 240 }),
  wire: kit.resource("wire", { scope: economy, initial: 10, capacity: 400 }),
  clips: kit.resource("clips", { scope: economy, initial: 0, capacity: 500 }),
  power: kit.resource("power", { scope: economy, initial: 2 }),
  demand: kit.resource("demand", { scope: economy, initial: 30, capacity: 100 }),
  drones: kit.resource("drones", { scope: economy, initial: 0 }),
  probes: kit.resource("probes", { scope: economy, initial: 0 }),
} as const;

const grid = kit.allocation("grid", {
  scope: industry,
  budget: wireworksResources.power,
  targets: ["extrusion", "assembly"],
  initial: { extrusion: 1, assembly: 1 },
});

const flows = [
  kit.flow("workshop-wire", {
    scope: workshop,
    priority: 10,
    rate: kit.rates.constant(1),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.wire, 2]],
  }),
  kit.flow("workshop-clips", {
    scope: workshop,
    priority: 20,
    rate: kit.rates.constant(1),
    consumes: [[wireworksResources.wire, 1]],
    produces: [[wireworksResources.clips, 2]],
  }),
  kit.flow("powered-wire", {
    scope: industry,
    priority: 10,
    rate: kit.rates.allocated(grid, "extrusion", 2),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.wire, 4]],
  }),
  kit.flow("powered-clips", {
    scope: industry,
    priority: 20,
    rate: kit.rates.allocated(grid, "assembly", 2),
    consumes: [[wireworksResources.wire, 2]],
    produces: [[wireworksResources.clips, 5]],
  }),
  kit.flow("autonomous-clips", {
    scope: autonomy,
    priority: 20,
    rate: kit.rates.proportional(wireworksResources.drones, 0.5),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.clips, 10]],
  }),
  kit.flow("demand-recovery", {
    scope: economy,
    priority: 30,
    rate: kit.rates.constant(0.25),
    produces: [[wireworksResources.demand, 1]],
  }),
];

type ProjectOptions = {
  readonly scope: typeof workshop;
  readonly cost: number;
  readonly prerequisiteIds?: readonly string[];
  readonly unlocked?: (state: ProgressionContext<number>) => boolean;
  readonly apply?: (transaction: Transaction<number>) => void;
};

function project(id: string, options: ProjectOptions): UpgradeDefinition<number> {
  const prerequisiteIds = options.prerequisiteIds ?? [];
  return kit.upgrade(id, {
    scope: options.scope,
    costs: options.cost > 0 ? [[wireworksResources.cash, options.cost]] : [],
    prerequisiteIds,
    unlocked:
      options.unlocked ?? ((state) => prerequisiteIds.every((entry) => state.hasUpgrade(entry))),
    ...(options.apply ? { apply: options.apply } : {}),
  });
}

const benchTools = project("bench-tools", { scope: workshop, cost: 20 });
const storefront = project("storefront", {
  scope: workshop,
  cost: 35,
  prerequisiteIds: [benchTools.id],
  apply: (tx) => tx.add(wireworksResources.demand, 20),
});
const demandSurvey = project("demand-survey", {
  scope: workshop,
  cost: 55,
  prerequisiteIds: [storefront.id],
  apply: (tx) => tx.add(wireworksResources.demand, 30),
});
const poweredExtrusion = project("powered-extrusion", {
  scope: workshop,
  cost: 80,
  prerequisiteIds: [demandSurvey.id],
  apply: (tx) => {
    tx.add(wireworksResources.matter, 600);
    tx.add(wireworksResources.power, 2);
  },
});
const batteryBank = project("battery-bank", {
  scope: industry,
  cost: 120,
  prerequisiteIds: [poweredExtrusion.id],
  apply: (tx) => tx.add(wireworksResources.power, 3),
});
const assemblerLine = project("assembler-line", {
  scope: industry,
  cost: 180,
  prerequisiteIds: [batteryBank.id],
  apply: (tx) => tx.add(wireworksResources.matter, 1_000),
});
const priceModel = project("price-model", {
  scope: industry,
  cost: 260,
  prerequisiteIds: [assemblerLine.id],
});
const durableDrive = project("durable-drive", {
  scope: industry,
  cost: 100,
  prerequisiteIds: [priceModel.id],
  unlocked: (state) => state.hasUpgrade(priceModel.id) && !state.hasUpgrade("throughput-drive"),
  apply: (tx) => tx.add(wireworksResources.matter, 1_500),
});
const throughputDrive = project("throughput-drive", {
  scope: industry,
  cost: 100,
  prerequisiteIds: [priceModel.id],
  unlocked: (state) => state.hasUpgrade(priceModel.id) && !state.hasUpgrade("durable-drive"),
  apply: (tx) => tx.add(wireworksResources.power, 4),
});
const autonomousControl = project("autonomous-control", {
  scope: industry,
  cost: 420,
  prerequisiteIds: [priceModel.id],
  unlocked: (state) =>
    state.hasUpgrade(priceModel.id) &&
    (state.hasUpgrade(durableDrive.id) || state.hasUpgrade(throughputDrive.id)),
  apply: (tx) => {
    tx.add(wireworksResources.drones, 2);
    tx.add(wireworksResources.matter, 2_000);
  },
});
const droneSwarm = project("drone-swarm", {
  scope: autonomy,
  cost: 600,
  prerequisiteIds: [autonomousControl.id],
  apply: (tx) => tx.add(wireworksResources.drones, 4),
});
const orbitalContract = project("orbital-contract", {
  scope: autonomy,
  cost: 900,
  prerequisiteIds: [droneSwarm.id],
  apply: (tx) => tx.add(wireworksResources.probes, 1),
});
const launchArray = project("launch-array", {
  scope: autonomy,
  cost: 1_200,
  prerequisiteIds: [orbitalContract.id],
  apply: (tx) => tx.add(wireworksResources.probes, 2),
});
const finalExpansion = project("final-expansion", {
  scope: autonomy,
  cost: 1_600,
  prerequisiteIds: [launchArray.id],
  unlocked: (state) =>
    state.hasUpgrade(launchArray.id) && state.get(wireworksResources.probes) >= 3,
});

export const wireworksProjects = [
  benchTools,
  storefront,
  demandSurvey,
  poweredExtrusion,
  batteryBank,
  assemblerLine,
  priceModel,
  durableDrive,
  throughputDrive,
  autonomousControl,
  droneSwarm,
  orbitalContract,
  launchArray,
  finalExpansion,
] as const;

function salesMarket(id: string, sell: number, maximumQuantity: number): MarketDefinition<number> {
  return kit.market(id, {
    scope: economy,
    inventory: wireworksResources.clips,
    currency: wireworksResources.cash,
    price: { kind: "fixed", buy: sell + 2, sell },
    feeRate: 0,
    feeRounding: "none",
    maximumQuantity,
  });
}

export const wireworksMarkets = {
  volume: salesMarket("volume-sales", 2, 20),
  standard: salesMarket("standard-sales", 4, 10),
  premium: salesMarket("premium-sales", 7, 5),
} as const;

export const wireworksAllocation = grid;
export const wireworksDefinition = kit.defineGame({
  id: "wireworks",
  simulationVersion: 1,
  stepMs: 1_000,
  resources: Object.values(wireworksResources),
  flows,
  allocations: [grid],
  upgrades: wireworksProjects,
  markets: Object.values(wireworksMarkets),
  scopeActivations: [
    kit.scopeActivation("workshop-era", {
      scope: workshop,
      active: (state) => !state.hasUpgrade(poweredExtrusion.id),
    }),
    kit.scopeActivation("industry-era", {
      scope: industry,
      active: (state) =>
        state.hasUpgrade(poweredExtrusion.id) && !state.hasUpgrade(autonomousControl.id),
    }),
    kit.scopeActivation("autonomy-era", {
      scope: autonomy,
      active: (state) => state.hasUpgrade(autonomousControl.id),
    }),
  ],
  win: (state) => state.hasUpgrade(finalExpansion.id),
});
