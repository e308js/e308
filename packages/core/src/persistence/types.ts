import type { EventAudience, JsonValue } from "../domain/types.js";
import type { ContentModule } from "../model/modules.js";
import type { RandomStreamSnapshot, RandomStreamsSnapshot } from "../random/xoshiro.js";
import type { ProgressionEvent, Snapshot } from "../state/types.js";

export type ExcessTimePolicy = "discard" | "bank";

export interface ResolvedEntitlement {
  readonly policyVersion: string;
  readonly enabled: boolean;
  readonly capMs: number | null;
  readonly excess: ExcessTimePolicy;
}

export interface OfflineResourceReport {
  readonly id: string;
  readonly before: string;
  readonly after: string;
  readonly produced?: string;
}

export interface OfflineProgressEvent {
  readonly eventId: string;
  readonly kind: "upgrade" | "milestone" | "achievement" | "challenge-reward" | "win";
  readonly id: string;
  readonly atGameMs: number;
}

export interface OfflineReport {
  readonly sessionId: string;
  readonly elapsedRealMs: number;
  readonly eligibleRealMs: number;
  readonly processedRealMs: number;
  readonly pendingRealMs: number;
  readonly discardedRealMs: number;
  readonly bankedRealMs: number;
  readonly advancedGameMs: number;
  readonly fidelity: "canonical" | "validated-bulk" | "approximate" | "custom-reward";
  readonly resources: readonly OfflineResourceReport[];
  readonly progression: readonly OfflineProgressEvent[];
  readonly stopReason?: "choice" | "cancelled" | "error" | "budget-exceeded";
}

export interface CatchupSegment {
  readonly simulationVersion: number;
  readonly processedRealMs: number;
}

export interface CatchupSession {
  readonly sessionId: string;
  readonly startWallMs: number;
  readonly endWallMs: number;
  readonly entitlement: ResolvedEntitlement;
  readonly eligibleRealMs: number;
  readonly processedRealMs: number;
  readonly pendingRealMs: number;
  readonly discardedRealMs: number;
  readonly bankedRealMs: number;
  readonly segments: readonly CatchupSegment[];
  readonly report: OfflineReport;
  readonly deliveryCursor: string;
}

export interface SerializedAutomationState {
  readonly enabled: boolean;
  readonly nextRunMs: number;
}

export interface SerializedScopeState {
  readonly generation: string;
  readonly resources: Readonly<Record<string, string>>;
  readonly purchaseCounts: Readonly<Record<string, string>>;
  readonly allocations: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly automation: Readonly<Record<string, SerializedAutomationState>>;
  readonly upgrades: readonly string[];
  readonly milestones: readonly string[];
  readonly achievements: readonly string[];
  readonly activeChallenges: readonly string[];
  readonly challengeCompletions: Readonly<Record<string, string>>;
  readonly tasks?: Readonly<Record<string, SerializedTaskState>>;
  readonly calendars?: Readonly<Record<string, SerializedCalendarState>>;
  readonly markets?: Readonly<Record<string, { readonly bought: string; readonly sold: string }>>;
}

export interface SerializedTaskClaim {
  readonly sequence: string;
  readonly quantities: Readonly<Record<string, string>>;
}

export interface SerializedTaskState {
  readonly nextSequence: string;
  readonly queue: readonly {
    readonly sequence: string;
    readonly escrow: Readonly<Record<string, string>>;
    readonly outputs: Readonly<Record<string, string>>;
  }[];
  readonly active:
    | null
    | {
        readonly sequence: string;
        readonly mode: "fixed-duration";
        readonly remainingMs: number;
        readonly escrow: Readonly<Record<string, string>>;
        readonly outputs: Readonly<Record<string, string>>;
      }
    | {
        readonly sequence: string;
        readonly mode: "current-rate";
        readonly remainingWork: number;
        readonly escrow: Readonly<Record<string, string>>;
        readonly outputs: Readonly<Record<string, string>>;
      };
  readonly completed: readonly SerializedTaskClaim[];
  readonly refunds: readonly SerializedTaskClaim[];
}

export interface SerializedCalendarState {
  readonly phaseIndex: number;
  readonly elapsedMs: number;
  readonly cycle: string;
  readonly boundaries: readonly {
    readonly sequence: string;
    readonly phaseId: string;
    readonly cycle: string;
    readonly atGameMs: number;
  }[];
}

export interface SaveEnvelope {
  readonly format: "e308-save";
  readonly formatVersion: 1;
  readonly gameId: string;
  readonly stateSchemaVersion: number;
  readonly content: {
    readonly version: string;
    readonly digest: string;
    readonly modules: readonly ContentModule[];
  };
  readonly simulation: {
    readonly version: number;
    readonly stepMs: number;
    readonly scheduleVersion: number;
    readonly numericAdapter: string;
    readonly numericImplementationVersion: string;
    readonly numericCodec: { readonly id: string; readonly version: number };
  };
  readonly revision: string;
  readonly state: {
    readonly scopes: Readonly<Record<string, SerializedScopeState>>;
    readonly productionTotals: Readonly<Record<string, string>>;
    readonly rewardLedger: readonly string[];
    readonly won: boolean;
    readonly progressionEvents: readonly (Omit<ProgressionEvent, "sequence"> & {
      readonly sequence: string;
    })[];
    readonly records?: Readonly<
      Record<string, { readonly version: number; readonly value: JsonValue }>
    >;
    readonly domainEventJournal?: {
      readonly nextSequence: string;
      readonly firstRetainedSequence: string;
      readonly events: readonly {
        readonly sequence: string;
        readonly atGameMs: number;
        readonly type: string;
        readonly version: number;
        readonly payload: JsonValue;
        readonly audience: EventAudience;
      }[];
    };
  };
  readonly clock: {
    readonly wallAnchorMs: number;
    readonly gameTimeMs: number;
    readonly remainderMs: number;
    readonly entitlement: ResolvedEntitlement;
  };
  readonly rng: Omit<RandomStreamsSnapshot, "streams"> & {
    readonly streams: readonly (Omit<RandomStreamSnapshot, "draws"> & { readonly draws: string })[];
  };
  readonly catchup: CatchupSession | null;
  readonly migrationLedger: readonly string[];
  readonly lastDeliveredEvent: string;
  readonly checksum: string;
}

export interface SaveMetadata {
  readonly wallAnchorMs: number;
  readonly entitlement: ResolvedEntitlement;
  readonly catchup: CatchupSession | null;
  readonly migrationLedger?: readonly string[];
  readonly lastDeliveredEvent?: string;
}

export interface LoadedCheckpoint<N> extends SaveMetadata {
  readonly snapshot: Snapshot<N>;
  readonly migrationLedger: readonly string[];
  readonly lastDeliveredEvent: string;
}

export interface SaveConfiguration {
  readonly stateSchemaVersion: number;
  readonly contentVersion: string;
  readonly contentDigest: string;
  readonly modules?: readonly ContentModule[];
  readonly scheduleVersion?: number;
  readonly maximumBytes?: number;
}
