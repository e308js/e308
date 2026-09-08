import type { AutomationDefinition } from "../automation/scheduler.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { ChallengeDefinition } from "../progression/challenges.js";
import type { TriggerDefinition, UpgradeDefinition } from "../progression/features.js";
import type { PrestigeDefinition, ResetManifest } from "../progression/resets.js";
import type { Resource } from "./handles.js";
import { owned } from "./handles.js";
import { assertOwner, freezeEntries, safePriority, validId } from "./validation.js";

export type {
  AutomationDefinition,
  ChallengeDefinition,
  PrestigeDefinition,
  TriggerDefinition,
  UpgradeDefinition,
};

export interface UpgradeOptions<N> extends Omit<UpgradeDefinition<N>, "id" | "costs"> {
  readonly costs?: readonly (readonly [Resource<N>, N])[];
}

export type PrestigeOptions<N> = Omit<PrestigeDefinition<N>, "id" | "prerequisiteIds"> & {
  readonly prerequisiteIds?: readonly string[];
};

export type TriggerOptions<N> = Omit<TriggerDefinition<N>, "id" | "priority"> & {
  readonly priority?: number;
};

export type ChallengeOptions<N> = Omit<
  ChallengeDefinition<N>,
  "id" | "countsAs" | "replacementKeys"
> & {
  readonly countsAs?: readonly string[];
  readonly replacementKeys?: readonly string[];
};

export type AutomationOptions<N> = Omit<AutomationDefinition<N>, "id" | "priority"> & {
  readonly priority?: number;
};

export function createUpgrade<N>(
  id: string,
  options: UpgradeOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): UpgradeDefinition<N> {
  validId(id, "upgrade");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  return owned(
    {
      ...options,
      id,
      costs: freezeEntries(options.costs ?? [], owner, numbers, id),
      prerequisiteIds: Object.freeze([...options.prerequisiteIds]),
    },
    owner,
  );
}

export function createPrestige<N>(
  id: string,
  options: PrestigeOptions<N>,
  owner: object,
): PrestigeDefinition<N> {
  validId(id, "prestige");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  assertOwner(options.reward, owner, `Reward for ${id}`);
  validateManifest(options.manifest, owner, id);
  if (options.manifest.clear.length === 0) throw new TypeError(`Prestige ${id} clears no scopes`);
  return owned(
    {
      ...options,
      id,
      manifest: Object.freeze({
        clear: Object.freeze([...options.manifest.clear]),
        ...(options.manifest.retain === undefined ? {} : { retain: options.manifest.retain }),
      }),
      prerequisiteIds: Object.freeze([...(options.prerequisiteIds ?? [])]),
    },
    owner,
  );
}

export function createTrigger<N>(
  id: string,
  options: TriggerOptions<N>,
  owner: object,
): TriggerDefinition<N> {
  validId(id, options.kind);
  assertOwner(options.scope, owner, `Scope for ${id}`);
  const priority = safePriority(options.priority, id);
  return owned({ ...options, id, priority }, owner);
}

export function createChallenge<N>(
  id: string,
  options: ChallengeOptions<N>,
  owner: object,
): ChallengeDefinition<N> {
  validId(id, "challenge");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  validateManifest(options.enterReset, owner, id);
  validateManifest(options.exitReset, owner, id);
  if (!Number.isSafeInteger(options.maxCompletions) || options.maxCompletions < 1)
    throw new TypeError(`Challenge ${id} requires a positive safe completion limit`);
  const countsAs = uniqueIds(options.countsAs ?? [], `Challenge ${id} countsAs`);
  const replacementKeys = uniqueIds(options.replacementKeys ?? [], `Challenge ${id} replacement`);
  return owned({ ...options, id, countsAs, replacementKeys }, owner);
}

export function createAutomation<N>(
  id: string,
  options: AutomationOptions<N>,
  owner: object,
): AutomationDefinition<N> {
  validId(id, "automation");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  const priority = safePriority(options.priority, id);
  if (!Number.isSafeInteger(options.cadenceMs) || options.cadenceMs < 1)
    throw new TypeError(`Cadence for ${id} must be a positive safe integer`);
  return owned({ ...options, id, priority }, owner);
}

function validateManifest<N>(manifest: ResetManifest<N>, owner: object, id: string): void {
  for (const scope of manifest.clear) assertOwner(scope, owner, `Reset scope for ${id}`);
  for (const value of [
    ...(manifest.retain?.resources ?? []),
    ...(manifest.retain?.buyables ?? []),
    ...(manifest.retain?.allocations ?? []),
    ...(manifest.retain?.upgrades ?? []),
    ...(manifest.retain?.triggers ?? []),
    ...(manifest.retain?.challenges ?? []),
    ...(manifest.retain?.automation ?? []),
  ]) {
    assertOwner(value, owner, `Retention for ${id}`);
  }
}

function uniqueIds(values: readonly string[], label: string): readonly string[] {
  for (const value of values) validId(value, label);
  if (new Set(values).size !== values.length) throw new TypeError(`${label} values must be unique`);
  return Object.freeze([...values]);
}
