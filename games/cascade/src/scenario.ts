import { createGame, type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import type {
  ConstraintEvidence,
  HarnessScenario,
  HarnessValue,
  LegalActionQuote,
} from "@e308/core/testing";
import { cascadeDefinition } from "./definition.js";
import { cascadeBuyables, cascadeKit, encoded } from "./economy.js";
import { cascadeChallenges } from "./progression.js";
import { type CascadeActionIntent, cascadeCommand } from "./runtime.js";

export interface CascadeObservation extends Readonly<Record<string, HarnessValue>> {
  readonly currency: string;
  readonly infinity: string;
  readonly cores: string;
  readonly activeChallenges: readonly string[];
  readonly completedChallenges: readonly string[];
}

export type CascadeStrategy = "depth-first" | "reset-first";
const q = cascadeKit.q;

export function cascadeScenario(
  strategy: CascadeStrategy = "reset-first",
): HarnessScenario<EternityQuantity, CascadeObservation, CascadeActionIntent> {
  return {
    id: "cascade",
    contentVersion: "1.1.0",
    contentDigest: "cascade-1.1.0-connected-progression-2026-09-09",
    parameters: { strategy },
    definition: cascadeDefinition,
    goals: [
      {
        id: "final-research",
        evaluate: (snapshot) =>
          snapshot.progression.won
            ? { kind: "reached" }
            : { kind: "pending", constraints: pendingConstraints(snapshot) },
      },
    ],
    create: () => createGame(cascadeDefinition),
    observe: (snapshot) => ({
      currency: resource(snapshot, "currency"),
      infinity: resource(snapshot, "infinity-points"),
      cores: resource(snapshot, "condensed-cores"),
      activeChallenges: snapshot.progression.activeChallenges,
      completedChallenges: completedChallenges(snapshot),
    }),
    quote: (snapshot) => nextQuotes(snapshot, strategy),
    command: (intent) => cascadeCommand(intent),
    sample: (snapshot) => ({
      currency: resource(snapshot, "currency"),
      infinity: resource(snapshot, "infinity-points"),
      cores: resource(snapshot, "condensed-cores"),
      eternity: resource(snapshot, "eternity-points"),
      singularity: resource(snapshot, "singularity"),
    }),
    milestones: (snapshot) => [
      ...Object.keys(snapshot.progression.milestones),
      ...completedChallenges(snapshot).map((id) => `challenge:${id}`),
      ...(greater(snapshot, "eternity-points", 0) ? ["ascended"] : []),
      ...(snapshot.progression.won ? ["ending"] : []),
    ],
    diagnostics: (before, after) => ({
      overflow: 0,
      resetRecoveries:
        Object.values(after.scopeGenerations).reduce((sum, value) => sum + Number(value), 0) -
        Object.values(before.scopeGenerations).reduce((sum, value) => sum + Number(value), 0),
      taskBlocks: 0,
    }),
  };
}

function nextQuotes(
  snapshot: Snapshot<EternityQuantity>,
  strategy: CascadeStrategy,
): readonly LegalActionQuote<CascadeActionIntent>[] {
  if (!greater(snapshot, "infinity-points", 0)) return openingQuotes(snapshot, strategy);
  if (!greater(snapshot, "condensed-cores", 0)) {
    if (!snapshot.progression.automation["buy-tier-one"]?.enabled)
      return [
        legal(snapshot, "enable-dimension-auto", {
          type: "automation",
          id: "dimension",
          enabled: true,
        }),
      ];
    return [
      conditional(
        snapshot,
        "condense",
        { type: "prestige", id: "condense" },
        greater(snapshot, "infinity-points", 4),
        "five infinity points",
      ),
    ];
  }
  if (cascadeChallenges.some((challenge) => !isComplete(snapshot, challenge.id))) {
    if (snapshot.progression.automation["buy-tier-one"]?.enabled)
      return [
        legal(snapshot, "disable-dimension-auto", {
          type: "automation",
          id: "dimension",
          enabled: false,
        }),
      ];
    return challengeQuotes(snapshot);
  }
  if (!greater(snapshot, "eternity-points", 0))
    return [
      conditional(
        snapshot,
        "ascend",
        { type: "prestige", id: "ascend" },
        greater(snapshot, "condensed-cores", 2),
        "three condensed cores",
      ),
    ];
  const speed = snapshot.allocations.research?.speed ?? q(0);
  if (eternityNumbers.cmp(speed, q(1)) < 0)
    return [legal(snapshot, "allocate-speed", { type: "research", target: "speed", amount: 1 })];
  const retention = snapshot.allocations.research?.retention ?? q(0);
  if (eternityNumbers.cmp(retention, q(1)) < 0)
    return [
      legal(snapshot, "allocate-retention", {
        type: "research",
        target: "retention",
        amount: 1,
      }),
    ];
  return [legal(snapshot, "final-research", { type: "final-research" })];
}

function openingQuotes(
  snapshot: Snapshot<EternityQuantity>,
  strategy: CascadeStrategy,
): readonly LegalActionQuote<CascadeActionIntent>[] {
  const next = nextPurchase(snapshot, strategy);
  if (next) return [next];
  return [
    conditional(
      snapshot,
      "collapse",
      { type: "prestige", id: "collapse" },
      true,
      "all buy-ten milestones",
    ),
  ];
}

function nextPurchase(
  snapshot: Snapshot<EternityQuantity>,
  strategy: CascadeStrategy,
): LegalActionQuote<CascadeActionIntent> | undefined {
  const pending = cascadeBuyables
    .map((buyable, index) => ({ buyable, index }))
    .filter(
      ({ buyable }) =>
        eternityNumbers.cmp(snapshot.purchaseCounts[buyable.id] as EternityQuantity, q(10)) < 0,
    );
  const ordered = strategy === "depth-first" ? [...pending].reverse() : pending;
  const next = ordered.find(
    ({ buyable }) =>
      eternityNumbers.cmp(
        snapshot.resources.currency as EternityQuantity,
        buyable.curve.unitCost(snapshot.purchaseCounts[buyable.id] as EternityQuantity),
      ) >= 0,
  );
  return next
    ? legal(snapshot, `buy-tier-${next.index + 1}`, {
        type: "buy",
        tier: next.index + 1,
        count: 1,
      })
    : undefined;
}

function challengeQuotes(
  snapshot: Snapshot<EternityQuantity>,
): readonly LegalActionQuote<CascadeActionIntent>[] {
  const active = snapshot.progression.activeChallenges;
  const incomplete = cascadeChallenges.filter((challenge) => !isComplete(snapshot, challenge.id));
  if (incomplete.length === 0) return [];
  if (
    active.includes("scarce-purchases") &&
    !active.includes("automation-drought") &&
    !isComplete(snapshot, "automation-drought")
  )
    return [
      legal(snapshot, "enter-automation-drought", {
        type: "challenge-enter",
        id: "automation-drought",
      }),
    ];
  if (active.length === 0) {
    const next =
      incomplete.find((challenge) => challenge.id !== "automation-drought") ?? incomplete[0];
    return next
      ? [legal(snapshot, `enter-${next.id}`, { type: "challenge-enter", id: next.id })]
      : [];
  }
  const completable = active.filter(
    (id) => challengeTargetReached(snapshot, id) && !isComplete(snapshot, id),
  );
  if (completable[0])
    return [
      legal(snapshot, `complete-${completable[0]}`, {
        type: "challenge-complete",
        id: completable[0],
      }),
    ];
  const purchase = nextPurchase(snapshot, "reset-first");
  if (purchase) return [purchase];
  const completedActive = active.find((id) => isComplete(snapshot, id));
  if (completedActive)
    return [
      legal(snapshot, `exit-${completedActive}`, { type: "challenge-exit", id: completedActive }),
    ];
  return [];
}

function challengeTargetReached(snapshot: Snapshot<EternityQuantity>, id: string): boolean {
  const target =
    id === "slow-foundation"
      ? "1e12"
      : id === "composite-trial"
        ? "1e10"
        : id === "reset-pressure"
          ? "1e9"
          : id === "reversed-emphasis" || id === "automation-drought"
            ? "1e8"
            : "1e7";
  return eternityNumbers.cmp(snapshot.resources.currency as EternityQuantity, q(target)) >= 0;
}

function legal(
  snapshot: Snapshot<EternityQuantity>,
  id: string,
  intent: CascadeActionIntent,
): LegalActionQuote<CascadeActionIntent> {
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

function conditional(
  snapshot: Snapshot<EternityQuantity>,
  id: string,
  intent: CascadeActionIntent,
  allowed: boolean,
  detail: string,
): LegalActionQuote<CascadeActionIntent> {
  return {
    ...legal(snapshot, id, intent),
    legal: allowed,
    constraints: allowed ? [] : [{ kind: "insufficient-input", id, detail }],
  };
}

function isComplete(snapshot: Snapshot<EternityQuantity>, id: string): boolean {
  const value = snapshot.progression.challengeCompletions[id];
  return value !== undefined && eternityNumbers.cmp(value, q(1)) >= 0;
}

function completedChallenges(snapshot: Snapshot<EternityQuantity>): string[] {
  return cascadeChallenges
    .filter((challenge) => isComplete(snapshot, challenge.id))
    .map((challenge) => challenge.id);
}

function greater(snapshot: Snapshot<EternityQuantity>, id: string, value: number): boolean {
  return eternityNumbers.cmp(snapshot.resources[id] as EternityQuantity, q(value)) > 0;
}

function resource(snapshot: Snapshot<EternityQuantity>, id: string): string {
  return encoded(snapshot.resources[id] as EternityQuantity);
}

function pendingConstraints(snapshot: Snapshot<EternityQuantity>): ConstraintEvidence[] {
  const missing = cascadeChallenges.filter((challenge) => !isComplete(snapshot, challenge.id));
  return missing.map((challenge) => ({
    kind: "prerequisite",
    id: challenge.id,
    detail: "challenge reward required",
  }));
}
