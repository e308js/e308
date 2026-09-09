import type { GameDefinition } from "../model/definition.js";
import type { Snapshot, Transaction } from "../state/types.js";

export type AdvancementMode = "canonical" | "exact" | "approximate";
export type AdvancementFidelity = "canonical" | "validated-bulk" | "approximate";

export interface ApproximationBound {
  readonly methodId: string;
  readonly maximumAbsoluteError: number;
  readonly maximumRelativeError: number;
  readonly appliesTo: string;
}

export interface BulkPlanContext<N> {
  readonly definition: GameDefinition<N>;
  readonly snapshot: Snapshot<N>;
  readonly requestedSteps: number;
}

export type BulkPlanResult<N> =
  | {
      readonly eligible: false;
      readonly reason: string;
      readonly retryAfterCanonicalSteps?: number;
    }
  | {
      readonly eligible: true;
      readonly steps: number;
      readonly apply: (transaction: Transaction<N>) => void;
    };

export interface BulkCapability<N> {
  readonly id: string;
  readonly version: string;
  readonly fidelity: "validated-bulk" | "approximate";
  readonly dependencies: readonly string[];
  readonly approximation?: ApproximationBound;
  plan(context: BulkPlanContext<N>): BulkPlanResult<N>;
}

export interface AdvancementLimits {
  readonly maximumWork: number;
  readonly maximumBulkBatches: number;
}

export interface AdvancementOptions<N> {
  readonly mode?: AdvancementMode;
  readonly limits: AdvancementLimits;
  readonly capabilities?: readonly BulkCapability<N>[];
}

export interface AdvancementSegment {
  readonly kind: "canonical" | "bulk";
  readonly fidelity: AdvancementFidelity;
  readonly capabilityId?: string;
  readonly capabilityVersion?: string;
  readonly approximation?: ApproximationBound;
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly steps: number;
  readonly gameMs: number;
}

export interface AdvancementReport<N> {
  readonly status: "completed" | "pending" | "failed";
  readonly mode: AdvancementMode;
  readonly fidelity: AdvancementFidelity;
  readonly snapshot: Snapshot<N>;
  readonly requestedRealMs: number;
  readonly processedRealMs: number;
  readonly pendingRealMs: number;
  readonly workUsed: number;
  readonly canonicalSteps: number;
  readonly bulkSteps: number;
  readonly diagnostics: readonly string[];
  readonly segments: readonly AdvancementSegment[];
  readonly error?: string;
}

export interface BacklogResult<N> extends AdvancementReport<N> {
  readonly backlogMs: number;
}

export interface AdvanceBacklog<N> {
  readonly pendingMs: number;
  add(elapsedMs: number): { readonly ok: true } | { readonly ok: false; readonly reason: string };
  process(options: AdvancementOptions<N>): BacklogResult<N>;
}

export interface ProfileOptions<N> {
  readonly fixtureId: string;
  readonly fixtureVersion: string;
  readonly label: "cold" | "warm";
  readonly repetitions: number;
  readonly elapsedMs: number;
  readonly definition: GameDefinition<N>;
  readonly createGame: () => import("../state/types.js").Game<N>;
  readonly advancement: AdvancementOptions<N>;
  readonly now: () => number;
}

export interface ProfileReport {
  readonly fixtureId: string;
  readonly fixtureVersion: string;
  readonly label: "cold" | "warm";
  readonly mode: AdvancementMode;
  readonly repetitions: number;
  readonly gameDurationMs: number;
  readonly elapsed: {
    readonly medianMs: number;
    readonly p95Ms: number;
    readonly maximumMs: number;
  };
  readonly throughputGameMsPerWallMs: number | null;
  readonly longestBatchGameMs: number;
  readonly canonicalSteps: number;
  readonly bulkSteps: number;
  readonly pendingMs: number;
}
