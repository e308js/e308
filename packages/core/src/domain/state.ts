import type { GameDefinition } from "../model/definition.js";
import { ownerOf } from "../model/handles.js";
import type {
  DomainEvent,
  DomainEventDefinition,
  EventAudience,
  EventJournal,
  EventReadResult,
  JsonValue,
  PendingDomainEvent,
  RecordDefinition,
  RecordState,
} from "./types.js";
import { normalizeAudience, normalizeJson } from "./value.js";

export function initialRecords<N>(definition: GameDefinition<N>): Record<string, RecordState> {
  return Object.fromEntries(
    (definition.records ?? []).map((record) => [
      record.id,
      Object.freeze({ version: record.version, value: record.initial }),
    ]),
  );
}

export function cloneRecords(
  source: Readonly<Record<string, RecordState>> | undefined,
): Record<string, RecordState> {
  return Object.fromEntries(
    Object.entries(source ?? {}).map(([id, state]) => [
      id,
      { version: state.version, value: state.value },
    ]),
  );
}

export function restoreRecords<N>(
  definition: GameDefinition<N>,
  source: Readonly<Record<string, RecordState>> | undefined,
): Record<string, RecordState> {
  if (source === undefined) return initialRecords(definition);
  const expected = new Set((definition.records ?? []).map((record) => record.id));
  const unknown = Object.keys(source).find((id) => !expected.has(id));
  if (unknown) throw new TypeError(`Unknown saved record: ${unknown}`);
  return Object.fromEntries(
    (definition.records ?? []).map((record) => {
      const state = source[record.id];
      if (!state) throw new TypeError(`Missing saved record: ${record.id}`);
      if (
        !Number.isSafeInteger(state.version) ||
        state.version < 1 ||
        state.version > record.version
      ) {
        throw new TypeError(`Invalid saved record version: ${record.id}`);
      }
      const migrated =
        state.version === record.version
          ? state.value
          : (record.migrate?.(state.value, state.version) ?? missingMigration(record.id));
      return [
        record.id,
        Object.freeze({
          version: record.version,
          value: normalizeJson(record.validate(migrated), `Record ${record.id}`),
        }),
      ];
    }),
  );
}

function missingMigration(id: string): never {
  throw new TypeError(`Saved record requires a migration: ${id}`);
}

export function recordMethods(
  owner: object,
  records: Record<string, RecordState>,
): {
  getRecord<T extends JsonValue>(definition: RecordDefinition<T>): T;
  setRecord<T extends JsonValue>(definition: RecordDefinition<T>, value: unknown): void;
} {
  const required = <T extends JsonValue>(definition: RecordDefinition<T>): RecordState => {
    const state = records[definition.id];
    if (ownerOf(definition) !== owner || !state)
      throw new TypeError(`Invalid record: ${definition.id}`);
    return state;
  };
  return {
    getRecord: <T extends JsonValue>(definition: RecordDefinition<T>) =>
      required(definition).value as T,
    setRecord: <T extends JsonValue>(definition: RecordDefinition<T>, value: unknown) => {
      required(definition);
      const validated = definition.validate(value);
      records[definition.id] = Object.freeze({
        version: definition.version,
        value: normalizeJson(validated, `Record ${definition.id}`),
      });
    },
  };
}

export function commitEvents(
  journal: EventJournal,
  pending: readonly PendingDomainEvent[],
  retention: number,
): { readonly journal: EventJournal; readonly committed: readonly DomainEvent[] } {
  const committed = pending.map((event, index) =>
    Object.freeze({
      sequence: journal.nextSequence + BigInt(index),
      atGameMs: event.atGameMs,
      type: event.type.id,
      version: event.type.version,
      payload: event.payload,
      audience: event.audience,
    }),
  );
  const nextSequence = journal.nextSequence + BigInt(committed.length);
  const retained = [...journal.events, ...committed].slice(-retention);
  const frozenEvents = Object.freeze(retained);
  return {
    committed: Object.freeze(committed),
    journal: Object.freeze({
      nextSequence,
      firstRetainedSequence: frozenEvents[0]?.sequence ?? nextSequence,
      events: frozenEvents,
    }),
  };
}

export function emptyEventJournal(): EventJournal {
  return Object.freeze({ nextSequence: 1n, firstRetainedSequence: 1n, events: Object.freeze([]) });
}

export function readEvents(journal: EventJournal, afterSequence: bigint): EventReadResult {
  if (afterSequence < 0n) throw new TypeError("Event cursor cannot be negative");
  if (afterSequence + 1n < journal.firstRetainedSequence) {
    return Object.freeze({
      kind: "gap",
      firstRetainedSequence: journal.firstRetainedSequence,
      nextSequence: journal.nextSequence,
    });
  }
  return Object.freeze({
    kind: "events",
    events: Object.freeze(journal.events.filter((event) => event.sequence > afterSequence)),
    nextSequence: journal.nextSequence,
  });
}

export function restoreEventJournal<N>(
  definition: GameDefinition<N>,
  source: EventJournal | undefined,
  gameTimeMs: number,
): EventJournal {
  if (!source) {
    return emptyEventJournal();
  }
  if (
    source.nextSequence < 1n ||
    source.firstRetainedSequence < 1n ||
    source.firstRetainedSequence > source.nextSequence ||
    source.events.length > (definition.eventRetention ?? 2_000)
  ) {
    throw new TypeError("Invalid domain event journal cursor");
  }
  const eventTypes = new Map((definition.domainEvents ?? []).map((event) => [event.id, event]));
  let expected = source.firstRetainedSequence;
  const events = source.events.map((event) => {
    const eventType = eventTypes.get(event.type);
    if (
      !eventType ||
      event.sequence !== expected ||
      event.version < 1 ||
      event.version > eventType.version ||
      !Number.isSafeInteger(event.atGameMs) ||
      event.atGameMs < 0 ||
      event.atGameMs > gameTimeMs
    ) {
      throw new TypeError("Invalid retained domain event");
    }
    expected += 1n;
    const migrated =
      event.version === eventType.version
        ? event.payload
        : (eventType.migrate?.(event.payload, event.version) ?? missingEventMigration(event.type));
    return Object.freeze({
      ...event,
      version: eventType.version,
      payload: normalizeJson(eventType.validate(migrated), `Event ${event.type}`),
      audience: normalizeAudience(event.audience),
    });
  });
  if (expected !== source.nextSequence) {
    throw new TypeError("Invalid domain event journal sequence");
  }
  return Object.freeze({
    nextSequence: source.nextSequence,
    firstRetainedSequence: source.firstRetainedSequence,
    events: Object.freeze(events),
  });
}

function missingEventMigration(id: string): never {
  throw new TypeError(`Retained domain event requires a migration: ${id}`);
}

export function pendingEvent(
  definition: DomainEventDefinition,
  atGameMs: number,
  payload: unknown,
  audience: EventAudience,
): PendingDomainEvent {
  return Object.freeze({
    type: definition,
    atGameMs,
    payload: normalizeJson(definition.validate(payload), `Event ${definition.id}`),
    audience: normalizeAudience(audience),
  });
}
