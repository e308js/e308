import type { GameDefinition } from "../model/definition.js";
import { resolveModules } from "../model/modules.js";
import type { Snapshot } from "../state/types.js";
import { verifiedEnvelope } from "./checksum.js";
import { deserializeCheckpoint } from "./deserialize.js";
import {
  migrateEnvelope,
  type PendingSessionTransition,
  type SaveMigration,
} from "./migrations.js";
import { serializeCheckpoint } from "./serialize.js";
import type { LoadedCheckpoint, SaveConfiguration, SaveEnvelope, SaveMetadata } from "./types.js";

export interface SaveCodec<N> {
  encode(snapshot: Snapshot<N>, metadata: SaveMetadata): string;
  decode(raw: string): LoadedCheckpoint<N>;
  inspect(raw: string): SaveEnvelope;
}

export function createSaveCodec<N>(
  definition: GameDefinition<N>,
  configuration: SaveConfiguration,
  compatibility: {
    readonly migrations?: readonly SaveMigration[];
    readonly pendingTransitions?: readonly PendingSessionTransition[];
  } = {},
): SaveCodec<N> {
  validateConfiguration(configuration);
  const normalized = { ...configuration, modules: resolveModules(configuration.modules ?? []) };
  const maximumBytes = normalized.maximumBytes ?? 5 * 1024 * 1024;
  const inspect = (raw: string): SaveEnvelope => {
    const envelope = verifiedEnvelope(raw, maximumBytes);
    const migrated = migrateEnvelope(
      envelope,
      normalized.stateSchemaVersion,
      definition.simulationVersion,
      compatibility.migrations ?? [],
      compatibility.pendingTransitions ?? [],
    );
    validateInstalledContent(migrated, normalized);
    return migrated;
  };
  return Object.freeze({
    encode: (snapshot: Snapshot<N>, metadata: SaveMetadata) =>
      JSON.stringify(serializeCheckpoint(definition, normalized, snapshot, metadata)),
    decode: (raw: string) => deserializeCheckpoint(definition, inspect(raw)),
    inspect,
  });
}

function validateInstalledContent(envelope: SaveEnvelope, configuration: SaveConfiguration): void {
  if (
    envelope.content.version !== configuration.contentVersion ||
    envelope.content.digest !== configuration.contentDigest ||
    envelope.simulation.scheduleVersion !== (configuration.scheduleVersion ?? 1) ||
    JSON.stringify(envelope.content.modules) !== JSON.stringify(configuration.modules ?? [])
  ) {
    throw new TypeError("Save content requires an explicit migration");
  }
}

function validateConfiguration(configuration: SaveConfiguration): void {
  if (
    !Number.isSafeInteger(configuration.stateSchemaVersion) ||
    configuration.stateSchemaVersion < 1
  )
    throw new TypeError("State schema version must be a positive safe integer");
  if (!configuration.contentVersion || !configuration.contentDigest)
    throw new TypeError("Content version and digest are required");
  if (
    configuration.maximumBytes !== undefined &&
    (!Number.isSafeInteger(configuration.maximumBytes) || configuration.maximumBytes < 1)
  ) {
    throw new TypeError("Save size limit must be a positive safe integer");
  }
}
