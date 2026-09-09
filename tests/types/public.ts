import {
  createGameKit,
  eternityNumbers,
  type NumericAdapter,
  nativeNumbers,
  normalPrestige,
  type Resource,
} from "@e308/core";
import { type CalendarDefinition, currentPhase } from "@e308/core/calendar";
import { type MarketQuote, marketCommand } from "@e308/core/markets";
import { type CatchupExecution, processCatchupChunk } from "@e308/core/offline";
import { createSaveCodec, type SaveEnvelope } from "@e308/core/persistence";
import { MemorySaveStore, type TransactionalSaveStore } from "@e308/core/storage";
import { queueTaskCommand, type TaskDefinition } from "@e308/core/tasks";
import type { ActionView } from "@e308/ux";

const kit = createGameKit({ numbers: nativeNumbers });
const run = kit.scope("run");
const value = kit.resource("value", { scope: run, initial: kit.q("1") });
const numberResource: Resource<number> = value;
const adapter: NumericAdapter<number> = kit.numbers;
const rank = kit.resource("rank", { scope: run, initial: 0 });
const formula = normalPrestige(nativeNumbers, {
  baseResource: value,
  requirement: 10,
  exponent: 0.5,
});
const prestige = kit.prestige("rank-up", {
  scope: run,
  reward: rank,
  manifest: { clear: [run], retain: { resources: [rank] } },
  ...formula,
});
const unlock = kit.upgrade("unlock", {
  scope: run,
  costs: [[value, 1]],
  prerequisiteIds: [],
  unlocked: () => true,
});
const active = kit.scopeActivation("run-active", {
  scope: run,
  active: (state) => state.hasUpgrade(unlock.id),
});
kit.defineGame({
  id: "types",
  simulationVersion: 1,
  stepMs: 50,
  resources: [numberResource, rank],
  prestiges: [prestige],
  upgrades: [unlock],
  scopeActivations: [active],
});

const hugeKit = createGameKit({ numbers: eternityNumbers });
const huge = hugeKit.resource("huge", {
  scope: hugeKit.scope("run"),
  initial: hugeKit.q("1e1000"),
});
// @ts-expect-error numeric backends cannot be mixed in a definition
kit.defineGame({ id: "mixed", simulationVersion: 1, stepMs: 50, resources: [huge] });

const action = {
  id: "buy",
  label: "Buy",
  enabled: false,
  blockers: [{ kind: "locked" }],
} as const satisfies ActionView;

void adapter;
void action;
const execution: CatchupExecution<number> = { kind: "canonical" };
const store: TransactionalSaveStore = new MemorySaveStore();
void createSaveCodec;
void processCatchupChunk;
void execution;
void store;
void (undefined as SaveEnvelope | undefined);
void (undefined as TaskDefinition<number> | undefined);
void (undefined as CalendarDefinition | undefined);
void (undefined as MarketQuote<number> | undefined);
void queueTaskCommand;
void currentPhase;
void marketCommand;
