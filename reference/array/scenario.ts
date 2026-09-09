import { createGame, type Snapshot } from "@e308/core";
import {
  type CommandQuoteCandidate,
  type HarnessScenario,
  type HarnessValue,
  quoteCommands,
} from "@e308/core/testing";
import { type ArrayIntent, arrayCommand } from "./commands.js";
import { B_UPGRADE_SPECS } from "./constants.js";
import { arrayDefinition } from "./definition.js";
import { type ArrayQuantity, add, arrayNumbers, encode, mul, q, required } from "./math.js";
import { arrayBReward } from "./production.js";
import { advanceArrayAway } from "./runtime.js";

export interface ArrayObservation extends Readonly<Record<string, HarnessValue>> {
  readonly A: string;
  readonly B: string;
  readonly upgrades: number;
}

export const arrayProofSchedule = Object.freeze(
  Array.from({ length: 350 }, (_, index) => [
    { kind: "active" as const, durationMs: 16 },
    {
      kind: "absent" as const,
      durationMs: index < 100 ? 3_600_000 : 86_400_000,
    },
  ]).flat(),
);

export function arrayScenario(): HarnessScenario<ArrayQuantity, ArrayObservation, ArrayIntent> {
  return {
    id: "array-game-a-b",
    contentVersion: "0.4.2-a-b",
    contentDigest: "array-game-a-b-reference-2026-09-09",
    parameters: { endpoint: "1e180 A and 1e10 B" },
    definition: arrayDefinition,
    goals: [{ id: "b-era", evaluate: evaluateGoal }],
    create: () => createGame(arrayDefinition),
    observe: observe,
    quote: (snapshot) =>
      quoteCommands(arrayDefinition, snapshot, candidates(snapshot), (intent) =>
        arrayCommand(intent),
      ),
    command: (intent) => arrayCommand(intent),
    sample: (snapshot) => ({ A: resource(snapshot, "array-a"), B: resource(snapshot, "array-b") }),
    milestones: (snapshot) => [
      ...Object.keys(snapshot.progression.milestones),
      ...Object.keys(snapshot.progression.upgrades),
    ],
    diagnostics: (before, after) => ({
      overflow: 0,
      resetRecoveries: generationTotal(after) - generationTotal(before),
      taskBlocks: 0,
    }),
    advanceAway: (game, durationMs) => {
      const result = advanceArrayAway(game, durationMs);
      if (!result.ok) throw new TypeError(`Array away advance failed: ${result.error.code}`);
      return {
        snapshot: result.value,
        fidelity: "custom-reward",
        discardedRealMs: 0,
        bankedRealMs: 0,
      };
    },
  };
}

function candidates(
  snapshot: Snapshot<ArrayQuantity>,
): readonly CommandQuoteCandidate<ArrayIntent>[] {
  const prestige = prestigeUseful(snapshot);
  return [
    { id: "prestige-b", intent: { type: "prestige-b" }, useful: prestige, rank: 10_000 },
    ...B_UPGRADE_SPECS.map((upgrade, index) => ({
      id: `upgrade:${upgrade.id}`,
      intent: { type: "buy-b-upgrade" as const, id: upgrade.id },
      rank: 9_000 - index,
    })),
    { id: "boosterator", intent: { type: "buy-boosterator", mode: "max" }, rank: 8_000 },
    ...purchaseCandidates("buy-a-upgrade", 3, 7_000),
    ...generatorCandidates("B", 6_000),
    ...generatorCandidates("A", 5_000),
  ];
}

function purchaseCandidates(
  type: "buy-a-upgrade",
  count: number,
  rank: number,
): CommandQuoteCandidate<ArrayIntent>[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = count - offset - 1;
    return {
      id: `a-upgrade:${index + 1}`,
      intent: { type, index, mode: "max" },
      rank: rank - offset,
    };
  });
}

function generatorCandidates(
  family: "A" | "B",
  rank: number,
): CommandQuoteCandidate<ArrayIntent>[] {
  return Array.from({ length: 5 }, (_, offset) => {
    const tier = 5 - offset;
    return {
      id: `generator:${family}:${tier}`,
      intent: { type: "buy-generator", family, tier, mode: "max" },
      rank: rank - offset,
    };
  });
}

function prestigeUseful(snapshot: Snapshot<ArrayQuantity>): boolean {
  if (snapshot.progression.upgrades["passive-b"]) return false;
  const reward = arrayBReward({
    get: (resource) => required(snapshot.resources[resource.id], resource.id),
    getPurchase: (id) => snapshot.purchaseCounts[id] ?? q("0"),
  });
  const current = required(snapshot.resources["array-b"], "array-b");
  return arrayNumbers.cmp(reward, mul(add(current, q("1")), q("2"))) >= 0;
}

function evaluateGoal(snapshot: Snapshot<ArrayQuantity>) {
  const reached =
    arrayNumbers.cmp(required(snapshot.resources["array-a"], "array-a"), q("1e180")) >= 0 &&
    arrayNumbers.cmp(required(snapshot.resources["array-b"], "array-b"), q("1e10")) >= 0;
  return reached ? ({ kind: "reached" } as const) : ({ kind: "pending", constraints: [] } as const);
}

function observe(snapshot: Snapshot<ArrayQuantity>): ArrayObservation {
  return {
    A: resource(snapshot, "array-a"),
    B: resource(snapshot, "array-b"),
    upgrades: Object.keys(snapshot.progression.upgrades).length,
  };
}

function resource(snapshot: Snapshot<ArrayQuantity>, id: string): string {
  return encode(required(snapshot.resources[id], id));
}

function generationTotal(snapshot: Snapshot<ArrayQuantity>): number {
  return Object.values(snapshot.scopeGenerations).reduce((sum, value) => sum + Number(value), 0);
}
