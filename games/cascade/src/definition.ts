import type { EternityQuantity } from "@e308/core";
import {
  buyTenMilestones,
  cascadeBuyables,
  cascadeKit,
  cascadeProductionRule,
  cascadeResources,
  cascadeTiers,
} from "./economy.js";
import {
  cascadeAutomation,
  cascadeChallenges,
  cascadePrestiges,
  cascadeUpgrades,
  researchAllocation,
} from "./progression.js";

export const cascadeDefinition = cascadeKit.defineGame({
  id: "cascade",
  simulationVersion: 3,
  stepMs: 1_000,
  resources: [...Object.values(cascadeResources), ...cascadeTiers],
  buyables: cascadeBuyables,
  allocations: [researchAllocation],
  prestiges: cascadePrestiges,
  upgrades: cascadeUpgrades,
  triggers: buyTenMilestones,
  challenges: cascadeChallenges,
  automation: cascadeAutomation,
  steppedRules: [cascadeProductionRule],
  win: (state) => state.hasUpgrade("final-research"),
});

export type CascadeQuantity = EternityQuantity;
