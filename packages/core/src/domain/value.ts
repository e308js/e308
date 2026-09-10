import type { EventAudience, JsonValue } from "./types.js";

const MAX_DOMAIN_BYTES = 64 * 1024;

export function normalizeJson(value: unknown, label: string): JsonValue {
  const normalized = visit(value, label, new Set<object>());
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > MAX_DOMAIN_BYTES) {
    throw new TypeError(`${label} exceeds ${MAX_DOMAIN_BYTES} encoded bytes`);
  }
  return normalized;
}

function visit(value: unknown, label: string, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return value;
  }
  if (typeof value !== "object") throw new TypeError(`${label} is not JSON-compatible`);
  if (ancestors.has(value)) throw new TypeError(`${label} contains a cycle`);
  ancestors.add(value);
  const result = Array.isArray(value)
    ? Object.freeze(value.map((entry) => visit(entry, label, ancestors)))
    : normalizeObject(value, label, ancestors);
  ancestors.delete(value);
  return result;
}

function normalizeObject(value: object, label: string, ancestors: Set<object>): JsonValue {
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError(`${label} contains a non-plain object`);
  }
  return Object.freeze(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, visit((value as Record<string, unknown>)[key], label, ancestors)]),
    ),
  );
}

export function normalizeAudience(audience: EventAudience): EventAudience {
  if (audience.kind === "public" || audience.kind === "host") return Object.freeze({ ...audience });
  if (
    !Array.isArray(audience.seatIds) ||
    audience.seatIds.length === 0 ||
    audience.seatIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(audience.seatIds).size !== audience.seatIds.length
  ) {
    throw new TypeError("Seat event audience requires unique nonempty seat IDs");
  }
  return Object.freeze({ kind: "seats", seatIds: Object.freeze([...audience.seatIds].sort()) });
}
