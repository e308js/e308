import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import { formatEncoded, type TreeNodeView, type ViewNode } from "@e308/ux";
import { cascadeBuyables, cascadeKit, encoded } from "./economy.js";
import { cascadeBalance, cascadeChallenges, nextCoreCost } from "./progression.js";
import type { CascadeIntent } from "./runtime.js";
import { finalResearchAction } from "./view-research.js";

const q = cascadeKit.q;
const display = (value: EternityQuantity) => formatEncoded(encoded(value));

export function progressionTree(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity> {
  const nodes: TreeNodeView<CascadeIntent, EternityQuantity>[] = [
    resetNode(snapshot, "collapse", 100, 70, "currency", cascadeBalance.collapseRequirement),
    resetNode(
      snapshot,
      "condense",
      260,
      160,
      "infinity-points",
      cascadeBalance.firstCoreRequirement,
    ),
    resetNode(snapshot, "ascend", 420, 250, "condensed-cores", cascadeBalance.ascendRequirement),
    {
      id: "final",
      label: "Final research",
      x: 580,
      y: 340,
      action: finalResearchAction(snapshot),
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
  const actualRequirement =
    id === "condense"
      ? nextCoreCost(snapshot.resources["condensed-cores"] as EternityQuantity)
      : requirement;
  const tiersReady =
    id !== "collapse" ||
    cascadeBuyables.every(
      (buyable) =>
        eternityNumbers.cmp(snapshot.purchaseCounts[buyable.id] as EternityQuantity, q(10)) >= 0,
    );
  const challengesReady =
    id !== "ascend" ||
    cascadeChallenges.every(
      (challenge) =>
        eternityNumbers.cmp(
          snapshot.progression.challengeCompletions[challenge.id] ?? q(0),
          q(1),
        ) >= 0,
    );
  const enabled =
    eternityNumbers.cmp(available, actualRequirement) >= 0 && tiersReady && challengesReady;
  const reward = resetReward(snapshot, id);
  return {
    id,
    label: `${id} → ${display(reward)}`,
    x,
    y,
    action: {
      id,
      label: `${id} for ${display(reward)}`,
      enabled,
      intent: { type: "prestige", id },
      description: [
        {
          kind: "text",
          value:
            id === "collapse"
              ? "Requires 10 purchased generators in every tier. Infinity Points multiply production."
              : id === "condense"
                ? "Condensed Cores multiply production by ×4 each."
                : "Eternity Points multiply production by ×10 each and unlock final research.",
        },
      ],
      blockers: resetBlockers(
        id,
        resourceId,
        actualRequirement,
        available,
        tiersReady,
        challengesReady,
      ),
    },
  };
}

function resetReward(
  snapshot: Snapshot<EternityQuantity>,
  id: "collapse" | "condense" | "ascend",
): EternityQuantity {
  const math = requiredMath();
  if (id === "condense") return coreReward(snapshot, math);
  const source = snapshot.resources[id === "collapse" ? "currency" : "condensed-cores"];
  const requirement =
    id === "collapse" ? cascadeBalance.collapseRequirement : cascadeBalance.ascendRequirement;
  if (!source || eternityNumbers.cmp(source, requirement) < 0) return q(0);
  const exponent = id === "collapse" ? cascadeBalance.collapseExponent : q(1);
  let reward = eternityNumbers.floor(math.pow(eternityNumbers.div(source, requirement), exponent));
  if (id === "collapse") reward = softenedCollapseReward(snapshot, reward, math);
  return reward;
}

function coreReward(
  snapshot: Snapshot<EternityQuantity>,
  math: NonNullable<typeof eternityNumbers.transcendental>,
): EternityQuantity {
  const infinity = snapshot.resources["infinity-points"] as EternityQuantity;
  if (eternityNumbers.cmp(infinity, cascadeBalance.firstCoreRequirement) < 0) return q(0);
  const target = eternityNumbers.floor(
    math.log(
      eternityNumbers.div(infinity, cascadeBalance.firstCoreRequirement),
      cascadeBalance.coreCostBase,
    ),
  );
  const gain = eternityNumbers.add(
    eternityNumbers.sub(target, snapshot.resources["condensed-cores"] as EternityQuantity),
    q(1),
  );
  return eternityNumbers.cmp(gain, q(1)) < 0 ? q(1) : gain;
}

function softenedCollapseReward(
  snapshot: Snapshot<EternityQuantity>,
  baseReward: EternityQuantity,
  math: NonNullable<typeof eternityNumbers.transcendental>,
): EternityQuantity {
  let reward = baseReward;
  if (eternityNumbers.cmp(reward, cascadeBalance.collapseSoftcap.threshold) >= 0)
    reward = eternityNumbers.floor(
      eternityNumbers.mul(
        math.pow(reward, cascadeBalance.collapseSoftcap.power),
        math.pow(
          cascadeBalance.collapseSoftcap.threshold,
          eternityNumbers.sub(q(1), cascadeBalance.collapseSoftcap.power),
        ),
      ),
    );
  return eternityNumbers.mul(
    reward,
    eternityNumbers.add(q(1), snapshot.allocations.research?.retention ?? q(0)),
  );
}

function resetBlockers(
  id: "collapse" | "condense" | "ascend",
  resourceId: string,
  requirement: EternityQuantity,
  available: EternityQuantity,
  tiersReady: boolean,
  challengesReady: boolean,
) {
  const blockers = [];
  if (!tiersReady)
    blockers.push({ kind: "locked" as const, prerequisiteIds: ["10 generators in all 8 tiers"] });
  if (eternityNumbers.cmp(available, requirement) < 0)
    blockers.push({ kind: "insufficient" as const, resourceId, required: requirement, available });
  if (!challengesReady)
    blockers.push({ kind: "locked" as const, prerequisiteIds: ["all six challenge rewards"] });
  if (id === "collapse" && blockers.length === 0) return [];
  return blockers;
}

function requiredMath(): NonNullable<typeof eternityNumbers.transcendental> {
  const math = eternityNumbers.transcendental;
  if (!math) throw new TypeError("Cascade requires exponential number operations");
  return math;
}
