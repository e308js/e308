import { owned } from "../model/handles.js";
import { assertOwner, validId } from "../model/validation.js";
import type { DomainEventDefinition, JsonValue, RecordDefinition } from "./types.js";
import { normalizeJson } from "./value.js";

export interface RecordOptions<T extends JsonValue> {
  readonly scope: import("../model/handles.js").Scope;
  readonly version: number;
  readonly initial: T;
  readonly validate: (value: unknown) => T;
  readonly migrate?: (value: JsonValue, fromVersion: number) => unknown;
}

export interface DomainEventOptions<P extends JsonValue> {
  readonly version: number;
  readonly validate: (value: unknown) => P;
  readonly migrate?: (value: JsonValue, fromVersion: number) => unknown;
}

export function createRecordDefinition<T extends JsonValue>(
  id: string,
  options: RecordOptions<T>,
  owner: object,
): RecordDefinition<T> {
  validId(id, "record");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  requireVersion(options.version, `Record ${id}`);
  const initial = normalizeJson(options.validate(options.initial), `Record ${id}`) as T;
  return owned(
    {
      id,
      scope: options.scope,
      version: options.version,
      initial,
      validate: options.validate,
      ...(options.migrate ? { migrate: options.migrate } : {}),
    },
    owner,
  );
}

export function createDomainEventDefinition<P extends JsonValue>(
  id: string,
  options: DomainEventOptions<P>,
  owner: object,
): DomainEventDefinition<P> {
  validId(id, "domain event");
  requireVersion(options.version, `Domain event ${id}`);
  return owned(
    {
      id,
      version: options.version,
      validate: options.validate,
      ...(options.migrate ? { migrate: options.migrate } : {}),
    },
    owner,
  );
}

function requireVersion(version: number, label: string): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError(`${label} version must be a positive safe integer`);
  }
}
