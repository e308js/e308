import type { GameDefinition } from "../model/definition.js";
import type { RandomStreamsSnapshot } from "../random/xoshiro.js";
import { restoreSnapshot } from "../state/restore.js";
import type { Snapshot } from "../state/types.js";
import { deserializeTimedState } from "./deserialize-timed.js";
import { parseUnsignedInteger } from "./parse.js";
import { scopeRegistry } from "./registry.js";
import type { LoadedCheckpoint, SaveEnvelope } from "./types.js";
import { validateEnvelope } from "./validate-envelope.js";

export function deserializeCheckpoint<N>(
  definition: GameDefinition<N>,
  envelope: SaveEnvelope,
): LoadedCheckpoint<N> {
  validateEnvelope(envelope);
  const numbers = definition.numbers;
  if (!numbers) throw new TypeError("Game definition has no numeric adapter");
  validateIdentity(definition, envelope);
  const registry = scopeRegistry(definition);
  exactStrings(Object.keys(envelope.state.scopes), registry.scopes, "save scope");
  const resources: Record<string, N> = {};
  const purchaseCounts: Record<string, N> = {};
  const allocations: Record<string, Record<string, N>> = {};
  const scopeGenerations: Record<string, bigint> = {};
  const upgrades: Record<string, true> = {};
  const milestones: Record<string, true> = {};
  const achievements: Record<string, true> = {};
  const activeChallenges: string[] = [];
  const challengeCompletions: Record<string, N> = {};
  const automation: Record<string, { enabled: boolean; nextRunMs: number }> = {};
  for (const [scopeId, scope] of Object.entries(envelope.state.scopes)) {
    if (!scope || typeof scope !== "object") throw new TypeError(`Invalid save scope: ${scopeId}`);
    scopeGenerations[scopeId] = parseUnsignedInteger(scope.generation, `scope ${scopeId}`);
    decodeQuantities(scope.resources, resources, numbers.codec.parse);
    decodeQuantities(scope.purchaseCounts, purchaseCounts, numbers.codec.parse);
    for (const [id, values] of Object.entries(scope.allocations)) {
      const decoded: Record<string, N> = {};
      decodeQuantities(values, decoded, numbers.codec.parse);
      allocations[id] = decoded;
    }
    addFlags(scope.upgrades, upgrades);
    addFlags(scope.milestones, milestones);
    addFlags(scope.achievements, achievements);
    activeChallenges.push(...strings(scope.activeChallenges, "active challenge", true));
    decodeQuantities(scope.challengeCompletions, challengeCompletions, numbers.codec.parse);
    for (const [id, state] of Object.entries(scope.automation)) {
      if (typeof state.enabled !== "boolean" || !safeDuration(state.nextRunMs))
        throw new TypeError(`Invalid saved automation: ${id}`);
      automation[id] = { enabled: state.enabled, nextRunMs: state.nextRunMs };
    }
  }
  const productionTotals: Record<string, N> = {};
  decodeQuantities(envelope.state.productionTotals, productionTotals, numbers.codec.parse);
  const timed = deserializeTimedState(envelope.state.scopes, numbers.codec.parse);
  const snapshot = restoreSnapshot(definition, {
    revision: parseUnsignedInteger(envelope.revision, "revision"),
    gameTimeMs: envelope.clock.gameTimeMs,
    remainderMs: envelope.clock.remainderMs,
    resources,
    purchaseCounts,
    allocations,
    productionTotals,
    scopeGenerations,
    progression: {
      upgrades,
      milestones,
      achievements,
      activeChallenges,
      challengeCompletions,
      rewardLedger: strings(envelope.state.rewardLedger, "reward ledger", true),
      automation,
      won: envelope.state.won,
      events: decodeProgressionEvents(envelope),
    },
    random: decodeRandom(envelope),
    ...(envelope.state.records ? { records: decodeDomainRecords(envelope) } : {}),
    ...(envelope.state.domainEventJournal
      ? { domainEventJournal: decodeDomainEventJournal(envelope) }
      : {}),
    ...timed,
  } satisfies Snapshot<N>);
  return {
    snapshot,
    wallAnchorMs: envelope.clock.wallAnchorMs,
    entitlement: envelope.clock.entitlement,
    catchup: envelope.catchup,
    migrationLedger: Object.freeze([...envelope.migrationLedger]),
    lastDeliveredEvent: envelope.lastDeliveredEvent,
  };
}

function decodeDomainRecords(envelope: SaveEnvelope): NonNullable<Snapshot<never>["records"]> {
  return Object.fromEntries(
    Object.entries(envelope.state.records ?? {}).map(([id, state]) => [
      id,
      { version: state.version, value: state.value },
    ]),
  );
}

