import {
  hearthCalendar,
  hearthJobs,
  hearthKit,
  hearthRecipes,
  hearthResearch,
  hearthResources,
  hearthTasks,
  recovery,
  seasonalRule,
  shortage,
  yearComplete,
} from "./content.js";

export const hearthDefinition = hearthKit.defineGame({
  id: "hearth",
  simulationVersion: 1,
  stepMs: 1_000,
  resources: Object.values(hearthResources),
  allocations: [hearthJobs],
  recipes: Object.values(hearthRecipes),
  upgrades: hearthResearch,
  triggers: [shortage, recovery, yearComplete],
  steppedRules: [seasonalRule],
  tasks: Object.values(hearthTasks),
  calendars: [hearthCalendar],
  win: (state) =>
    state.hasAchievement(yearComplete.id) &&
    state.hasAchievement(recovery.id) &&
    hearthResearch.every((research) => state.hasUpgrade(research.id)) &&
    state.get(hearthResources.hall) >= 1,
});
