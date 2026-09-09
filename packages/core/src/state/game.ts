import { type AutomationDefinition, runAutomation } from "../automation/scheduler.js";
import { runCalendars } from "../calendar/runtime.js";
import type { CalendarDefinition } from "../calendar/types.js";
import type { AllocationDefinition } from "../economy/allocations.js";
import { validateAllocations } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import { runFlows } from "../economy/flows.js";
import type { FlowDefinition } from "../economy/types.js";
import type { MarketDefinition } from "../markets/types.js";
import type { GameDefinition } from "../model/definition.js";
import { definitionOwner, definitionScopes } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import type { ScopeActivationDefinition } from "../progression/activation.js";
import { resolveTriggers, resolveWin, type TriggerDefinition } from "../progression/features.js";
import { RandomStreams } from "../random/xoshiro.js";
import { planAdvance } from "../simulation/clock.js";
import { runSteppedRules, type SteppedRuleDefinition } from "../simulation/rules.js";
import { runTasks } from "../tasks/runtime.js";
import type { TaskDefinition } from "../tasks/types.js";
import { cloneProgression, initialProgression } from "./progression-state.js";
import { restoreSnapshot } from "./restore.js";
import { makeSnapshot } from "./snapshot.js";
import {
  cloneCalendars,
  cloneTasks,
  initialCalendars,
  initialMarkets,
  initialTasks,
} from "./timed-state.js";
import { failureFrom, makeTransaction, setTransactionTime } from "./transaction.js";
import type {
  Command,
  CommandFailure,
  CommandReceipt,
  Game,
  Result,
  Snapshot,
  Transaction,
} from "./types.js";

interface Subscriber<N> {
  readonly select: (snapshot: Snapshot<N>) => unknown;
  readonly notify: (value: unknown) => void;
  readonly equal: (left: unknown, right: unknown) => boolean;
  selected: unknown;
}

type CompleteDefinition<N> = GameDefinition<N> & {
  readonly numbers: NonNullable<GameDefinition<N>["numbers"]>;
  readonly resources: readonly Resource<N>[];
  readonly flows: readonly FlowDefinition<N>[];
  readonly buyables: readonly BuyableDefinition<N>[];
  readonly allocations: readonly AllocationDefinition<N>[];
  readonly triggers: readonly TriggerDefinition<N>[];
  readonly automation: readonly AutomationDefinition<N>[];
  readonly scopeActivations: readonly ScopeActivationDefinition<N>[];
  readonly steppedRules: readonly SteppedRuleDefinition<N>[];
  readonly tasks: readonly TaskDefinition<N>[];
  readonly calendars: readonly CalendarDefinition[];
  readonly markets: readonly MarketDefinition<N>[];
};

export function createGame<N>(
  definition: GameDefinition<N>,
  options: { readonly snapshot?: Snapshot<N> } = {},
): Game<N> {
  if (!definition.numbers || !definition.resources)
    throw new TypeError("Game definition was not created by createGameKit");
  return Object.freeze(new GameRuntime(definition, options.snapshot));
}

class GameRuntime<N> implements Game<N> {
  readonly #definition: CompleteDefinition<N>;
  readonly #owner: object;
  readonly #subscribers = new Set<Subscriber<N>>();
  #snapshot: Snapshot<N>;

