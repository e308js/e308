import type { GameDefinition } from "../model/definition.js";
import type { Snapshot } from "../state/types.js";
import { envelopeChecksum } from "./checksum.js";
import { scopeRegistry } from "./registry.js";
import type { SaveConfiguration, SaveEnvelope, SaveMetadata } from "./types.js";
import { validateEnvelope } from "./validate-envelope.js";

export function serializeCheckpoint<N>(
  definition: GameDefinition<N>,
  configuration: SaveConfiguration,
  snapshot: Snapshot<N>,
  metadata: SaveMetadata,
): SaveEnvelope {
  const numbers = definition.numbers;
  if (!numbers) throw new TypeError("Game definition has no numeric adapter");
  validateMetadata(metadata);
  const registry = scopeRegistry(definition);
  const scopes = createScopes(registry.scopes, snapshot.scopeGenerations);
  for (const [id, value] of Object.entries(snapshot.resources))
    requiredScope(scopes, registry.resourceScopes[id], id).resources[id] =
      numbers.codec.serialize(value);
  for (const [id, value] of Object.entries(snapshot.purchaseCounts))
    requiredScope(scopes, registry.buyableScopes[id], id).purchaseCounts[id] =
      numbers.codec.serialize(value);
  for (const [id, assignments] of Object.entries(snapshot.allocations)) {
    requiredScope(scopes, registry.allocationScopes[id], id).allocations[id] = Object.freeze(
      Object.fromEntries(
        Object.entries(assignments).map(([target, value]) => [
          target,
          numbers.codec.serialize(value),
        ]),
      ),
    );
  }
  addProgression(scopes, registry, snapshot, numbers.codec.serialize);
  addTimedState(scopes, registry, snapshot, numbers.codec.serialize);
  const payload: Omit<SaveEnvelope, "checksum"> = {
    format: "e308-save",
    formatVersion: 1,
    gameId: definition.id,
    stateSchemaVersion: configuration.stateSchemaVersion,
    content: {
      version: configuration.contentVersion,
      digest: configuration.contentDigest,
      modules: Object.freeze([...(configuration.modules ?? [])]),
    },
    simulation: {
      version: definition.simulationVersion,
      stepMs: definition.stepMs,
      scheduleVersion: configuration.scheduleVersion ?? 1,
      numericAdapter: numbers.id,
      numericImplementationVersion: numbers.implementationVersion,
      numericCodec: { id: numbers.codec.id, version: numbers.codec.version },
    },
    revision: snapshot.revision.toString(),
    state: {
      scopes: Object.freeze(scopes),
      productionTotals: Object.freeze(
        Object.fromEntries(
          Object.entries(snapshot.productionTotals).map(([id, value]) => [
            id,
            numbers.codec.serialize(value),
          ]),
        ),
      ),
      rewardLedger: snapshot.progression.rewardLedger,
      won: snapshot.progression.won,
      progressionEvents: snapshot.progression.events.map((event) => ({
        ...event,
        sequence: event.sequence.toString(),
      })),
    },
    clock: {
      wallAnchorMs: metadata.wallAnchorMs,
      gameTimeMs: snapshot.gameTimeMs,
      remainderMs: snapshot.remainderMs,
      entitlement: metadata.entitlement,
    },
    rng: {
      ...snapshot.random,
      streams: snapshot.random.streams.map((stream) => ({
        ...stream,
        draws: stream.draws.toString(),
      })),
    },
    catchup: metadata.catchup,
    migrationLedger: Object.freeze([...(metadata.migrationLedger ?? [])]),
    lastDeliveredEvent: metadata.lastDeliveredEvent ?? "0",
  };
  return completeEnvelope(payload);
}

function createScopes(
  ids: readonly string[],
  generations: Readonly<Record<string, bigint>>,
): Record<string, MutableSerializedScope> {
  return Object.fromEntries(ids.map((id) => [id, emptyScope(generations[id] ?? 0n)]));
}

function completeEnvelope(payload: Omit<SaveEnvelope, "checksum">): SaveEnvelope {
  const envelope = { ...payload, checksum: envelopeChecksum(payload) };
  validateEnvelope(envelope);
  return Object.freeze(envelope);
}

interface MutableSerializedScope {
  generation: string;
  resources: Record<string, string>;
  purchaseCounts: Record<string, string>;
  allocations: Record<string, Readonly<Record<string, string>>>;
  automation: Record<string, { enabled: boolean; nextRunMs: number }>;
  upgrades: string[];
  milestones: string[];
  achievements: string[];
  activeChallenges: string[];
  challengeCompletions: Record<string, string>;
  tasks: Record<string, import("./types.js").SerializedTaskState>;
  calendars: Record<string, import("./types.js").SerializedCalendarState>;
  markets: Record<string, { bought: string; sold: string }>;
}

