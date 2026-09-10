import {
  createGame,
  type EternityQuantity,
  eternityNumbers,
  type Game,
  type Snapshot,
} from "@e308/core";
import type {
  ConstraintEvidence,
  HarnessScenario,
  HarnessValue,
  LegalActionQuote,
} from "@e308/core/testing";
import { cascadeDefinition } from "./definition.js";
import { cascadeBuyables, cascadeKit, encoded } from "./economy.js";
import { advanceCascadeOptimized } from "./optimization.js";
import {
  cascadeBalance,
  cascadeChallenges,
  cascadeChallengeTargets,
  nextCoreCost,
} from "./progression.js";
import { type CascadeActionIntent, cascadeCommand } from "./runtime.js";
import { completeCascadeQuotes } from "./scenario-actions.js";

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
    contentVersion: "1.3.0",
    contentDigest: "cascade-1.3.0-challenge-pacing-2026-09-10",
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
    quoteAll: (snapshot) => completeCascadeQuotes(snapshot, nextQuotes(snapshot, strategy)),
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
    advanceTime: advanceCascadeTime,
  };
}

function advanceCascadeTime(game: Game<EternityQuantity>, durationMs: number) {
  const report = advanceCascadeOptimized(game, durationMs, 10_000);
  if (report.status !== "completed")
    throw new TypeError(
      `Cascade harness advancement ${report.status}: ${report.error ?? "pending"}`,
    );
  if (report.fidelity === "approximate")
    throw new TypeError("Cascade exact harness advancement returned approximate fidelity");
  return { snapshot: report.snapshot, fidelity: report.fidelity } as const;
}

function nextQuotes(
  snapshot: Snapshot<EternityQuantity>,
  strategy: CascadeStrategy,
): readonly LegalActionQuote<CascadeActionIntent>[] {
  if (
    !greater(snapshot, "eternity-points", 0) &&
    eternityNumbers.cmp(
      snapshot.resources["condensed-cores"] as EternityQuantity,
      cascadeBalance.ascendRequirement,
    ) < 0
  ) {
    const coreCost = nextCoreCost(snapshot.resources["condensed-cores"] as EternityQuantity);
    if (
      eternityNumbers.cmp(snapshot.resources["infinity-points"] as EternityQuantity, coreCost) >= 0
    )
      return [legal(snapshot, "condense", { type: "prestige", id: "condense" })];
    return openingQuotes(snapshot, strategy);
  }
  if (snapshot.progression.automation["buy-tier-one"]?.enabled)
    return [
      legal(snapshot, "disable-dimension-auto", {
        type: "automation",
        id: "dimension",
        enabled: false,
      }),
    ];
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
        eternityNumbers.cmp(
          snapshot.resources["condensed-cores"] as EternityQuantity,
          cascadeBalance.ascendRequirement,
        ) >= 0,
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
    .map((buyable, index) => {
      const count = snapshot.purchaseCounts[buyable.id] as EternityQuantity;
      const remaining = 10 - (Number(encoded(count)) % 10);
      return { buyable, index, count, remaining };
    })
    .filter(({ count }) => eternityNumbers.cmp(count, q(10)) < 0);
  const ordered = strategy === "depth-first" ? [...pending].reverse() : pending;
  const currency = snapshot.resources.currency as EternityQuantity;
  const singleOnly = snapshot.progression.activeChallenges.includes("scarce-purchases");
  const group = singleOnly
    ? undefined
    : ordered.find(
        ({ buyable, count, remaining }) =>
          eternityNumbers.cmp(currency, buyable.curve.totalCost(count, q(remaining))) >= 0,
      );
  if (group)
    return legal(snapshot, `buy-group-tier-${group.index + 1}`, {
      type: "buy",
      tier: group.index + 1,
      count: group.remaining,
    });
  const single = ordered.find(
    ({ buyable, count }) => eternityNumbers.cmp(currency, buyable.curve.unitCost(count)) >= 0,
  );
  return single
    ? legal(snapshot, `buy-tier-${single.index + 1}`, {
        type: "buy",
        tier: single.index + 1,
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
  const targets = cascadeChallengeTargets[id as keyof typeof cascadeChallengeTargets];
  const target = targets?.at(-1);
  return (
    cascadeBuyables.every(
      (buyable) =>
        eternityNumbers.cmp(snapshot.purchaseCounts[buyable.id] as EternityQuantity, q(10)) >= 0,
    ) &&
    target !== undefined &&
    eternityNumbers.cmp(snapshot.resources.currency as EternityQuantity, target) >= 0
  );
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
    ...(intent.type === "prestige" ? { effects: ["progression-reset"] as const } : {}),
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
