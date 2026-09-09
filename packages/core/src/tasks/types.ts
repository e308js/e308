import type { Resource, Scope } from "../model/handles.js";
import type { Transaction } from "../state/types.js";

export type TaskWork<N> =
  | { readonly kind: "fixed-duration"; readonly durationMs: number }
  | {
      readonly kind: "current-rate";
      readonly work: number;
      readonly rate: (transaction: Transaction<N>) => number;
    };

export interface TaskDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly inputs: readonly (readonly [Resource<N>, N])[];
  readonly outputs: readonly (readonly [Resource<N>, N])[];
  readonly work: TaskWork<N>;
  readonly delivery: "block" | "discard-overflow";
  readonly cancellation:
    | { readonly refund: "full" }
    | { readonly refund: "none" }
    | { readonly refund: "fraction"; readonly ratio: N };
  readonly queueLimit: number;
}

export interface QueuedTask<N> {
  readonly sequence: bigint;
  readonly escrow: Readonly<Record<string, N>>;
  readonly outputs: Readonly<Record<string, N>>;
}

export type ActiveTask<N> =
  | {
      readonly sequence: bigint;
      readonly mode: "fixed-duration";
      readonly remainingMs: number;
      readonly escrow: Readonly<Record<string, N>>;
      readonly outputs: Readonly<Record<string, N>>;
    }
  | {
      readonly sequence: bigint;
      readonly mode: "current-rate";
      readonly remainingWork: number;
      readonly escrow: Readonly<Record<string, N>>;
      readonly outputs: Readonly<Record<string, N>>;
    };

export interface TaskClaim<N> {
  readonly sequence: bigint;
  readonly quantities: Readonly<Record<string, N>>;
}

export interface TaskState<N> {
  readonly nextSequence: bigint;
  readonly queue: readonly QueuedTask<N>[];
  readonly active: ActiveTask<N> | null;
  readonly completed: readonly TaskClaim<N>[];
  readonly refunds: readonly TaskClaim<N>[];
}
