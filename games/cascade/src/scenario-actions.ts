import type { EternityQuantity, Snapshot } from "@e308/core";
import {
  type CommandQuoteCandidate,
  type LegalActionQuote,
  quoteCommands,
} from "@e308/core/testing";
import { cascadeDefinition } from "./definition.js";
import { cascadeBuyables, cascadeKit, encoded } from "./economy.js";
import { cascadeChallenges } from "./progression.js";
import { type CascadeActionIntent, cascadeCommand } from "./runtime.js";

const q = cascadeKit.q;

export function completeCascadeQuotes(
  snapshot: Snapshot<EternityQuantity>,
  guided: readonly LegalActionQuote<CascadeActionIntent>[],
): readonly LegalActionQuote<CascadeActionIntent>[] {
  const preferred = new Set(
    guided.filter((quote) => quote.legal && quote.useful).map((quote) => quote.id),
  );
  const candidates = actionCandidates(snapshot).map((candidate) => ({
    ...candidate,
    useful: preferred.has(candidate.id),
    rank: preferred.has(candidate.id) ? 1_000 : (candidate.rank ?? 0),
  }));
  return quoteCommands(cascadeDefinition, snapshot, candidates, (intent) => cascadeCommand(intent));
}

function actionCandidates(
  snapshot: Snapshot<EternityQuantity>,
): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  return [
    ...purchaseCandidates(snapshot),
    ...prestigeCandidates(),
    ...challengeCandidates(),
    ...automationCandidates(snapshot),
    ...researchCandidates(snapshot),
  ];
}

function purchaseCandidates(
  snapshot: Snapshot<EternityQuantity>,
): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  return cascadeBuyables.flatMap((buyable, index) => {
    const tier = index + 1;
    const count = Number(encoded(snapshot.purchaseCounts[buyable.id] ?? q(0)));
    const remaining = 10 - (count % 10);
    return [
      { id: `buy-tier-${tier}`, intent: { type: "buy" as const, tier, count: 1 } },
      {
        id: `buy-group-tier-${tier}`,
        intent: { type: "buy" as const, tier, count: remaining },
      },
    ];
  });
}

function prestigeCandidates(): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  return (["collapse", "condense", "ascend"] as const).map((id) => ({
    id,
    intent: { type: "prestige" as const, id },
    effects: ["progression-reset"] as const,
  }));
}

function challengeCandidates(): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  return cascadeChallenges.flatMap((challenge) => [
    {
      id: `enter-${challenge.id}`,
      intent: { type: "challenge-enter" as const, id: challenge.id },
    },
    {
      id: `complete-${challenge.id}`,
      intent: { type: "challenge-complete" as const, id: challenge.id },
    },
    {
      id: `exit-${challenge.id}`,
      intent: { type: "challenge-exit" as const, id: challenge.id },
    },
  ]);
}

function automationCandidates(
  snapshot: Snapshot<EternityQuantity>,
): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  return (["dimension", "collapse"] as const).flatMap((id) => {
    const automationId = id === "dimension" ? "buy-tier-one" : "auto-collapse";
    const enabled = snapshot.progression.automation[automationId]?.enabled ?? false;
    return [
      {
        id: `enable-${id}-auto`,
        intent: { type: "automation" as const, id, enabled: true },
        useful: !enabled,
      },
      {
        id: `disable-${id}-auto`,
        intent: { type: "automation" as const, id, enabled: false },
        useful: enabled,
      },
    ];
  });
}

function researchCandidates(
  snapshot: Snapshot<EternityQuantity>,
): readonly CommandQuoteCandidate<CascadeActionIntent>[] {
  const speed = Number(encoded(snapshot.allocations.research?.speed ?? q(0)));
  const retention = Number(encoded(snapshot.allocations.research?.retention ?? q(0)));
  return [
    {
      id: "allocate-speed",
      intent: { type: "research", target: "speed", amount: speed + 1 },
    },
    {
      id: "allocate-retention",
      intent: { type: "research", target: "retention", amount: retention + 1 },
    },
    { id: "respec", intent: { type: "respec" }, useful: speed + retention > 0 },
    { id: "final-research", intent: { type: "final-research" } },
  ];
}
