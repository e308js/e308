import type { Scope } from "../../packages/core/src/index.js";
import {
  arrayGenerators,
  arrayKit,
  arrayMilestones,
  arrayResources,
  aUpgradeBuyables,
  boosterator,
  bUpgrades,
} from "./model.js";
import { updateArrayEconomy } from "./production.js";

const simulationScope: Scope = arrayKit.scope("array-simulation");
const tick = arrayKit.steppedRule("array-update", {
  scope: simulationScope,
  update: updateArrayEconomy,
});

export const arrayDefinition = arrayKit.defineGame({
  id: "array-game-reference",
  simulationVersion: 1,
  stepMs: 16,
  resources: [
    ...Object.values(arrayResources),
    ...arrayGenerators.A.amounts,
    ...arrayGenerators.B.amounts,
  ],
  buyables: [
    ...arrayGenerators.A.buyables,
    ...arrayGenerators.B.buyables,
    ...aUpgradeBuyables,
    boosterator,
  ],
  upgrades: bUpgrades,
  triggers: arrayMilestones,
  steppedRules: [tick],
});