function emptyScope(generation: bigint): MutableSerializedScope {
  return {
    generation: generation.toString(),
    resources: {},
    purchaseCounts: {},
    allocations: {},
    automation: {},
    upgrades: [],
    milestones: [],
    achievements: [],
    activeChallenges: [],
    challengeCompletions: {},
    tasks: {},
    calendars: {},
    markets: {},
  };
}

function addProgression<N>(
  scopes: Record<string, MutableSerializedScope>,
  registry: ReturnType<typeof scopeRegistry>,
  snapshot: Snapshot<N>,
  encode: (value: N) => string,
): void {
  for (const id of Object.keys(snapshot.progression.upgrades))
    requiredScope(scopes, registry.upgradeScopes[id], id).upgrades.push(id);
  for (const id of Object.keys(snapshot.progression.milestones))
    requiredScope(scopes, registry.triggerScopes[id], id).milestones.push(id);
  for (const id of Object.keys(snapshot.progression.achievements))
    requiredScope(scopes, registry.triggerScopes[id], id).achievements.push(id);
  for (const id of snapshot.progression.activeChallenges)
    requiredScope(scopes, registry.challengeScopes[id], id).activeChallenges.push(id);
  for (const [id, value] of Object.entries(snapshot.progression.challengeCompletions)) {
    requiredScope(scopes, registry.challengeScopes[id], id).challengeCompletions[id] =
      encode(value);
  }
  for (const [id, state] of Object.entries(snapshot.progression.automation))
    requiredScope(scopes, registry.automationScopes[id], id).automation[id] = { ...state };
}

function addTimedState<N>(
  scopes: Record<string, MutableSerializedScope>,
  registry: ReturnType<typeof scopeRegistry>,
  snapshot: Snapshot<N>,
  encode: (value: N) => string,
): void {
  const quantities = (values: Readonly<Record<string, N>>) =>
    Object.freeze(
      Object.fromEntries(Object.entries(values).map(([id, value]) => [id, encode(value)])),
    );
  const claim = (value: {
    readonly sequence: bigint;
    readonly quantities: Readonly<Record<string, N>>;
  }) => ({
    sequence: value.sequence.toString(),
    quantities: quantities(value.quantities),
  });
  for (const [id, state] of Object.entries(snapshot.tasks)) {
    const active = state.active
      ? {
          ...state.active,
          sequence: state.active.sequence.toString(),
          escrow: quantities(state.active.escrow),
          outputs: quantities(state.active.outputs),
        }
      : null;
    requiredScope(scopes, registry.taskScopes[id], id).tasks[id] = {
      nextSequence: state.nextSequence.toString(),
      queue: state.queue.map((entry) => ({
        sequence: entry.sequence.toString(),
        escrow: quantities(entry.escrow),
        outputs: quantities(entry.outputs),
      })),
      active,
      completed: state.completed.map(claim),
      refunds: state.refunds.map(claim),
    };
  }
  for (const [id, state] of Object.entries(snapshot.calendars)) {
    requiredScope(scopes, registry.calendarScopes[id], id).calendars[id] = {
      ...state,
      cycle: state.cycle.toString(),
      boundaries: state.boundaries.map((boundary) => ({
        ...boundary,
        sequence: boundary.sequence.toString(),
        cycle: boundary.cycle.toString(),
      })),
    };
  }
  for (const [id, state] of Object.entries(snapshot.markets)) {
    requiredScope(scopes, registry.marketScopes[id], id).markets[id] = {
      bought: encode(state.bought),
      sold: encode(state.sold),
    };
  }
}

function requiredScope(
  scopes: Record<string, MutableSerializedScope>,
  scopeId: string | undefined,
  definitionId: string,
): MutableSerializedScope {
  const scope = scopeId ? scopes[scopeId] : undefined;
  if (!scope) throw new TypeError(`Snapshot contains unknown definition: ${definitionId}`);
  return scope;
}

function validateMetadata(metadata: SaveMetadata): void {
  if (!Number.isSafeInteger(metadata.wallAnchorMs) || metadata.wallAnchorMs < 0)
    throw new TypeError("Wall anchor must be a nonnegative safe integer");
  const { capMs } = metadata.entitlement;
  if (capMs !== null && (!Number.isSafeInteger(capMs) || capMs < 0))
    throw new TypeError("Offline cap must be null or a nonnegative safe integer");
}
