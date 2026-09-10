import type {
  HarnessReport,
  HarnessValue,
  PlayabilityFinding,
  PlayabilityThresholds,
} from "./types.js";

export function assessProgression<I extends HarnessValue>(
  report: HarnessReport<I>,
  thresholds: PlayabilityThresholds,
): readonly PlayabilityFinding[] {
  const findings: PlayabilityFinding[] = [];
  const cadence = report.playability.actionCadence;
  if (
    thresholds.maximumTickBoundStepMs !== undefined &&
    report.stepMs > thresholds.maximumTickBoundStepMs &&
    cadence.oneStepIntervals >= (thresholds.minimumTickBoundIntervals ?? 10) &&
    cadence.oneStepFraction >= (thresholds.minimumTickBoundFraction ?? 0.5)
  )
    findings.push({
      code: "slow-tick-action-loop",
      severity: "p1",
      pressureId: null,
      detail: `${cadence.oneStepIntervals} action intervals waited exactly one ${report.stepMs} ms simulation step.`,
    });
  for (const episode of report.playability.progression.challengeEpisodes) {
    if (episode.gameDurationMs === 0)
      findings.push({
        code: "instant-challenge",
        severity: "p1",
        pressureId: episode.challengeId,
        detail: `${episode.challengeId} completed without advancing game time.`,
      });
    else if (
      thresholds.minimumChallengeDurationMs !== undefined &&
      episode.gameDurationMs < thresholds.minimumChallengeDurationMs
    )
      findings.push({
        code: "brief-challenge",
        severity: "p1",
        pressureId: episode.challengeId,
        detail: `${episode.challengeId} completed in ${episode.gameDurationMs} ms of game time.`,
      });
    if (
      thresholds.minimumChallengeActions !== undefined &&
      episode.successfulActions < thresholds.minimumChallengeActions
    )
      findings.push({
        code: "low-interaction-challenge",
        severity: "p1",
        pressureId: episode.challengeId,
        detail: `${episode.challengeId} completed after ${episode.successfulActions} successful actions.`,
      });
  }
  const maximumResetBurst = thresholds.maximumResetTransitionsAtSameGameTime;
  if (
    maximumResetBurst !== undefined &&
    report.playability.progression.maximumResetTransitionsAtSameGameTime > maximumResetBurst
  )
    findings.push({
      code: "compressed-reset-chain",
      severity: "p1",
      pressureId: null,
      detail: `${report.playability.progression.maximumResetTransitionsAtSameGameTime} reset transitions were available without advancing game time.`,
    });
  return findings;
}
