import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import type { ActionView, GridCellView, TreeNodeView, ViewDocument, ViewNode } from "@e308/ux";
import {
  cascadeBuyables,
  cascadeKit,
  cascadeTiers,
  encoded,
  purchasedTierMultiplier,
} from "./economy.js";
import { cascadeChallenges } from "./progression.js";
import type { CascadeIntent } from "./runtime.js";

const q = cascadeKit.q;

export function cascadeView(
  snapshot: Snapshot<EternityQuantity>,
): ViewDocument<CascadeIntent, EternityQuantity> {
  return {
    title: "Cascade",
    activeScopeIds: ["run", "infinity", "eternity"],
    hotkeys: [
      {
        id: "advance",
        key: "w",
        description: "Advance one minute",
        enabled: !snapshot.progression.won,
        intent: { type: "advance", milliseconds: 60_000 },
        scopeId: "run",
      },
    ],
    content: [
      { kind: "heading", id: "title", level: 1, text: "Cascade" },
      {
        kind: "description",
        id: "instructions",
        content: [
          {
            kind: "text",
            value:
              "Buy producers from the bottom or the top, cross three reset scales, then combine challenge rewards into final research.",
          },
        ],
      },
      currencyStrip(snapshot),
      {
        kind: "tabs",
        id: "systems",
        tabs: [
          { id: "dimensions", label: "Dimensions", content: dimensionTable(snapshot) },
          { id: "resets", label: "Reset map", content: [progressionTree(snapshot)] },
          { id: "challenges", label: "Challenges", content: [challengeGrid(snapshot)] },
          { id: "research", label: "Research", content: researchPanel(snapshot) },
        ],
      },
      waitNode(snapshot),
      snapshot.progression.won
        ? {
            kind: "notification",
            id: "ending",
            text: "The final theorem stabilizes every cascade. Cascade is complete.",
            tone: "positive",
          }
        : { kind: "separator", id: "ending-boundary" },
      { kind: "save", id: "save-status", status: "clean", message: "Large-number save ready" },
    ],
  };
}

