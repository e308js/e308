import type { Scope } from "../model/handles.js";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface RecordDefinition<T extends JsonValue = JsonValue> {
  readonly id: string;
  readonly scope: Scope;
  readonly version: number;
  readonly initial: T;
  readonly validate: (value: unknown) => T;
  readonly migrate?: (value: JsonValue, fromVersion: number) => unknown;
}

export interface DomainEventDefinition<P extends JsonValue = JsonValue> {
  readonly id: string;
  readonly version: number;
  readonly validate: (value: unknown) => P;
  readonly migrate?: (value: JsonValue, fromVersion: number) => unknown;
}

export type EventAudience =
  | { readonly kind: "public" }
  | { readonly kind: "seats"; readonly seatIds: readonly string[] }
  | { readonly kind: "host" };

export interface DomainEvent<P extends JsonValue = JsonValue> {
  readonly sequence: bigint;
  readonly atGameMs: number;
  readonly type: string;
  readonly version: number;
  readonly payload: P;
  readonly audience: EventAudience;
}

export interface EventJournal {
  readonly nextSequence: bigint;
  readonly firstRetainedSequence: bigint;
  readonly events: readonly DomainEvent[];
}

export interface RecordState {
  readonly version: number;
  readonly value: JsonValue;
}

export type EventReadResult =
  | {
      readonly kind: "events";
      readonly events: readonly DomainEvent[];
      readonly nextSequence: bigint;
    }
  | {
      readonly kind: "gap";
      readonly firstRetainedSequence: bigint;
      readonly nextSequence: bigint;
    };

export interface PendingDomainEvent {
  readonly type: DomainEventDefinition;
  readonly atGameMs: number;
  readonly payload: JsonValue;
  readonly audience: EventAudience;
}
