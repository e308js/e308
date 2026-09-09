import { wireworksBuyables, wireworksFlows, wireworksMarkets } from "./economy.js";
import { wireworksAllocation, wireworksKit, wireworksResources, wireworksScopes } from "./model.js";
import { wireworksEraProjects, wireworksProjects } from "./projects.js";

export const wireworksDefinition = wireworksKit.defineGame({
  id: "wireworks",
  simulationVersion: 2,
  stepMs: 1_000,
  resources: Object.values(wireworksResources),
  flows: wireworksFlows,
  allocations: [wireworksAllocation],
  buyables: Object.values(wireworksBuyables),
  upgrades: wireworksProjects,
  markets: Object.values(wireworksMarkets),
  scopeActivations: [
    wireworksKit.scopeActivation("workshop-era", {
      scope: wireworksScopes.workshop,
      active: (state) => !state.hasUpgrade(wireworksEraProjects.powered.id),
    }),
    wireworksKit.scopeActivation("industry-era", {
      scope: wireworksScopes.industry,
      active: (state) => state.hasUpgrade(wireworksEraProjects.powered.id),
    }),
    wireworksKit.scopeActivation("autonomy-era", {
      scope: wireworksScopes.autonomy,
      active: (state) => state.hasUpgrade(wireworksEraProjects.autonomous.id),
    }),
  ],
  win: (state) => state.hasUpgrade("final-expansion"),
});

export { supplyBatch, wireworksBuyables, wireworksMarkets } from "./economy.js";
export { wireworksAllocation, wireworksResources } from "./model.js";
export { wireworksProjects } from "./projects.js";
