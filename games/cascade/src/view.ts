import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import { type ActionView, formatEncoded, type ViewDocument, type ViewNode } from "@e308/ux";
import {
  cascadeBuyables,
  cascadeKit,
  cascadeTiers,
  encoded,
  purchasedTierMultiplier,
} from "./economy.js";
import type { CascadeIntent } from "./runtime.js";
import { automationPanel } from "./view-automation.js";
import { challengePanel } from "./view-challenges.js";
import { researchPanel } from "./view-research.js";
import { progressionTree } from "./view-resets.js";

const q = cascadeKit.q;
const display = (value: EternityQuantity) => formatEncoded(encoded(value));

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
          { id: "challenges", label: "Challenges", content: challengePanel(snapshot) },
          { id: "research", label: "Research", content: researchPanel(snapshot) },
          { id: "automation", label: "Automation", content: automationPanel(snapshot) },
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
            value: `${display(count)} bought · ×${display(multiplier)} production · next ×${display(nextMultiplier)} at ${nextThreshold}`,
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
    count === 1
      ? `Buy Tier ${tier} generator`
      : `Buy ${count} → production ×${display(multiplier)}`;
  const tooltip =
    count === 1
      ? `Buy one Tier ${tier} generator.`
      : `Buy ${count} Tier ${tier} generators to reach the next group of ten and raise this tier's production multiplier to ×${display(multiplier)}.`;
  return {
    kind: "action",
    id: count === 1 ? `buy-${tier}` : `buy-group-${tier}`,
    action: {
      id: count === 1 ? `buy-${tier}` : `buy-group-${tier}`,
      label,
      tooltip,
      ...(count === 1
        ? {}
        : {
            description: [
              {
                kind: "text" as const,
                value: "Reach the next group of ten for this tier's multiplier.",
              },
            ],
          }),
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

function waitNode(snapshot: Snapshot<EternityQuantity>): ViewNode<CascadeIntent, EternityQuantity> {
  return {
    kind: "action",
    id: "wait",
    action: {
      ...simpleAction(
        "Advance one minute",
        { type: "advance", milliseconds: 60_000 },
        !snapshot.progression.won,
      ),
      id: "wait",
    },
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
