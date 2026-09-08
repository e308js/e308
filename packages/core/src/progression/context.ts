import type { ReadContext } from "../economy/types.js";
import type { Transaction } from "../state/types.js";

export interface ProgressionContext<N> extends ReadContext<N> {
  hasUpgrade(id: string): boolean;
  hasMilestone(id: string): boolean;
  hasAchievement(id: string): boolean;
  isChallengeActive(id: string): boolean;
  challengeCompletions(id: string): N;
  purchaseCount(id: string): N;
}

export function progressionContext<N>(transaction: Transaction<N>): ProgressionContext<N> {
  return {
    get: (resource) => transaction.get(resource),
    getAllocation: (allocation, targetId) => transaction.getAllocation(allocation.id, targetId),
    hasUpgrade: (id) => transaction.hasProgress("upgrade", id),
    hasMilestone: (id) => transaction.hasProgress("milestone", id),
    hasAchievement: (id) => transaction.hasProgress("achievement", id),
    isChallengeActive: (id) => transaction.isChallengeActive(id),
    challengeCompletions: (id) => transaction.getChallengeCompletions(id),
    purchaseCount: (id) => transaction.getPurchase(id),
  };
}
