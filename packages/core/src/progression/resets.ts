import type { AutomationDefinition } from "../automation/scheduler.js";
import type { AllocationDefinition } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import type { ReadContext } from "../economy/types.js";
import type { MarketDefinition } from "../markets/types.js";
import type { Resource, Scope } from "../model/handles.js";
import type { Command } from "../state/types.js";
import type { TaskDefinition } from "../tasks/types.js";
import type { ChallengeDefinition } from "./challenges.js";
import type { TriggerDefinition, UpgradeDefinition } from "./features.js";

export interface ResetRetention<N> {
  readonly tasks?: readonly TaskDefinition<N>[];
  readonly calendars?: readonly import("../calendar/types.js").CalendarDefinition[];
  readonly markets?: readonly MarketDefinition<N>[];
  readonly resources?: readonly Resource<N>[];
  readonly buyables?: readonly BuyableDefinition<N>[];
  readonly allocations?: readonly AllocationDefinition<N>[];
  readonly upgrades?: readonly UpgradeDefinition<N>[];
  readonly triggers?: readonly TriggerDefinition<N>[];
  readonly challenges?: readonly ChallengeDefinition<N>[];
  readonly automation?: readonly AutomationDefinition<N>[];
}

export interface ResetManifest<N> {
  readonly clear: readonly Scope[];
  readonly retain?: ResetRetention<N>;
}

export interface PrestigeDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly reward: Resource<N>;
  readonly manifest: ResetManifest<N>;
  readonly prerequisiteIds: readonly string[];
  readonly canReset: (state: ReadContext<N>) => boolean;
  readonly rewardFor: (state: ReadContext<N>) => N;
}

export function prestigeCommand<N>(
  prestige: PrestigeDefinition<N>,
  expectedRevision?: bigint,
): Command<N> {
  return {
    id: `prestige:${prestige.id}`,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    execute: (transaction) => {
      if (!transaction.isScopeActive(prestige.scope))
        transaction.reject({
          code: "disabled",
          actionId: prestige.id,
          reasonKey: "scope-inactive",
        });
      const state: ReadContext<N> = {
        get: (resource) => transaction.get(resource),
        getAllocation: (allocation, targetId) => transaction.getAllocation(allocation.id, targetId),
      };
      if (!prestige.canReset(state)) {
        transaction.reject({ code: "locked", prerequisiteIds: prestige.prerequisiteIds });
      }
      const reward = prestige.rewardFor(state);
      if (
        !transaction.numbers.isFinite(reward) ||
        transaction.numbers.cmp(reward, transaction.numbers.fromNumber(0)) <= 0
      ) {
        transaction.reject({ code: "disabled", actionId: prestige.id, reasonKey: "no-reward" });
      }
      transaction.reset(prestige.manifest);
      transaction.add(prestige.reward, reward);
    },
  };
}
