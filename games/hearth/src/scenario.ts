import { createGame, type Snapshot } from "@e308/core";
import type { HarnessScenario, HarnessValue, LegalActionQuote } from "@e308/core/testing";
import {
  hearthCalendar,
  hearthRecipes,
  hearthResearch,
  type hearthResources,
  hearthTasks,
} from "./content.js";
import { hearthDefinition } from "./definition.js";
import { type HearthActionIntent, hearthCommand } from "./runtime.js";

export interface HearthObservation extends Readonly<Record<string, HarnessValue>> {
  readonly season: string;
  readonly cycle: string;
  readonly food: number;
  readonly morale: number;
  readonly achievements: readonly string[];
}

export type HearthStrategy = "stockpile" | "research-first";

export function hearthScenario(
  strategy: HearthStrategy = "stockpile",
): HarnessScenario<number, HearthObservation, HearthActionIntent> {
  return {
    id: "hearth",
    contentVersion: "1.1.0",
    contentDigest: "hearth-1.1.0-settlement-loop-2026-09-09",
    parameters: { strategy },
    definition: hearthDefinition,
    goals: [
      {
        id: "great-hall",
        evaluate: (snapshot) =>
          snapshot.progression.won
            ? { kind: "reached" }
            : {
                kind: "pending",
                constraints: [
                  { kind: "prerequisite", id: nextStage(snapshot), detail: "settlement objective" },
                ],
              },
      },
    ],
    create: () => createGame(hearthDefinition),
    observe: (snapshot) => ({
      season: season(snapshot),
      cycle: String(snapshot.calendars.seasons?.cycle ?? 0n),
      food: snapshot.resources.food ?? 0,
      morale: snapshot.resources.morale ?? 0,
      achievements: Object.keys(snapshot.progression.achievements),
    }),
    quote: (snapshot) => nextQuotes(snapshot, strategy),
    command: (intent) => hearthCommand(intent),
    sample: (snapshot) => ({
      season: season(snapshot),
      food: String(snapshot.resources.food ?? 0),
      wood: String(snapshot.resources.wood ?? 0),
      stone: String(snapshot.resources.stone ?? 0),
      science: String(snapshot.resources.science ?? 0),
      morale: String(snapshot.resources.morale ?? 0),
    }),
    milestones: (snapshot) => [
      ...(snapshot.calendars.seasons?.boundaries ?? []).map(
        (boundary) => `season:${boundary.phaseId}:${boundary.cycle}`,
      ),
      ...Object.keys(snapshot.progression.upgrades).map((id) => `research:${id}`),
      ...Object.keys(snapshot.progression.achievements),
      ...(snapshot.tasks[hearthTasks.expedition.id]?.completed.length ? ["expedition"] : []),
      ...(snapshot.progression.won ? ["ending"] : []),
    ],
    diagnostics: (before, after) => ({
      overflow: capacityHits(after) - capacityHits(before),
      resetRecoveries:
        Number(after.progression.achievements["shortage-recovered"] ?? false) -
        Number(before.progression.achievements["shortage-recovered"] ?? false),
      taskBlocks: 0,
    }),
  };
}

function nextQuotes(
  snapshot: Snapshot<number>,
  strategy: HearthStrategy,
): readonly LegalActionQuote<HearthActionIntent>[] {
  if (!snapshot.progression.achievements["year-complete"])
    return openingAllocation(snapshot, strategy);
  const research = hearthResearch.find((entry) => !snapshot.progression.upgrades[entry.id]);
  if (research) return affordableResearch(snapshot, research.id, research.costs[0]?.[1] ?? 0);
  if (!snapshot.progression.achievements["shortage-recovered"]) return recoveryAction(snapshot);
  const allocation = stockAllocation(snapshot);
  if (allocation) return [allocation];
  if (!stockReady(snapshot)) return [];
  const craft = craftAction(snapshot);
  if (craft) return [craft];
  const expedition = snapshot.tasks[hearthTasks.expedition.id];
  if (!expedition?.completed.length) {
    if (!expedition?.active && expedition?.queue.length === 0)
      return [legal(snapshot, "queue-expedition", { type: "task", task: "expedition" })];
    return [];
  }
  const hall = snapshot.tasks[hearthTasks.hall.id];
  if (!hall?.completed.length) {
    if (!hall?.active && hall?.queue.length === 0)
      return [legal(snapshot, "queue-hall", { type: "task", task: "hall" })];
    return [];
  }
  return [];
}

function openingAllocation(
  snapshot: Snapshot<number>,
  strategy: HearthStrategy,
): readonly LegalActionQuote<HearthActionIntent>[] {
  if (strategy === "stockpile") {
    if ((snapshot.allocations.jobs?.scholar ?? 0) !== 1)
      return [legal(snapshot, "opening-scholar", { type: "allocate", job: "scholar", amount: 1 })];
    return [];
  }
  if ((snapshot.allocations.jobs?.farmer ?? 0) !== 1)
    return [legal(snapshot, "opening-farmer", { type: "allocate", job: "farmer", amount: 1 })];
  if ((snapshot.allocations.jobs?.scholar ?? 0) !== 2)
    return [legal(snapshot, "opening-scholar", { type: "allocate", job: "scholar", amount: 2 })];
  return [];
}

