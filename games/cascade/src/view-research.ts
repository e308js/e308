import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import type { ActionBlocker, ActionView, ViewNode } from "@e308/ux";
import { cascadeKit, encoded } from "./economy.js";
import { cascadeChallenges } from "./progression.js";
import type { CascadeIntent } from "./runtime.js";

const q = cascadeKit.q;

export function researchPanel(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  const points = Number(encoded(snapshot.resources["research-points"] as EternityQuantity)) || 0;
  const speed = allocation(snapshot, "speed");
  const retention = allocation(snapshot, "retention");
  return [
    {
      kind: "description",
      id: "research-explanation",
      content: [
        {
          kind: "text",
          value: `Speed multiplies all production by ×${speed + 1}. Infinity Yield multiplies Collapse rewards by ×${retention + 1}.`,
        },
      ],
    },
    allocationInput("speed", "Speed", speed, points, points - retention),
    allocationInput("retention", "Infinity yield", retention, points, points - speed),
    {
      kind: "action",
      id: "respec",
      action: {
        id: "respec",
        label: "Respec research",
        enabled: speed + retention > 0,
        intent: { type: "respec" },
        blockers:
          speed + retention > 0
            ? []
            : [{ kind: "disabled", actionId: "respec", reasonKey: "nothing-assigned" }],
      },
    },
    { kind: "action", id: "final-research-action", action: finalResearchAction(snapshot) },
  ];
}

export function finalResearchAction(
  snapshot: Snapshot<EternityQuantity>,
): ActionView<CascadeIntent, EternityQuantity> {
  const blockers = finalResearchBlockers(snapshot);
  return {
    id: "final-research",
    label: snapshot.progression.won ? "Final research complete" : "Complete final research",
    description: [
      {
        kind: "text",
        value:
          "Combine every challenge theorem, one Eternity Point, a singularity, and research in both branches.",
      },
    ],
    enabled: blockers.length === 0 && !snapshot.progression.won,
    intent: { type: "final-research" },
    blockers,
    costs: [{ resourceId: "eternity-points", label: "Eternity Points", value: q(1) }],
  };
}

function allocationInput(
  target: "speed" | "retention",
  label: string,
  value: number,
  maximum: number,
  allowedMax: number,
): ViewNode<CascadeIntent, EternityQuantity> {
  return {
    kind: "range-input",
    id: `research-${target}`,
    label,
    value,
    min: 0,
    max: maximum,
    allowedMax: Math.max(value, allowedMax),
    step: 1,
    showTicks: true,
    intent: (amount) => ({ type: "research", target, amount }),
  };
}

function finalResearchBlockers(
  snapshot: Snapshot<EternityQuantity>,
): ActionBlocker<EternityQuantity>[] {
  if (snapshot.progression.won)
    return [{ kind: "disabled", actionId: "final-research", reasonKey: "game-complete" }];
  const missing = cascadeChallenges
    .filter((challenge) => !snapshot.progression.challengeCompletions[challenge.id])
    .map((challenge) => challenge.id);
  if (eternityNumbers.cmp(snapshot.resources.singularity as EternityQuantity, q("1e308")) <= 0)
    missing.push("singularity");
  if (allocation(snapshot, "speed") < 1) missing.push("speed research");
  if (allocation(snapshot, "retention") < 1) missing.push("infinity yield research");
  const blockers: ActionBlocker<EternityQuantity>[] =
    missing.length > 0 ? [{ kind: "locked", prerequisiteIds: missing }] : [];
  const eternity = snapshot.resources["eternity-points"] as EternityQuantity;
  if (eternityNumbers.cmp(eternity, q(1)) < 0)
    blockers.push({
      kind: "insufficient",
      resourceId: "eternity-points",
      required: q(1),
      available: eternity,
    });
  return blockers;
}

function allocation(snapshot: Snapshot<EternityQuantity>, target: "speed" | "retention"): number {
  return Number(encoded(snapshot.allocations.research?.[target] ?? q(0)));
}
