import { combineEntries } from "../economy/entries.js";
import type { Resource, Scope } from "../model/handles.js";
import type { Command, Transaction } from "../state/types.js";
import { type ProgressionContext, progressionContext } from "./context.js";

export interface UpgradeDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly costs: readonly (readonly [Resource<N>, N])[];
  readonly prerequisiteIds: readonly string[];
  readonly unlocked: (state: ProgressionContext<N>) => boolean;
  readonly apply?: (transaction: Transaction<N>) => void;
}

export interface TriggerDefinition<N> {
  readonly id: string;
  readonly kind: "milestone" | "achievement";
  readonly scope: Scope;
  readonly priority: number;
  readonly when: (state: ProgressionContext<N>) => boolean;
  readonly apply?: (transaction: Transaction<N>) => void;
}

export function upgradeCommand<N>(upgrade: UpgradeDefinition<N>): Command<N> {
  return { id: `upgrade:${upgrade.id}`, execute: (tx) => executeUpgrade(upgrade, tx) };
}

function executeUpgrade<N>(upgrade: UpgradeDefinition<N>, transaction: Transaction<N>): void {
  if (!transaction.isScopeActive(upgrade.scope))
    transaction.reject({ code: "disabled", actionId: upgrade.id, reasonKey: "scope-inactive" });
  if (transaction.hasProgress("upgrade", upgrade.id)) {
    transaction.reject({ code: "disabled", actionId: upgrade.id, reasonKey: "already-owned" });
  }
  if (!upgrade.unlocked(progressionContext(transaction))) {
    transaction.reject({ code: "locked", prerequisiteIds: upgrade.prerequisiteIds });
  }
  const costs = combineEntries(upgrade.costs, transaction.numbers);
  for (const [resource, required] of costs) {
    const available = transaction.get(resource);
    if (transaction.numbers.cmp(available, required) < 0) {
      transaction.reject({ code: "insufficient", resourceId: resource.id, required, available });
    }
  }
  for (const [resource, required] of costs) {
    transaction.add(resource, transaction.numbers.sub(transaction.numbers.fromNumber(0), required));
  }
  transaction.setProgress("upgrade", upgrade.id);
  upgrade.apply?.(transaction);
}

export function resolveTriggers<N>(
  transaction: Transaction<N>,
  definitions: readonly TriggerDefinition<N>[],
): void {
  const ordered = [...definitions].sort(compareTriggers);
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of ordered) {
      if (!transaction.isScopeActive(definition.scope)) continue;
      if (transaction.hasProgress(definition.kind, definition.id)) continue;
      if (!definition.when(progressionContext(transaction))) continue;
      transaction.setProgress(definition.kind, definition.id);
      definition.apply?.(transaction);
      changed = true;
    }
  }
}

export function resolveWin<N>(
  transaction: Transaction<N>,
  win: ((state: ProgressionContext<N>) => boolean) | undefined,
): void {
  if (win?.(progressionContext(transaction))) transaction.setWon(true);
}

function compareTriggers<N>(left: TriggerDefinition<N>, right: TriggerDefinition<N>): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  if (left.kind !== right.kind) return left.kind === "milestone" ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
