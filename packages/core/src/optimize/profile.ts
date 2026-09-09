import { advanceOptimized } from "./advance.js";
import type { ProfileOptions, ProfileReport } from "./types.js";

export function profileAdvancement<N>(options: ProfileOptions<N>): ProfileReport {
  validateProfile(options);
  const durations: number[] = [];
  let processed = 0;
  let canonicalSteps = 0;
  let bulkSteps = 0;
  let pendingMs = 0;
  let longestBatchGameMs = 0;
  for (let run = 0; run < options.repetitions; run += 1) {
    const game = options.createGame();
    const started = options.now();
    const report = advanceOptimized(
      game,
      options.definition,
      options.elapsedMs,
      options.advancement,
    );
    const ended = options.now();
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started)
      throw new TypeError("Profile clock must be finite and monotonic");
    durations.push(ended - started);
    processed += report.processedRealMs;
    canonicalSteps = Math.max(canonicalSteps, report.canonicalSteps);
    bulkSteps = Math.max(bulkSteps, report.bulkSteps);
    pendingMs = Math.max(pendingMs, report.pendingRealMs);
    longestBatchGameMs = Math.max(
      longestBatchGameMs,
      ...report.segments.map((segment) => segment.gameMs),
    );
  }
  const ordered = durations.toSorted((left, right) => left - right);
  const elapsedTotal = durations.reduce((sum, value) => sum + value, 0);
  return {
    fixtureId: options.fixtureId,
    fixtureVersion: options.fixtureVersion,
    label: options.label,
    mode: options.advancement.mode ?? "exact",
    repetitions: options.repetitions,
    gameDurationMs: options.elapsedMs,
    elapsed: {
      medianMs: percentile(ordered, 0.5),
      p95Ms: percentile(ordered, 0.95),
      maximumMs: ordered.at(-1) ?? 0,
    },
    throughputGameMsPerWallMs: elapsedTotal === 0 ? null : processed / elapsedTotal,
    longestBatchGameMs,
    canonicalSteps,
    bulkSteps,
    pendingMs,
  };
}

function percentile(ordered: readonly number[], rank: number): number {
  return ordered[Math.ceil(rank * ordered.length) - 1] ?? 0;
}

function validateProfile<N>(options: ProfileOptions<N>): void {
  if (!Number.isSafeInteger(options.repetitions) || options.repetitions < 1)
    throw new TypeError("Profile repetitions must be a positive safe integer");
  if (!Number.isSafeInteger(options.elapsedMs) || options.elapsedMs < 0)
    throw new TypeError("Profile elapsed time must be a nonnegative safe integer");
}