function affordableResearch(
  snapshot: Snapshot<number>,
  id: string,
  cost: number,
): readonly LegalActionQuote<HearthActionIntent>[] {
  const allowed = (snapshot.resources.science ?? 0) >= cost;
  return [
    {
      ...legal(snapshot, `research-${id}`, { type: "research", id }),
      legal: allowed,
      constraints: allowed
        ? []
        : [{ kind: "insufficient-input", id: "science", detail: `${cost} science` }],
    },
  ];
}

function recoveryAction(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<HearthActionIntent>[] {
  const desired: readonly ["woodcutter" | "miner" | "scholar", number][] = [
    ["woodcutter", 0],
    ["miner", 0],
    ["scholar", 0],
  ];
  const change = desired.find(
    ([job, amount]) => (snapshot.allocations.jobs?.[job] ?? 0) !== amount,
  );
  if (change)
    return [
      legal(snapshot, `recover-${change[0]}`, {
        type: "allocate",
        job: change[0],
        amount: change[1],
      }),
    ];
  if ((snapshot.allocations.jobs?.farmer ?? 0) !== 5)
    return [legal(snapshot, "recover-farmers", { type: "allocate", job: "farmer", amount: 5 })];
  if ((snapshot.resources.food ?? 0) < 10 || (snapshot.resources.morale ?? 0) < 20) return [];
  return [legal(snapshot, "recovery-meal", { type: "recipe", recipe: "meal", count: 1 })];
}

function stockAllocation(
  snapshot: Snapshot<number>,
): LegalActionQuote<HearthActionIntent> | undefined {
  const target: readonly ["farmer" | "woodcutter" | "miner" | "scholar", number][] = [
    ["farmer", 2],
    ["woodcutter", 1],
    ["miner", 1],
    ["scholar", 1],
  ];
  const change = target.find(([job, amount]) => (snapshot.allocations.jobs?.[job] ?? 0) !== amount);
  return change
    ? legal(snapshot, `stock-${change[0]}`, { type: "allocate", job: change[0], amount: change[1] })
    : undefined;
}

function stockReady(snapshot: Snapshot<number>): boolean {
  return (
    (snapshot.resources.food ?? 0) >= 50 &&
    (snapshot.resources.wood ?? 0) >= 50 &&
    (snapshot.resources.stone ?? 0) >= 30 &&
    (snapshot.resources.herbs ?? 0) >= 20
  );
}

function craftAction(snapshot: Snapshot<number>): LegalActionQuote<HearthActionIntent> | undefined {
  const targets: readonly [keyof typeof hearthRecipes, keyof typeof hearthResources, number][] = [
    ["tool", "tools", 3],
    ["cloth", "cloth", 3],
    ["meal", "meals", 6],
    ["medicine", "medicine", 1],
    ["preserves", "preserves", 1],
    ["festival", "festival", 1],
  ];
  const next = targets.find(([, resource, target]) => (snapshot.resources[resource] ?? 0) < target);
  if (!next) return undefined;
  const definition = hearthRecipes[next[0]];
  if (
    definition.consumes.some(
      ([resource, amount]) => (snapshot.resources[resource.id] ?? 0) < amount,
    )
  )
    return undefined;
  const current = snapshot.resources[next[1]] ?? 0;
  return legal(snapshot, `craft-${next[0]}`, {
    type: "recipe",
    recipe: next[0],
    count: next[2] - current,
  });
}

function legal(
  snapshot: Snapshot<number>,
  id: string,
  intent: HearthActionIntent,
): LegalActionQuote<HearthActionIntent> {
  return {
    id,
    revision: snapshot.revision.toString(),
    intent,
    legal: true,
    useful: true,
    rank: 100,
    constraints: [],
  };
}

function season(snapshot: Snapshot<number>): string {
  return hearthCalendar.phases[snapshot.calendars.seasons?.phaseIndex ?? 0]?.id ?? "spring";
}

function nextStage(snapshot: Snapshot<number>): string {
  if (!snapshot.progression.achievements["year-complete"]) return "year-complete";
  if (!snapshot.progression.achievements["shortage-recovered"]) return "shortage-recovered";
  if (!snapshot.tasks[hearthTasks.hall.id]?.completed.length) return "great-hall";
  return "ending";
}

function capacityHits(snapshot: Snapshot<number>): number {
  return ["food", "wood", "stone", "science", "herbs"].filter((id) => {
    const value = snapshot.resources[id] ?? 0;
    if (id === "food") return value === 40 + (snapshot.resources.storage ?? 0) * 40;
    if (id === "wood") return value === 40 + (snapshot.resources.storage ?? 0) * 30;
    if (id === "stone") return value === 30 + (snapshot.resources.storage ?? 0) * 30;
    return value === (id === "science" ? 500 : 100);
  }).length;
}
