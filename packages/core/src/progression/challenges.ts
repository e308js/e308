import type { Scope } from "../model/handles.js";
import type { Command, Transaction } from "../state/types.js";
import type { ProgressionContext } from "./context.js";
import { progressionContext } from "./context.js";
import type { ResetManifest } from "./resets.js";

export interface ChallengeDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly compatibleGroup?: string;
  readonly countsAs: readonly string[];
  readonly replacementKeys: readonly string[];
  readonly maxCompletions: number;
  readonly enterReset: ResetManifest<N>;
  readonly exitReset: ResetManifest<N>;
  readonly canEnter: (state: ProgressionContext<N>) => boolean;
  readonly completionsEarned: (state: ProgressionContext<N>) => number;
  readonly grantReward?: (transaction: Transaction<N>, tier: number) => void;
}

export function enterChallengeCommand<N>(
  challenge: ChallengeDefinition<N>,
  catalog: readonly ChallengeDefinition<N>[],
): Command<N> {
  return {
    id: `challenge:enter:${challenge.id}`,
    execute: (transaction) => enterChallenge(challenge, catalog, transaction),
  };
}

export function completeChallengeCommand<N>(challenge: ChallengeDefinition<N>): Command<N> {
  return {
    id: `challenge:complete:${challenge.id}`,
    execute: (transaction) => completeChallenge(challenge, transaction),
  };
}

export function exitChallengeCommand<N>(challenge: ChallengeDefinition<N>): Command<N> {
  return {
    id: `challenge:exit:${challenge.id}`,
    execute: (transaction) => {
      if (!transaction.isScopeActive(challenge.scope))
        transaction.reject({
          code: "disabled",
          actionId: challenge.id,
          reasonKey: "scope-inactive",
        });
      if (!transaction.isChallengeActive(challenge.id))
        transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "not-active" });
      transaction.reset(challenge.exitReset);
      transaction.setChallengeActive(challenge.id, false);
    },
  };
}

export function challengeCountsAs<N>(
  transaction: Transaction<N>,
  catalog: readonly ChallengeDefinition<N>[],
  challengeId: string,
): boolean {
  return catalog.some(
    (challenge) =>
      transaction.isChallengeActive(challenge.id) &&
      (challenge.id === challengeId || challenge.countsAs.includes(challengeId)),
  );
}

function enterChallenge<N>(
  challenge: ChallengeDefinition<N>,
  catalog: readonly ChallengeDefinition<N>[],
  transaction: Transaction<N>,
): void {
  if (!transaction.isScopeActive(challenge.scope))
    transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "scope-inactive" });
  if (transaction.isChallengeActive(challenge.id))
    transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "already-active" });
  if (!challenge.canEnter(progressionContext(transaction)))
    transaction.reject({ code: "locked", prerequisiteIds: [challenge.id] });
  for (const active of catalog.filter((item) => transaction.isChallengeActive(item.id))) {
    if (!compatible(challenge, active)) {
      transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "conflict" });
    }
  }
  transaction.reset(challenge.enterReset);
  transaction.setChallengeActive(challenge.id, true);
}

function compatible<N>(left: ChallengeDefinition<N>, right: ChallengeDefinition<N>): boolean {
  if (!left.compatibleGroup || left.compatibleGroup !== right.compatibleGroup) return false;
  return !left.replacementKeys.some((key) => right.replacementKeys.includes(key));
}

function completeChallenge<N>(
  challenge: ChallengeDefinition<N>,
  transaction: Transaction<N>,
): void {
  if (!transaction.isScopeActive(challenge.scope))
    transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "scope-inactive" });
  if (!transaction.isChallengeActive(challenge.id))
    transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "not-active" });
  const target = challenge.completionsEarned(progressionContext(transaction));
  if (!Number.isSafeInteger(target) || target < 0 || target > challenge.maxCompletions)
    throw new TypeError(`Challenge ${challenge.id} returned an invalid completion tier`);
  const current = transaction.getChallengeCompletions(challenge.id);
  const targetValue = transaction.numbers.fromNumber(target);
  if (transaction.numbers.cmp(targetValue, current) <= 0)
    transaction.reject({ code: "disabled", actionId: challenge.id, reasonKey: "no-new-tier" });
  for (let tier = 1; tier <= target; tier += 1) {
    if (transaction.numbers.cmp(current, transaction.numbers.fromNumber(tier)) >= 0) continue;
    const rewardId = `challenge:${challenge.id}:${tier}`;
    if (transaction.hasReward(rewardId)) continue;
    challenge.grantReward?.(transaction, tier);
    transaction.addReward(rewardId);
  }
  transaction.setChallengeCompletions(challenge.id, targetValue);
}