function currencyStrip(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity> {
  return {
    kind: "quantities",
    id: "currencies",
    lines: [
      "currency",
      "infinity-points",
      "condensed-cores",
      "eternity-points",
      "research-points",
      "singularity",
    ].map((id) => ({
      resourceId: id,
      label: id.replaceAll("-", " "),
      value: snapshot.resources[id] as EternityQuantity,
    })),
  };
}

function dimensionTable(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  return cascadeTiers.map((tier, index) => dimensionRow(snapshot, tier, index));
}

function dimensionRow(
  snapshot: Snapshot<EternityQuantity>,
  tier: (typeof cascadeTiers)[number],
  index: number,
): ViewNode<CascadeIntent, EternityQuantity> {
  const buyable = cascadeBuyables[index] as (typeof cascadeBuyables)[number];
  const count = snapshot.purchaseCounts[buyable.id] as EternityQuantity;
  const currency = snapshot.resources.currency as EternityQuantity;
  const remaining = 10 - (Number(encoded(count)) % 10);
  const multiplier = purchasedTierMultiplier(count);
  const nextMultiplier = eternityNumbers.mul(multiplier, q(2));
  const nextThreshold = Number(encoded(count)) + remaining;
  return {
    kind: "row",
    id: `tier-row-${index + 1}`,
    children: [
      {
        kind: "resource",
        id: tier.id,
        resource: {
          resourceId: tier.id,
          label: `Tier ${index + 1} generators`,
          value: snapshot.resources[tier.id] as EternityQuantity,
        },
      },
      {
        kind: "description",
        id: `tier-${index + 1}-multiplier`,
        content: [
          {
            kind: "text",
            value: `${encoded(count)} bought · ×${encoded(multiplier)} production · next ×${encoded(nextMultiplier)} at ${nextThreshold}`,
          },
        ],
      },
      purchaseNode(index, 1, buyable.curve.unitCost(count), currency, multiplier),
      purchaseNode(
        index,
        remaining,
        buyable.curve.totalCost(count, q(remaining)),
        currency,
        nextMultiplier,
      ),
    ],
  };
}

function purchaseNode(
  index: number,
  count: number,
  cost: EternityQuantity,
  currency: EternityQuantity,
  multiplier: EternityQuantity,
): ViewNode<CascadeIntent, EternityQuantity> {
  const enabled = eternityNumbers.cmp(currency, cost) >= 0;
  const tier = index + 1;
  const label =
    count === 1 ? `Buy Tier ${tier} generator` : `Buy ${count} for ×${encoded(multiplier)}`;
  return {
    kind: "action",
    id: count === 1 ? `buy-${tier}` : `buy-group-${tier}`,
    action: {
      id: count === 1 ? `buy-${tier}` : `buy-group-${tier}`,
      label,
      enabled,
      intent: { type: "buy", tier, count },
      blockers: enabled
        ? []
        : [{ kind: "insufficient", resourceId: "currency", required: cost, available: currency }],
      costs: [{ resourceId: "currency", label: "Currency", value: cost }],
      ...(count === 1 ? { hold: { intent: { type: "buy" as const, tier, count } } } : {}),
    },
  };
}

function progressionTree(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity> {
  const nodes: TreeNodeView<CascadeIntent, EternityQuantity>[] = [
    resetNode(snapshot, "collapse", 100, 70, "currency", q("1e6")),
    resetNode(snapshot, "condense", 260, 160, "infinity-points", q(5)),
    resetNode(snapshot, "ascend", 420, 250, "condensed-cores", q(3)),
    {
      id: "final",
      label: "Final research",
      x: 580,
      y: 340,
      action: simpleAction("Final research", { type: "final-research" }, !snapshot.progression.won),
      ...(snapshot.progression.won ? { highlight: "prestige" as const } : {}),
    },
  ];
  return {
    kind: "tree",
    id: "progression-tree",
    nodes,
    branches: [
      { from: "collapse", to: "condense" },
      { from: "condense", to: "ascend" },
      { from: "ascend", to: "final", dashed: true },
    ],
  };
}

function resetNode(
  snapshot: Snapshot<EternityQuantity>,
  id: "collapse" | "condense" | "ascend",
  x: number,
  y: number,
  resourceId: string,
  requirement: EternityQuantity,
): TreeNodeView<CascadeIntent, EternityQuantity> {
  const available = snapshot.resources[resourceId] as EternityQuantity;
  const enabled = eternityNumbers.cmp(available, requirement) >= 0;
  return {
    id,
    label: id,
    x,
    y,
    action: {
      ...simpleAction(id, { type: "prestige", id }, enabled),
      blockers: enabled
        ? []
        : [{ kind: "insufficient", resourceId, required: requirement, available }],
    },
  };
}

function challengeGrid(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity> {
  const cells: GridCellView<CascadeIntent, EternityQuantity>[] = cascadeChallenges.map(
    (challenge, index) => {
      const active = snapshot.progression.activeChallenges.includes(challenge.id);
      const completions = snapshot.progression.challengeCompletions[challenge.id];
      return {
        id: challenge.id,
        row: Math.floor(index / 3) + 1,
        column: (index % 3) + 1,
        label: `${challenge.id.replaceAll("-", " ")} (${completions ? encoded(completions) : "0"})`,
        action: simpleAction(
          active ? "Complete" : "Enter",
          active
            ? { type: "challenge-complete", id: challenge.id }
            : { type: "challenge-enter", id: challenge.id },
          true,
        ),
        ...(active ? { mark: { label: "active", tone: "warning" as const } } : {}),
      };
    },
  );
  return { kind: "grid", id: "challenge-grid", rows: 2, columns: 3, cells };
}

function researchPanel(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  const points = snapshot.resources["research-points"] as EternityQuantity;
  const maximum = Math.min(10, Number(encoded(points)) || 0);
  return [
    {
      kind: "range-input",
      id: "research-speed",
      label: "Speed research",
      value: Number(encoded(snapshot.allocations.research?.speed ?? q(0))),
      min: 0,
      max: maximum,
      step: 1,
      intent: (amount) => ({ type: "research", target: "speed", amount }),
    },
    {
      kind: "action",
      id: "respec",
      action: simpleAction("Respec all research", { type: "respec" }, true),
    },
  ];
}

function waitNode(snapshot: Snapshot<EternityQuantity>): ViewNode<CascadeIntent, EternityQuantity> {
  return {
    kind: "action",
    id: "wait",
    action: simpleAction(
      "Advance one minute",
      { type: "advance", milliseconds: 60_000 },
      !snapshot.progression.won,
    ),
  };
}

function simpleAction(
  label: string,
  intent: CascadeIntent,
  enabled: boolean,
): ActionView<CascadeIntent, EternityQuantity> {
  return {
    id: label.toLowerCase().replaceAll(" ", "-"),
    label,
    enabled,
    intent,
    blockers: enabled ? [] : [{ kind: "disabled", actionId: label, reasonKey: "unavailable" }],
  };
}
