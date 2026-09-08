import type { Scope } from "../model/handles.js";
import type { Transaction } from "../state/types.js";

export interface SteppedRuleDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly priority: number;
  readonly update: (transaction: Transaction<N>, stepSeconds: number) => void;
}

export function runSteppedRules<N>(
  transaction: Transaction<N>,
  rules: readonly SteppedRuleDefinition<N>[],
  stepSeconds: number,
): void {
  for (const rule of [...rules].sort(compareRules)) {
    if (transaction.isScopeActive(rule.scope)) rule.update(transaction, stepSeconds);
  }
}

function compareRules<N>(left: SteppedRuleDefinition<N>, right: SteppedRuleDefinition<N>): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return Number(left.id > right.id) - Number(left.id < right.id);
}
