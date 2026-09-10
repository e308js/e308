import type { GameDefinition } from "../model/definition.js";
import type { Command, CommandFailure, Game, Snapshot } from "../state/types.js";

export type HarnessValue =
  | null
  | boolean
  | number
  | string
  | readonly HarnessValue[]
  | {
      readonly [key: string]: HarnessValue;
    };

export interface ConstraintEvidence {
  readonly kind:
    | "insufficient-input"
    | "capacity"
    | "prerequisite"
    | "allocation"
    | "automation-disabled"
    | "policy"
    | "task-blocked"
    | "other";
  readonly id: string;
  readonly detail: string;
}

export interface LegalActionQuote<I extends HarnessValue> {
  readonly id: string;
  readonly revision: string;
  readonly intent: I;
  readonly legal: boolean;
  readonly useful: boolean;
  readonly rank?: number;
  readonly effects?: readonly LegalActionEffect[];
  readonly constraints: readonly ConstraintEvidence[];
}

export type LegalActionEffect = "progression-reset";

export type PressureRelief =
  | { readonly kind: "action"; readonly actionId: string }
  | { readonly kind: "investment"; readonly actionId: string; readonly estimatedMs: number }
  | { readonly kind: "passive"; readonly estimatedMs: number };

export interface PlayabilityPressure {
  readonly id: string;
  readonly kind: "capacity" | "prerequisite" | "throughput" | "other";
  readonly active: boolean;
  readonly detail: string;
  readonly relief: readonly PressureRelief[];
}

export interface BarrierCertificate {
  readonly id: string;
  readonly proofScope: string;
  readonly assumptions: readonly string[];
  readonly constraints: readonly ConstraintEvidence[];
}

export type GoalEvaluation =
  | { readonly kind: "reached" }
  | { readonly kind: "pending"; readonly constraints: readonly ConstraintEvidence[] }
  | { readonly kind: "certified-barrier"; readonly certificate: BarrierCertificate };

export interface HarnessGoal<N> {
  readonly id: string;
  evaluate(snapshot: Snapshot<N>): GoalEvaluation;
}

export interface AwayResult<N> {
  readonly snapshot: Snapshot<N>;
  readonly fidelity: "canonical" | "validated-bulk" | "approximate" | "custom-reward";
  readonly discardedRealMs: number;
  readonly bankedRealMs: number;
}

export interface HarnessAdvanceResult<N> {
  readonly snapshot: Snapshot<N>;
  readonly fidelity: "canonical" | "validated-bulk";
}

export interface HarnessScenario<N, O extends HarnessValue, I extends HarnessValue> {
  readonly id: string;
  readonly contentVersion: string;
  readonly contentDigest: string;
  readonly parameters: Readonly<Record<string, HarnessValue>>;
  readonly definition: GameDefinition<N>;
  readonly goals: readonly HarnessGoal<N>[];
  create(gameSeed: string): Game<N>;
  observe(snapshot: Snapshot<N>): O;
  quote(snapshot: Snapshot<N>): readonly LegalActionQuote<I>[];
  quoteAll?(snapshot: Snapshot<N>): readonly LegalActionQuote<I>[];
  command(intent: I, snapshot: Snapshot<N>): Command<N>;
  sample(snapshot: Snapshot<N>): Readonly<Record<string, string>>;
  milestones(snapshot: Snapshot<N>): readonly string[];
  pressures?(snapshot: Snapshot<N>): readonly PlayabilityPressure[];
  diagnostics(
    before: Snapshot<N>,
    after: Snapshot<N>,
  ): { readonly overflow: number; readonly resetRecoveries: number; readonly taskBlocks: number };
  advanceTime?(game: Game<N>, durationMs: number): HarnessAdvanceResult<N>;
  advanceAway?(game: Game<N>, durationMs: number): AwayResult<N>;
}

export type SessionKind = "active" | "idle-open" | "absent";

export interface SessionSegment {
  readonly kind: SessionKind;
  readonly durationMs: number;
}

export interface BotDecision {
  readonly kind: "action" | "wait";
  readonly actionId?: string;
  readonly reason?: string;
}

export interface BotContext<O extends HarnessValue, I extends HarnessValue> {
  readonly observation: O;
  readonly quotes: readonly LegalActionQuote<I>[];
  readonly goalId: string;
  readonly realTimeMs: number;
  readonly decision: number;
  readonly random: () => number;
}

export interface BotPolicy<O extends HarnessValue, I extends HarnessValue> {
  readonly id: string;
  readonly version: string;
  decide(context: BotContext<O, I>): BotDecision;
}

export interface HarnessLimits {
  readonly maximumDecisions: number;
  readonly maximumTraceEntries: number;
  readonly maximumSamples: number;
  readonly sampleCadenceMs: number;
}

export interface HarnessRunOptions<N, O extends HarnessValue, I extends HarnessValue> {
  readonly scenario: HarnessScenario<N, O, I>;
  readonly policy: BotPolicy<O, I>;
  readonly gameSeed: string;
  readonly botSeed: string;
  readonly goalId: string;
  readonly decisionCadenceMs: number;
  readonly maximumImmediateActions?: number;
  readonly actionSpace?: "guided" | "complete";
  readonly schedule: readonly SessionSegment[];
  readonly limits: HarnessLimits;
  readonly replayCommand: string;
}

