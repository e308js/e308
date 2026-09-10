import type { Snapshot } from "../state/types.js";
import { pressureReport } from "./playability.js";
import type { HarnessTotals } from "./run-state.js";
import type {
  GoalEvaluation,
  HarnessReport,
  HarnessRunOptions,
  HarnessValue,
  LegalActionQuote,
} from "./types.js";

export function buildHarnessReport<N, O extends HarnessValue, I extends HarnessValue>(options: {
  readonly run: HarnessRunOptions<N, O, I>;
  readonly totals: HarnessTotals<I>;
  readonly snapshot: Snapshot<N>;
  readonly initialGameMs: number;
  readonly reached: HarnessReport<I>["outcome"] | undefined;
  readonly evaluation: GoalEvaluation;
  readonly quotes: readonly LegalActionQuote<I>[];
}): HarnessReport<I> {
  const { run, totals, snapshot } = options;
  const definition = run.scenario.definition;
  if (!definition.numbers) throw new TypeError("Harness definition has no numeric adapter");
  return {
    schema: "e308-pacing-report",
    schemaVersion: 4,
    scenarioId: run.scenario.id,
    contentVersion: run.scenario.contentVersion,
    contentDigest: run.scenario.contentDigest,
    parameters: run.scenario.parameters,
    simulationVersion: definition.simulationVersion,
    stepMs: definition.stepMs,
    numericAdapter: definition.numbers.id,
    numericImplementationVersion: definition.numbers.implementationVersion,
    gameSeed: run.gameSeed,
    botSeed: run.botSeed,
    policy: { id: run.policy.id, version: run.policy.version },
    goalId: run.goalId,
    schedule: run.schedule,
    decisionCadenceMs: run.decisionCadenceMs,
    maximumImmediateActions:
      run.maximumImmediateActions ?? (run.actionSpace === "complete" ? 64 : 1),
    actionSpace: run.actionSpace ?? "guided",
    limits: run.limits,
    outcome:
      options.reached ?? finalOutcome(options.evaluation, options.quotes, totals.workLimited),
    timing: {
      realElapsedMs: totals.real,
      gameAdvancedMs: snapshot.gameTimeMs - options.initialGameMs,
      activePlayerMs: totals.active,
      idleOpenMs: totals.idle,
      absentMs: totals.absent,
      discardedRealMs: totals.discarded,
      bankedRealMs: totals.banked,
      fidelity: [...totals.fidelity],
    },
    actions: {
      attempts: totals.attempts,
      successful: totals.successful,
      decisions: totals.decisions,
      waits: totals.waits,
      longestWaitMs: totals.longestWait,
    },
    constraints: totals.constraints,
    playability: {
      pressures: pressureReport(totals.pressures),
      actionCadence: {
        positiveIntervals: totals.positiveActionIntervals,
        oneStepIntervals: totals.oneStepActionIntervals,
        oneStepFraction:
          totals.positiveActionIntervals === 0
            ? 0
            : totals.oneStepActionIntervals / totals.positiveActionIntervals,
        meanIntervalMs:
          totals.positiveActionIntervals === 0
            ? 0
            : totals.totalActionIntervalMs / totals.positiveActionIntervals,
        longestIntervalMs: totals.longestActionIntervalMs,
      },
      progression: {
        resetTransitions: totals.resetTransitions,
        maximumResetTransitionsAtSameGameTime: totals.maximumResetBurst,
        challengeEpisodes: totals.challengeEpisodes,
      },
    },
    milestones: totals.milestones,
    diagnostics: totals.diagnostics,
    trace: totals.trace,
    traceTruncated: totals.traceTruncated,
    samples: totals.samples,
    samplesTruncated: totals.samplesTruncated,
    replayCommand: run.replayCommand,
  };
}

function finalOutcome<I extends HarnessValue>(
  evaluation: GoalEvaluation,
  quotes: readonly LegalActionQuote<I>[],
  workLimited: boolean,
): HarnessReport<I>["outcome"] {
  if (evaluation.kind === "certified-barrier")
    return { kind: "certified-barrier", certificate: evaluation.certificate };
  if (workLimited) return { kind: "unreached", reason: "work-limit" };
  if (quotes.some((quote) => quote.legal && quote.useful))
    return { kind: "unreached", reason: "policy-stall" };
  if (quotes.length > 0) return { kind: "unreached", reason: "observed-stall" };
  return { kind: "unreached", reason: "schedule-ended" };
}
