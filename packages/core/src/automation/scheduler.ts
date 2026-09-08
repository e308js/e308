import type { Scope } from "../model/handles.js";
import { type ProgressionContext, progressionContext } from "../progression/context.js";
import type { Command, Transaction } from "../state/types.js";

export interface AutomationDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly priority: number;
  readonly cadenceMs: number;
  readonly initiallyEnabled: boolean;
  readonly unlocked: (state: ProgressionContext<N>) => boolean;
  readonly condition: (state: ProgressionContext<N>) => boolean;
  readonly action: (state: ProgressionContext<N>) => Command<N>;
}

export function automationCommand<N>(
  automation: AutomationDefinition<N>,
  enabled: boolean,
): Command<N> {
  return {
    id: `automation:${automation.id}:${enabled ? "enable" : "disable"}`,
    execute: (transaction) => {
      if (!transaction.isScopeActive(automation.scope))
        transaction.reject({
          code: "disabled",
          actionId: automation.id,
          reasonKey: "scope-inactive",
        });
      if (enabled && !automation.unlocked(progressionContext(transaction))) {
        transaction.reject({ code: "locked", prerequisiteIds: [automation.id] });
      }
      transaction.setAutomation(automation.id, {
        enabled,
        nextRunMs:
          transaction.getAutomation(automation.id)?.nextRunMs ??
          transaction.gameTimeMs() + automation.cadenceMs,
      });
    },
  };
}

export function runAutomation<N>(
  transaction: Transaction<N>,
  definitions: readonly AutomationDefinition<N>[],
  boundaryMs: number,
): void {
  for (const automation of [...definitions].sort(compareAutomation)) {
    let state = transaction.getAutomation(automation.id) ?? {
      enabled: automation.initiallyEnabled,
      nextRunMs: automation.cadenceMs,
    };
    while (state.nextRunMs <= boundaryMs) {
      const context = progressionContext(transaction);
      if (
        transaction.isScopeActive(automation.scope) &&
        state.enabled &&
        automation.unlocked(context) &&
        automation.condition(context)
      ) {
        automation.action(context).execute(transaction);
      }
      state = { ...state, nextRunMs: state.nextRunMs + automation.cadenceMs };
    }
    transaction.setAutomation(automation.id, state);
  }
}

function compareAutomation<N>(
  left: AutomationDefinition<N>,
  right: AutomationDefinition<N>,
): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