export type UnreachedReason =
  | "policy-stall"
  | "observed-stall"
  | "schedule-ended"
  | "work-limit"
  | "invalid-configuration";

export interface HarnessTraceEntry<I extends HarnessValue> {
  readonly realTimeMs: number;
  readonly gameTimeMs: number;
  readonly actionId: string;
  readonly intent: I;
  readonly sourceRevision: string;
  readonly result: "success" | CommandFailure["code"] | "missing-quote" | "blocked";
}

export interface HarnessSample {
  readonly realTimeMs: number;
  readonly gameTimeMs: number;
  readonly values: Readonly<Record<string, string>>;
}

export interface HarnessReport<I extends HarnessValue = HarnessValue> {
  readonly schema: "e308-pacing-report";
  readonly schemaVersion: 4;
  readonly scenarioId: string;
  readonly contentVersion: string;
  readonly contentDigest: string;
  readonly parameters: Readonly<Record<string, HarnessValue>>;
  readonly simulationVersion: number;
  readonly stepMs: number;
  readonly numericAdapter: string;
  readonly numericImplementationVersion: string;
  readonly gameSeed: string;
  readonly botSeed: string;
  readonly policy: { readonly id: string; readonly version: string };
  readonly goalId: string;
  readonly schedule: readonly SessionSegment[];
  readonly decisionCadenceMs: number;
  readonly maximumImmediateActions: number;
  readonly actionSpace: "guided" | "complete";
  readonly limits: HarnessLimits;
  readonly outcome:
    | { readonly kind: "reached"; readonly atRealMs: number; readonly atGameMs: number }
    | { readonly kind: "certified-barrier"; readonly certificate: BarrierCertificate }
    | { readonly kind: "unreached"; readonly reason: UnreachedReason };
  readonly timing: {
    readonly realElapsedMs: number;
    readonly gameAdvancedMs: number;
    readonly activePlayerMs: number;
    readonly idleOpenMs: number;
    readonly absentMs: number;
    readonly discardedRealMs: number;
    readonly bankedRealMs: number;
    readonly fidelity: readonly AwayResult<never>["fidelity"][];
  };
  readonly actions: {
    readonly attempts: number;
    readonly successful: number;
    readonly decisions: number;
    readonly waits: number;
    readonly longestWaitMs: number;
  };
  readonly constraints: Readonly<Record<string, number>>;
  readonly playability: {
    readonly pressures: Readonly<Record<string, PressureMetric>>;
    readonly progression: ProgressionMetric;
    readonly actionCadence: ActionCadenceMetric;
  };
  readonly milestones: Readonly<
    Record<
      string,
      { readonly realTimeMs: number; readonly gameTimeMs: number; readonly activeTimeMs: number }
    >
  >;
  readonly diagnostics: {
    readonly overflow: number;
    readonly resetRecoveries: number;
    readonly taskBlocks: number;
  };
  readonly trace: readonly HarnessTraceEntry<I>[];
  readonly traceTruncated: number;
  readonly samples: readonly HarnessSample[];
  readonly samplesTruncated: number;
  readonly replayCommand: string;
}

export interface PressureMetric {
  readonly kind: PlayabilityPressure["kind"];
  readonly detail: string;
  readonly currentlyActive: boolean;
  readonly observedMs: number;
  readonly actionableMs: number;
  readonly savingMs: number;
  readonly passiveMs: number;
  readonly noReliefMs: number;
  readonly longestNoReliefMs: number;
  readonly maximumPassiveEstimateMs: number;
}

export interface PlayabilityThresholds {
  readonly maximumNoReliefMs: number;
  readonly maximumResetTransitionsAtSameGameTime?: number;
  readonly minimumChallengeDurationMs?: number;
  readonly minimumChallengeActions?: number;
  readonly maximumTickBoundStepMs?: number;
  readonly minimumTickBoundIntervals?: number;
  readonly minimumTickBoundFraction?: number;
}

export interface PlayabilityFinding {
  readonly code:
    | "brief-challenge"
    | "compressed-reset-chain"
    | "goal-deadlock"
    | "instant-challenge"
    | "low-interaction-challenge"
    | "slow-tick-action-loop"
    | "sustained-no-relief";
  readonly severity: "p0" | "p1";
  readonly pressureId: string | null;
  readonly detail: string;
}

export interface ProgressionMetric {
  readonly resetTransitions: number;
  readonly maximumResetTransitionsAtSameGameTime: number;
  readonly challengeEpisodes: readonly ChallengeEpisodeMetric[];
}

export interface ChallengeEpisodeMetric {
  readonly challengeId: string;
  readonly enteredAtRealMs: number;
  readonly enteredAtGameMs: number;
  readonly completedAtRealMs: number;
  readonly completedAtGameMs: number;
  readonly realDurationMs: number;
  readonly gameDurationMs: number;
  readonly activeDurationMs: number;
  readonly successfulActions: number;
  readonly completionGain: string;
}

export interface ActionCadenceMetric {
  readonly positiveIntervals: number;
  readonly oneStepIntervals: number;
  readonly oneStepFraction: number;
  readonly meanIntervalMs: number;
  readonly longestIntervalMs: number;
}