function decodeDomainEventJournal(
  envelope: SaveEnvelope,
): NonNullable<Snapshot<never>["domainEventJournal"]> {
  const journal = envelope.state.domainEventJournal;
  if (!journal) throw new TypeError("Missing domain event journal");
  return {
    nextSequence: parseUnsignedInteger(journal.nextSequence, "domain event next sequence"),
    firstRetainedSequence: parseUnsignedInteger(
      journal.firstRetainedSequence,
      "domain event first retained sequence",
    ),
    events: journal.events.map((event) => ({
      ...event,
      sequence: parseUnsignedInteger(event.sequence, "domain event sequence"),
    })),
  };
}

function decodeProgressionEvents(envelope: SaveEnvelope): Snapshot<never>["progression"]["events"] {
  if (!Array.isArray(envelope.state.progressionEvents))
    throw new TypeError("Invalid progression event ledger");
  let previous = 0n;
  return envelope.state.progressionEvents.map((event) => {
    if (Object.keys(event).some((key) => !["sequence", "kind", "id", "atGameMs"].includes(key)))
      throw new TypeError("Invalid progression event ledger");
    const sequence = parseUnsignedInteger(event.sequence, "progression event sequence");
    if (
      sequence <= previous ||
      !["upgrade", "milestone", "achievement", "challenge-reward", "win"].includes(event.kind) ||
      typeof event.id !== "string" ||
      event.id.length === 0 ||
      !safeDuration(event.atGameMs) ||
      event.atGameMs > envelope.clock.gameTimeMs
    ) {
      throw new TypeError("Invalid progression event ledger");
    }
    previous = sequence;
    return { ...event, sequence };
  });
}

function validateIdentity<N>(definition: GameDefinition<N>, envelope: SaveEnvelope): void {
  const numbers = definition.numbers as NonNullable<GameDefinition<N>["numbers"]>;
  if (envelope.gameId !== definition.id) throw new TypeError("Save belongs to another game");
  if (envelope.simulation.stepMs !== definition.stepMs)
    throw new TypeError("Save simulation quantum is incompatible");
  if (envelope.simulation.version !== definition.simulationVersion)
    throw new TypeError("Save simulation version is incompatible");
  if (
    envelope.simulation.numericAdapter !== numbers.id ||
    envelope.simulation.numericImplementationVersion !== numbers.implementationVersion ||
    envelope.simulation.numericCodec.id !== numbers.codec.id ||
    envelope.simulation.numericCodec.version !== numbers.codec.version
  ) {
    throw new TypeError("Save numeric codec is incompatible");
  }
  if (!safeDuration(envelope.clock.wallAnchorMs)) throw new TypeError("Invalid wall anchor");
  if (typeof envelope.state.won !== "boolean") throw new TypeError("Invalid saved win state");
  strings(envelope.migrationLedger, "migration ledger", true);
  if (!/^(?:0|[1-9][0-9]*)$/.test(envelope.lastDeliveredEvent))
    throw new TypeError("Invalid event delivery cursor");
}

function decodeRandom(envelope: SaveEnvelope): RandomStreamsSnapshot {
  if (
    envelope.rng.algorithm !== "xoshiro128ss-v1" ||
    envelope.rng.derivation !== "sha256-path-v1"
  ) {
    throw new TypeError("Unsupported random state");
  }
  return {
    ...envelope.rng,
    streams: envelope.rng.streams.map((stream) => ({
      ...stream,
      path: strings(stream.path, "random stream path"),
      draws: parseUnsignedInteger(stream.draws, "random draw count"),
    })),
  };
}

function decodeQuantities<N>(
  encoded: Readonly<Record<string, string>>,
  output: Record<string, N>,
  parse: (value: string) => N,
): void {
  if (!encoded || typeof encoded !== "object" || Array.isArray(encoded))
    throw new TypeError("Invalid saved quantity map");
  for (const [id, value] of Object.entries(encoded)) {
    if (id in output || typeof value !== "string")
      throw new TypeError(`Invalid saved quantity: ${id}`);
    output[id] = parse(value);
  }
}

function addFlags(values: readonly string[], output: Record<string, true>): void {
  for (const id of strings(values, "progression flag")) {
    if (id in output) throw new TypeError(`Duplicate progression flag: ${id}`);
    output[id] = true;
  }
}

function strings(value: unknown, label: string, unique = false): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new TypeError(`Invalid ${label}`);
  if (unique && new Set(value).size !== value.length) throw new TypeError(`Duplicate ${label}`);
  return value as string[];
}

function safeDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function exactStrings(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value) => !expected.includes(value)))
    throw new TypeError(`Invalid ${label} inventory`);
}
