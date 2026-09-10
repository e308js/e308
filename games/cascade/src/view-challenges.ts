import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import type { ActionBlocker, GridCellView, ViewNode } from "@e308/ux";
import { cascadeKit, cascadeResources, encoded } from "./economy.js";
import { cascadeChallengeCopy, cascadeChallenges, cascadeChallengeTier } from "./progression.js";
import type { CascadeIntent } from "./runtime.js";

const q = cascadeKit.q;

export function challengePanel(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  return [challengeGrid(snapshot), ...activeChallengeControls(snapshot)];
}

function challengeGrid(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity> {
  const cells: GridCellView<CascadeIntent, EternityQuantity>[] = cascadeChallenges.map(
    (challenge, index) => challengeCell(snapshot, challenge, index),
  );
  return { kind: "grid", id: "challenge-grid", rows: 2, columns: 3, cells };
}

function challengeCell(
  snapshot: Snapshot<EternityQuantity>,
  challenge: (typeof cascadeChallenges)[number],
  index: number,
): GridCellView<CascadeIntent, EternityQuantity> {
  const active = snapshot.progression.activeChallenges.includes(challenge.id);
  const completions = snapshot.progression.challengeCompletions[challenge.id];
  const copy = cascadeChallengeCopy[challenge.id];
  const enabled = !active && canEnter(snapshot, challenge);
  return {
    id: challenge.id,
    row: Math.floor(index / 3) + 1,
    column: (index % 3) + 1,
    label: `${challenge.id.replaceAll("-", " ")} (${completions ? encoded(completions) : "0"}/${challenge.maxCompletions})`,
    action: {
      id: `challenge-enter:${challenge.id}`,
      label: active ? "Active" : "Enter challenge",
      description: [
        {
          kind: "text",
          value: copy ? `${copy.rule} ${copy.target} Reward: ${copy.reward}.` : challenge.id,
        },
      ],
      enabled,
      intent: { type: "challenge-enter", id: challenge.id },
      blockers: enabled ? [] : enterBlockers(snapshot, challenge.id, active),
    },
    ...(active ? { mark: { label: "active", tone: "warning" as const } } : {}),
  };
}

function activeChallengeControls(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  return snapshot.progression.activeChallenges.flatMap((id) => {
    const challenge = cascadeChallenges.find((entry) => entry.id === id);
    if (!challenge) return [];
    const currency = snapshot.resources.currency as EternityQuantity;
    const earned = cascadeChallengeTier(id, currency);
    const completed = snapshot.progression.challengeCompletions[id] ?? q(0);
    const canComplete = eternityNumbers.cmp(q(earned), completed) > 0;
    return [
      {
        kind: "action" as const,
        id: `challenge-complete:${id}`,
        action: {
          id: `challenge-complete:${id}`,
          label: `Claim ${id.replaceAll("-", " ")} reward`,
          enabled: canComplete,
          intent: { type: "challenge-complete" as const, id },
          blockers: canComplete
            ? []
            : [{ kind: "locked" as const, prerequisiteIds: ["challenge target"] }],
        },
      },
      {
        kind: "action" as const,
        id: `challenge-exit:${id}`,
        action: {
          id: `challenge-exit:${id}`,
          label: `Exit ${id.replaceAll("-", " ")}`,
          enabled: true,
          intent: { type: "challenge-exit" as const, id },
          blockers: [],
        },
      },
    ];
  });
}

function canEnter(
  snapshot: Snapshot<EternityQuantity>,
  challenge: (typeof cascadeChallenges)[number],
): boolean {
  if (eternityNumbers.cmp(snapshot.resources["infinity-points"] as EternityQuantity, q(1)) < 0)
    return false;
  return snapshot.progression.activeChallenges.every((id) => {
    const active = cascadeChallenges.find((entry) => entry.id === id);
    return (
      active?.compatibleGroup === challenge.compatibleGroup &&
      Boolean(active?.compatibleGroup) &&
      !active?.replacementKeys.some((key) => challenge.replacementKeys.includes(key))
    );
  });
}

function enterBlockers(
  snapshot: Snapshot<EternityQuantity>,
  id: string,
  active: boolean,
): ActionBlocker<EternityQuantity>[] {
  if (active) return [{ kind: "disabled", actionId: id, reasonKey: "already-active" }];
  const infinity = snapshot.resources[cascadeResources.infinity.id] as EternityQuantity;
  if (eternityNumbers.cmp(infinity, q(1)) < 0)
    return [
      {
        kind: "insufficient",
        resourceId: cascadeResources.infinity.id,
        required: q(1),
        available: infinity,
      },
    ];
  return [{ kind: "disabled", actionId: id, reasonKey: "challenge-conflict" }];
}
