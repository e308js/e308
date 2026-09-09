import type { ProgressionContext, Scope, Transaction, UpgradeDefinition } from "@e308/core";
import { wireworksKit, wireworksResources, wireworksScopes } from "./model.js";

interface ProjectOptions {
  readonly scope: Scope;
  readonly cost: number;
  readonly prerequisiteIds?: readonly string[];
  readonly unlocked?: (state: ProgressionContext<number>) => boolean;
  readonly apply?: (transaction: Transaction<number>) => void;
}

function project(id: string, options: ProjectOptions): UpgradeDefinition<number> {
  const prerequisiteIds = options.prerequisiteIds ?? [];
  return wireworksKit.upgrade(id, {
    scope: options.scope,
    costs: options.cost > 0 ? [[wireworksResources.cash, options.cost]] : [],
    prerequisiteIds,
    unlocked:
      options.unlocked ?? ((state) => prerequisiteIds.every((entry) => state.hasUpgrade(entry))),
    ...(options.apply ? { apply: options.apply } : {}),
  });
}

const benchTools = project("bench-tools", {
  scope: wireworksScopes.workshop,
  cost: 20,
  apply: (tx) => tx.add(wireworksResources.efficiency, 0.25),
});
const storefront = project("storefront", {
  scope: wireworksScopes.workshop,
  cost: 35,
  prerequisiteIds: [benchTools.id],
  apply: (tx) => tx.add(wireworksResources.reach, 3),
});
const demandSurvey = project("demand-survey", {
  scope: wireworksScopes.workshop,
  cost: 55,
  prerequisiteIds: [storefront.id],
  apply: (tx) => tx.add(wireworksResources.reach, 5),
});
const poweredExtrusion = project("powered-extrusion", {
  scope: wireworksScopes.workshop,
  cost: 80,
  prerequisiteIds: [demandSurvey.id],
  apply: (tx) => {
    tx.add(wireworksResources.power, 2);
    tx.add(wireworksResources.storage, 1);
  },
});
const batteryBank = project("battery-bank", {
  scope: wireworksScopes.industry,
  cost: 120,
  prerequisiteIds: [poweredExtrusion.id],
  apply: (tx) => tx.add(wireworksResources.power, 3),
});
const assemblerLine = project("assembler-line", {
  scope: wireworksScopes.industry,
  cost: 180,
  prerequisiteIds: [batteryBank.id],
  apply: (tx) => {
    tx.add(wireworksResources.efficiency, 0.75);
    tx.add(wireworksResources.storage, 1);
  },
});
const priceModel = project("price-model", {
  scope: wireworksScopes.industry,
  cost: 260,
  prerequisiteIds: [assemblerLine.id],
  apply: (tx) => tx.add(wireworksResources.reach, 7),
});
const durableDrive = doctrine("durable-drive", "throughput-drive", (tx) => {
  tx.add(wireworksResources.storage, 3);
  tx.add(wireworksResources.efficiency, 0.5);
});
const throughputDrive = doctrine("throughput-drive", "durable-drive", (tx) => {
  tx.add(wireworksResources.power, 4);
  tx.add(wireworksResources.efficiency, 1);
});
const autonomousControl = project("autonomous-control", {
  scope: wireworksScopes.industry,
  cost: 420,
  prerequisiteIds: [priceModel.id],
  unlocked: (state) =>
    state.hasUpgrade(priceModel.id) &&
    (state.hasUpgrade(durableDrive.id) || state.hasUpgrade(throughputDrive.id)),
  apply: (tx) => {
    addDrones(tx, 1);
    tx.add(wireworksResources.storage, 5);
  },
});
const droneSwarm = project("drone-swarm", {
  scope: wireworksScopes.autonomy,
  cost: 600,
  prerequisiteIds: [autonomousControl.id],
  apply: (tx) => addDrones(tx, 4),
});
const orbitalContract = thresholdProject("orbital-contract", 900, droneSwarm.id, 10, (tx) =>
  tx.add(wireworksResources.probes, 1),
);
const launchArray = thresholdProject("launch-array", 1_200, orbitalContract.id, 50, (tx) =>
  tx.add(wireworksResources.probes, 2),
);
const finalExpansion = thresholdProject("final-expansion", 1_600, launchArray.id, 200);

function doctrine(
  id: string,
  alternative: string,
  apply: (transaction: Transaction<number>) => void,
): UpgradeDefinition<number> {
  return project(id, {
    scope: wireworksScopes.industry,
    cost: 100,
    prerequisiteIds: [priceModel.id],
    unlocked: (state) => state.hasUpgrade(priceModel.id) && !state.hasUpgrade(alternative),
    apply,
  });
}

function addDrones(transaction: Transaction<number>, amount: number): void {
  transaction.set(
    wireworksResources.drones,
    Math.min(10_000, transaction.get(wireworksResources.drones) + amount),
  );
}

function thresholdProject(
  id: string,
  cost: number,
  prerequisiteId: string,
  drones: number,
  apply?: (transaction: Transaction<number>) => void,
): UpgradeDefinition<number> {
  return project(id, {
    scope: wireworksScopes.autonomy,
    cost,
    prerequisiteIds: [prerequisiteId],
    unlocked: (state) =>
      state.hasUpgrade(prerequisiteId) && state.get(wireworksResources.drones) >= drones,
    ...(apply ? { apply } : {}),
  });
}

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

export const wireworksEraProjects = {
  powered: poweredExtrusion,
  autonomous: autonomousControl,
} as const;
