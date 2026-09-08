import type { AllocationDefinition } from "../economy/allocations.js";
import { validateAllocations } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import { runFlows } from "../economy/flows.js";
import type { FlowDefinition } from "../economy/types.js";
import type { GameDefinition } from "../model/definition.js";
import { definitionOwner } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import { planAdvance } from "../simulation/clock.js";
import { failureFrom, makeTransaction } from "./transaction.js";
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
};

export function createGame<N>(definition: GameDefinition<N>): Game<N> {
  if (!definition.numbers || !definition.resources)
    throw new TypeError("Game definition was not created by createGameKit");
  return Object.freeze(new GameRuntime(definition));
}

class GameRuntime<N> implements Game<N> {
  readonly #definition: CompleteDefinition<N>;
  readonly #owner: object;
  readonly #subscribers = new Set<Subscriber<N>>();
  #snapshot: Snapshot<N>;

  constructor(definition: GameDefinition<N>) {
    this.#definition = definition as CompleteDefinition<N>;
    this.#owner = definitionOwner(definition);
    this.#snapshot = makeSnapshot(
      0n,
      0,
      0,
      Object.fromEntries(
        this.#definition.resources.map((resource) => [resource.id, resource.initial]),
      ),
      Object.fromEntries(
        this.#definition.buyables.map((buyable) => [buyable.id, buyable.initialCount]),
      ),
      Object.fromEntries(
        this.#definition.allocations.map((allocation) => [allocation.id, allocation.initial]),
      ),
      Object.fromEntries(
        this.#definition.resources.map((resource) => [
          resource.id,
          this.#definition.numbers.fromNumber(0),
        ]),
      ),
    );
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
          runFlows(transaction, this.#definition.flows, this.#definition.numbers, seconds);
          step?.(transaction, seconds);
        }
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
    try {
      const transaction = makeTransaction(
        this.#owner,
        working,
        purchaseCounts,
        allocations,
        productionTotals,
        this.#definition.numbers,
      );
      execute(transaction);
      validateAllocations(transaction, this.#definition.allocations);
    } catch (error) {
      return { ok: false, error: failureFrom(error) };
    }
    this.commit(working, gameTimeMs, remainderMs, purchaseCounts, allocations, productionTotals);
    return { ok: true, value: this.#snapshot };
  }

  private commit(
    resources: Readonly<Record<string, N>>,
    gameTimeMs: number,
    remainderMs: number,
    purchaseCounts: Readonly<Record<string, N>> = this.#snapshot.purchaseCounts,
    allocations: Readonly<Record<string, Readonly<Record<string, N>>>> = this.#snapshot.allocations,
    productionTotals: Readonly<Record<string, N>> = this.#snapshot.productionTotals,
  ): void {
    this.#snapshot = makeSnapshot(
      this.#snapshot.revision + 1n,
      gameTimeMs,
      remainderMs,
      resources,
      purchaseCounts,
      allocations,
      productionTotals,
    );
    publish(this.#subscribers, this.#snapshot);
  }
}

function makeSnapshot<N>(
  revision: bigint,
  gameTimeMs: number,
  remainderMs: number,
  resources: Readonly<Record<string, N>>,
  purchaseCounts: Readonly<Record<string, N>>,
  allocations: Readonly<Record<string, Readonly<Record<string, N>>>>,
  productionTotals: Readonly<Record<string, N>>,
): Snapshot<N> {
  const frozenAllocations = Object.fromEntries(
    Object.entries(allocations).map(([id, assignments]) => [id, Object.freeze(assignments)]),
  );
  return Object.freeze({
    revision,
    gameTimeMs,
    remainderMs,
    resources: Object.freeze(resources),
    purchaseCounts: Object.freeze(purchaseCounts),
    allocations: Object.freeze(frozenAllocations),
    productionTotals: Object.freeze(productionTotals),
  });
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