  constructor(definition: GameDefinition<N>, restored?: Snapshot<N>) {
    this.#definition = definition as CompleteDefinition<N>;
    this.#owner = definitionOwner(definition);
    const initial = makeSnapshot<N>({
      revision: 0n,
      gameTimeMs: 0,
      remainderMs: 0,
      resources: Object.fromEntries(
        this.#definition.resources.map((resource) => [resource.id, resource.initial]),
      ),
      purchaseCounts: Object.fromEntries(
        this.#definition.buyables.map((buyable) => [buyable.id, buyable.initialCount]),
      ),
      allocations: Object.fromEntries(
        this.#definition.allocations.map((allocation) => [allocation.id, allocation.initial]),
      ),
      productionTotals: Object.fromEntries(
        this.#definition.resources.map((resource) => [
          resource.id,
          this.#definition.numbers.fromNumber(0),
        ]),
      ),
      scopeGenerations: initialScopeGenerations(this.#definition),
      progression: initialProgression(),
      random: new RandomStreams(this.#definition.rootSeed ?? "00").snapshot(),
      tasks: initialTasks(this.#definition),
      calendars: initialCalendars(this.#definition),
      markets: initialMarkets(this.#definition),
    });
    this.#snapshot = restoreSnapshot(this.#definition, restored ?? initial);
  }

  getSnapshot(): Snapshot<N> {
    return this.#snapshot;
  }

  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure<N>> {
    if (
      command.expectedRevision !== undefined &&
      command.expectedRevision !== this.#snapshot.revision
    ) {
      return {
        ok: false,
        error: {
          code: "stale-revision",
          expected: command.expectedRevision,
          current: this.#snapshot.revision,
        },
      };
    }
    for (const [scopeId, expected] of Object.entries(command.expectedScopeGenerations ?? {})) {
      const current = this.#snapshot.scopeGenerations[scopeId] ?? 0n;
      if (expected !== current) {
        return { ok: false, error: { code: "stale-revision", expected, current } };
      }
    }
    const result = this.transact(command.execute);
    return result.ok
      ? { ok: true, value: { commandId: command.id, revision: result.value.revision } }
      : result;
  }

  advance(
    elapsedMs: number,
    step?: (transaction: Transaction<N>, stepSeconds: number) => void,
  ): Result<Snapshot<N>, CommandFailure<N>> {
    const plan = planAdvance(this.#snapshot, elapsedMs, this.#definition.stepMs);
    if (
      plan.gameTimeMs === this.#snapshot.gameTimeMs &&
      plan.remainderMs === this.#snapshot.remainderMs
    ) {
      return { ok: true, value: this.#snapshot };
    }
    if (plan.steps === 0) {
      this.commit(this.#snapshot.resources, this.#snapshot.gameTimeMs, plan.remainderMs);
      return { ok: true, value: this.#snapshot };
    }
    return this.transact(
      (transaction) => {
        for (let index = 0; index < plan.steps; index += 1) {
          const seconds = this.#definition.stepMs / 1000;
          const boundaryMs = this.#snapshot.gameTimeMs + (index + 1) * this.#definition.stepMs;
          setTransactionTime(transaction, boundaryMs);
          runFlows(transaction, this.#definition.flows, this.#definition.numbers, seconds);
          runSteppedRules(transaction, this.#definition.steppedRules, seconds);
          step?.(transaction, seconds);
          runTasks(transaction, this.#definition.tasks, this.#definition.stepMs);
          resolveTriggers(transaction, this.#definition.triggers);
          runAutomation(transaction, this.#definition.automation, boundaryMs);
          resolveTriggers(transaction, this.#definition.triggers);
          resolveWin(transaction, this.#definition.win);
          runCalendars(
            transaction,
            this.#definition.calendars,
            this.#definition.stepMs,
            boundaryMs,
          );
        }
      },
      plan.gameTimeMs,
      plan.remainderMs,
    );
  }

  advanceCustom(
    elapsedMs: number,
    apply: (transaction: Transaction<N>, advancedGameMs: number) => void,
  ): Result<Snapshot<N>, CommandFailure<N>> {
    const plan = planAdvance(this.#snapshot, elapsedMs, this.#definition.stepMs);
    const advancedGameMs = plan.gameTimeMs - this.#snapshot.gameTimeMs;
    if (advancedGameMs === 0) {
      if (plan.remainderMs !== this.#snapshot.remainderMs)
        this.commit(this.#snapshot.resources, this.#snapshot.gameTimeMs, plan.remainderMs);
      return { ok: true, value: this.#snapshot };
    }
    return this.transact(
      (transaction) => {
        setTransactionTime(transaction, plan.gameTimeMs);
        apply(transaction, advancedGameMs);
      },
      plan.gameTimeMs,
      plan.remainderMs,
    );
  }

  subscribe<T>(
    selector: (snapshot: Snapshot<N>) => T,
    listener: (value: T) => void,
    equal: (left: T, right: T) => boolean = Object.is,
  ): () => void {
    const subscriber: Subscriber<N> = {
      select: selector,
      notify: listener as (value: unknown) => void,
      equal: equal as (left: unknown, right: unknown) => boolean,
      selected: selector(this.#snapshot),
    };
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }

  private transact(
    execute: (transaction: Transaction<N>) => void,
    gameTimeMs = this.#snapshot.gameTimeMs,
    remainderMs = this.#snapshot.remainderMs,
  ): Result<Snapshot<N>, CommandFailure<N>> {
    const working = { ...this.#snapshot.resources };
    const purchaseCounts = { ...this.#snapshot.purchaseCounts };
    const allocations = Object.fromEntries(
      Object.entries(this.#snapshot.allocations).map(([id, assignments]) => [
        id,
        { ...assignments },
      ]),
    );
    const productionTotals = { ...this.#snapshot.productionTotals };
    const scopeGenerations = { ...this.#snapshot.scopeGenerations };
    const progression = cloneProgression(this.#snapshot.progression);
    const random = new RandomStreams(this.#snapshot.random.rootSeed, this.#snapshot.random.streams);
    const tasks = cloneTasks(this.#snapshot.tasks);
    const calendars = cloneCalendars(this.#snapshot.calendars);
    const markets = Object.fromEntries(
      Object.entries(this.#snapshot.markets).map(([id, state]) => [id, { ...state }]),
    );
    try {
      const transaction = makeTransaction(
        this.#owner,
        working,
        purchaseCounts,
        allocations,
        productionTotals,
        scopeGenerations,
        this.#definition,
        progression,
        random,
        tasks,
        calendars,
        markets,
        this.#snapshot.gameTimeMs,
        this.#definition.numbers,
      );
      execute(transaction);
      validateAllocations(transaction, this.#definition.allocations);
      resolveTriggers(transaction, this.#definition.triggers);
      resolveWin(transaction, this.#definition.win);
    } catch (error) {
      return { ok: false, error: failureFrom(error) };
    }
    this.commit(
      working,
      gameTimeMs,
      remainderMs,
      purchaseCounts,
      allocations,
      productionTotals,
      scopeGenerations,
      progression,
      random.snapshot(),
      tasks,
      calendars,
      markets,
    );
    return { ok: true, value: this.#snapshot };
  }

  private commit(
    resources: Readonly<Record<string, N>>,
    gameTimeMs: number,
    remainderMs: number,
    purchaseCounts: Readonly<Record<string, N>> = this.#snapshot.purchaseCounts,
    allocations: Readonly<Record<string, Readonly<Record<string, N>>>> = this.#snapshot.allocations,
    productionTotals: Readonly<Record<string, N>> = this.#snapshot.productionTotals,
    scopeGenerations: Readonly<Record<string, bigint>> = this.#snapshot.scopeGenerations,
    progression = cloneProgression(this.#snapshot.progression),
    random = this.#snapshot.random,
    tasks = cloneTasks(this.#snapshot.tasks),
    calendars = cloneCalendars(this.#snapshot.calendars),
    markets = { ...this.#snapshot.markets },
  ): void {
    this.#snapshot = makeSnapshot({
      revision: this.#snapshot.revision + 1n,
      gameTimeMs,
      remainderMs,
      resources,
      purchaseCounts,
      allocations,
      productionTotals,
      scopeGenerations,
      progression,
      random,
      tasks,
      calendars,
      markets,
    });
    publish(this.#subscribers, this.#snapshot);
  }
}

function initialScopeGenerations<N>(definition: CompleteDefinition<N>): Record<string, bigint> {
  return Object.fromEntries(definitionScopes(definition).map((scope) => [scope.id, 0n]));
}

function publish<N>(subscribers: Set<Subscriber<N>>, snapshot: Snapshot<N>): void {
  for (const subscriber of subscribers) {
    const selected = subscriber.select(snapshot);
    if (subscriber.equal(selected, subscriber.selected)) continue;
    subscriber.selected = selected;
    try {
      subscriber.notify(selected);
    } catch {
      // Observer failures are isolated from committed simulation state.
    }
  }
}
