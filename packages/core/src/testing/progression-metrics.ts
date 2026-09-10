import type { NumericAdapter } from "../numbers/types.js";
import type { Snapshot } from "../state/types.js";
import type { HarnessTotals } from "./run-state.js";
import type { HarnessValue, LegalActionQuote } from "./types.js";

export function recordActionCadence<I extends HarnessValue>(
  totals: HarnessTotals<I>,
  gameTimeMs: number,
  stepMs: number,
): void {
  const previous = totals.lastSuccessfulActionGameMs;
  totals.lastSuccessfulActionGameMs = gameTimeMs;
  if (previous === null || gameTimeMs <= previous) return;
  const interval = gameTimeMs - previous;
  totals.positiveActionIntervals += 1;
  totals.totalActionIntervalMs += interval;
  totals.longestActionIntervalMs = Math.max(totals.longestActionIntervalMs, interval);
  if (interval === stepMs) totals.oneStepActionIntervals += 1;
}

export function recordResetTransition<N, I extends HarnessValue>(
  totals: HarnessTotals<I>,
  before: Snapshot<N>,
  after: Snapshot<N>,
  quote: LegalActionQuote<I>,
): void {
  if (!quote.effects?.includes("progression-reset")) return;
  const scopeIds = new Set([
    ...Object.keys(before.scopeGenerations),
    ...Object.keys(after.scopeGenerations),
  ]);
  if (
    ![...scopeIds].some(
      (id) => (after.scopeGenerations[id] ?? 0) > (before.scopeGenerations[id] ?? 0),
    )
  )
    return;
  totals.resetTransitions += 1;
  totals.currentResetBurst =
    totals.lastResetGameMs === after.gameTimeMs ? totals.currentResetBurst + 1 : 1;
  totals.lastResetGameMs = after.gameTimeMs;
  totals.maximumResetBurst = Math.max(totals.maximumResetBurst, totals.currentResetBurst);
}

export function recordChallengeTransitions<N, I extends HarnessValue>(options: {
  readonly totals: HarnessTotals<I>;
  readonly before: Snapshot<N>;
  readonly after: Snapshot<N>;
  readonly numbers: NumericAdapter<N>;
  readonly successfulActions: number;
}): void {
  const { totals, before, after, numbers, successfulActions } = options;
  const beforeActive = new Set(before.progression.activeChallenges);
  const afterActive = new Set(after.progression.activeChallenges);
  for (const challengeId of afterActive) {
    if (beforeActive.has(challengeId)) continue;
    totals.activeChallengeEpisodes.set(challengeId, {
      challengeId,
      enteredAtRealMs: totals.real,
      enteredAtGameMs: after.gameTimeMs,
      enteredAtActiveMs: totals.active,
      successfulActionsBefore: successfulActions,
    });
  }
  for (const challengeId of new Set([
    ...Object.keys(before.progression.challengeCompletions),
    ...Object.keys(after.progression.challengeCompletions),
  ])) {
    const previous = before.progression.challengeCompletions[challengeId] ?? numbers.fromNumber(0);
    const current = after.progression.challengeCompletions[challengeId] ?? numbers.fromNumber(0);
    if (numbers.cmp(current, previous) <= 0) continue;
    const episode = totals.activeChallengeEpisodes.get(challengeId);
    if (!episode) continue;
    totals.challengeEpisodes.push({
      challengeId,
      enteredAtRealMs: episode.enteredAtRealMs,
      enteredAtGameMs: episode.enteredAtGameMs,
      completedAtRealMs: totals.real,
      completedAtGameMs: after.gameTimeMs,
      realDurationMs: totals.real - episode.enteredAtRealMs,
      gameDurationMs: after.gameTimeMs - episode.enteredAtGameMs,
      activeDurationMs: totals.active - episode.enteredAtActiveMs,
      successfulActions: successfulActions - episode.successfulActionsBefore,
      completionGain: numbers.codec.serialize(numbers.sub(current, previous)),
    });
    totals.activeChallengeEpisodes.delete(challengeId);
    if (afterActive.has(challengeId))
      totals.activeChallengeEpisodes.set(challengeId, {
        challengeId,
        enteredAtRealMs: totals.real,
        enteredAtGameMs: after.gameTimeMs,
        enteredAtActiveMs: totals.active,
        successfulActionsBefore: successfulActions,
      });
  }
  for (const challengeId of beforeActive) {
    if (!afterActive.has(challengeId)) totals.activeChallengeEpisodes.delete(challengeId);
  }
}
