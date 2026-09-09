import type {
  BotPolicy,
  HarnessLimits,
  HarnessReport,
  HarnessScenario,
  HarnessValue,
  SessionSegment,
} from "../testing/types.js";

export interface SweepParameterCase<P extends Readonly<Record<string, HarnessValue>>> {
  readonly id: string;
  readonly parameters: P;
}

export interface SweepOptions<
  N,
  O extends HarnessValue,
  I extends HarnessValue,
  P extends Readonly<Record<string, HarnessValue>>,
> {
  readonly cases: readonly SweepParameterCase<P>[];
  readonly seeds: readonly { readonly gameSeed: string; readonly botSeed: string }[];
  readonly policies: readonly BotPolicy<O, I>[];
  readonly createScenario: (parameters: P) => HarnessScenario<N, O, I>;
  readonly goalId: string;
  readonly decisionCadenceMs: number;
  readonly schedule: readonly SessionSegment[];
  readonly limits: HarnessLimits;
  readonly replayCommand: (
    caseId: string,
    gameSeed: string,
    botSeed: string,
    policyId: string,
  ) => string;
}

export type SweepResult<I extends HarnessValue> =
  | {
      readonly kind: "valid";
      readonly caseId: string;
      readonly pairedKey: string;
      readonly report: HarnessReport<I>;
    }
  | { readonly kind: "invalid"; readonly caseId: string; readonly message: string };

export interface BaselineThresholds {
  readonly milestoneRelative?: number;
  readonly actionAttemptsRelative?: number;
}

export interface BaselineComparison {
  readonly paired: boolean;
  readonly baseline: { readonly contentVersion: string; readonly outcome: string };
  readonly current: { readonly contentVersion: string; readonly outcome: string };
  readonly milestones: Readonly<
    Record<string, { readonly absoluteMs: number; readonly relative: number | null }>
  >;
  readonly actionAttempts: { readonly absolute: number; readonly relative: number | null };
  readonly newlyReached: boolean;
  readonly newlyUnreached: boolean;
  readonly newStall: boolean;
  readonly findings: readonly string[];
}
