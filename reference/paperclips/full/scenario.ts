import { createGame, type Snapshot } from "../../../packages/core/src/index.js";
import type { HarnessScenario } from "../../../packages/core/src/testing/index.js";
import { paperclipsCommand } from "./commands.js";
import { paperclipsBuyables, paperclipsDefinition, paperclipsResources } from "./model.js";
import {
  fullConstraints,
  paperclipsBusinessQuotes,
  paperclipsFullQuotes,
} from "./scenario-quotes.js";
import { type PaperclipsIntent, type PaperclipsObservation, paperclipsPhase } from "./types.js";

export function paperclipsBusinessScenario(): HarnessScenario<
  number,
  PaperclipsObservation,
  PaperclipsIntent
> {
  return {
    id: "paperclips-full-business",
    contentVersion: "1.0.0",
    contentDigest: "paperclips-full-business-v1",
    parameters: {},
    definition: paperclipsDefinition,
    goals: [
      {
        id: "industry-phase",
        evaluate: (snapshot) =>
          snapshot.progression.milestones["industry-phase"]
            ? { kind: "reached" }
            : { kind: "pending", constraints: fullConstraints(snapshot) },
      },
    ],
    create: () => createGame(paperclipsDefinition),
    observe: observation,
    quote: paperclipsBusinessQuotes,
    command: (intent, snapshot) => paperclipsCommand(snapshot, intent),
    sample,
    milestones: (snapshot) => [
      ...Object.keys(snapshot.progression.upgrades),
      ...Object.keys(snapshot.progression.milestones),
    ],
    diagnostics: () => ({ overflow: 0, resetRecoveries: 0, taskBlocks: 0 }),
  };
}

export function paperclipsFullScenario(): HarnessScenario<
  number,
  PaperclipsObservation,
  PaperclipsIntent
> {
  const base = paperclipsBusinessScenario();
  return {
    ...base,
    id: "paperclips-full-campaign",
    contentDigest: "paperclips-full-campaign-v1",
    goals: [
      {
        id: "campaign-ending",
        evaluate: (snapshot) =>
          snapshot.progression.won
            ? { kind: "reached" }
            : { kind: "pending", constraints: fullConstraints(snapshot) },
      },
    ],
    quote: paperclipsFullQuotes,
  };
}

function observation(snapshot: Snapshot<number>): PaperclipsObservation {
  return {
    phase: paperclipsPhase(snapshot),
    clips: snapshot.resources.clips as number,
    funds: snapshot.resources.funds as number,
    wire: snapshot.resources.wire as number,
    operations: snapshot.resources.operations as number,
    creativity: snapshot.resources.creativity as number,
    yomi: snapshot.resources.yomi as number,
    projects: Object.keys(snapshot.progression.upgrades).length,
  };
}

function sample(snapshot: Snapshot<number>) {
  const purchaseCounts = {
    [paperclipsBuyables.harvester.id]: 0,
    [paperclipsBuyables.wireDrone.id]: 0,
    [paperclipsBuyables.factory.id]: 0,
    [paperclipsBuyables.solarFarm.id]: 0,
    ...snapshot.purchaseCounts,
  };
  return {
    phase: paperclipsPhase(snapshot),
    clips: String(snapshot.resources.clips),
    funds: String(snapshot.resources.funds),
    operations: String(snapshot.resources.operations),
    yomi: String(snapshot.resources.yomi),
    availableMatter: String(snapshot.resources[paperclipsResources.availableMatter.id]),
    acquiredMatter: String(snapshot.resources[paperclipsResources.acquiredMatter.id]),
    processedMatter: String(snapshot.resources[paperclipsResources.processedMatter.id]),
    harvesters: String(purchaseCounts[paperclipsBuyables.harvester.id]),
    wireDrones: String(purchaseCounts[paperclipsBuyables.wireDrone.id]),
    factories: String(purchaseCounts[paperclipsBuyables.factory.id]),
    farms: String(purchaseCounts[paperclipsBuyables.solarFarm.id]),
  };
}
