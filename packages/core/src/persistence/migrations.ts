import type { SaveEnvelope } from "./types.js";

export interface SaveMigration {
  readonly id: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(envelope: SaveEnvelope): SaveEnvelope;
}

export interface PendingSessionTransition {
  readonly id: string;
  readonly fromSimulationVersion: number;
  readonly toSimulationVersion: number;
  transition(envelope: SaveEnvelope): SaveEnvelope;
}

export function migrateEnvelope(
  source: SaveEnvelope,
  targetSchemaVersion: number,
  targetSimulationVersion: number,
  migrations: readonly SaveMigration[],
  transitions: readonly PendingSessionTransition[],
): SaveEnvelope {
  if (source.stateSchemaVersion > targetSchemaVersion)
    throw new TypeError("Save uses a future state schema version");
  let current = source;
  while (current.stateSchemaVersion < targetSchemaVersion) {
    const migration = migrations.find(
      (item) =>
        item.fromVersion === current.stateSchemaVersion && item.toVersion > item.fromVersion,
    );
    if (!migration)
      throw new TypeError(`Missing migration from schema ${current.stateSchemaVersion}`);
    if (current.migrationLedger.includes(migration.id))
      throw new TypeError(`Migration ${migration.id} was already applied without advancing schema`);
    const migrated = migration.migrate(current);
    if (migrated.stateSchemaVersion !== migration.toVersion)
      throw new TypeError(`Migration ${migration.id} produced the wrong schema version`);
    current = {
      ...migrated,
      migrationLedger: Object.freeze([...migrated.migrationLedger, migration.id]),
    };
  }
  if (current.catchup && current.simulation.version !== targetSimulationVersion) {
    const transition = transitions.find(
      (item) =>
        item.fromSimulationVersion === current.simulation.version &&
        item.toSimulationVersion === targetSimulationVersion,
    );
    if (!transition) throw new TypeError("Pending catch-up is incompatible with installed rules");
    if (current.migrationLedger.includes(transition.id))
      throw new TypeError(`Transition ${transition.id} was already applied without updating rules`);
    const transitioned = transition.transition(current);
    if (transitioned.simulation.version !== targetSimulationVersion)
      throw new TypeError(`Transition ${transition.id} produced the wrong simulation version`);
    current = {
      ...transitioned,
      migrationLedger: Object.freeze([...transitioned.migrationLedger, transition.id]),
    };
  } else if (!current.catchup && current.simulation.version !== targetSimulationVersion) {
    current = {
      ...current,
      simulation: { ...current.simulation, version: targetSimulationVersion },
    };
  }
  return current;
}
