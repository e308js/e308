import type { GameDefinition } from "../model/definition.js";
import { definitionOwner } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import { ownerOf } from "../model/handles.js";
import { NumericFault } from "../numbers/types.js";
import { planAdvance } from "../simulation/clock.js";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CommandFailure =
  | { readonly code: "stale-revision"; readonly expected: bigint; readonly current: bigint }
  | { readonly code: "invalid-target"; readonly id: string }
  | { readonly code: "numeric-fault"; readonly message: string }
  | { readonly code: "transaction-failed"; readonly message: string };

export interface Snapshot<N> {
  readonly revision: bigint;
  readonly gameTimeMs: number;
  readonly remainderMs: number;
  readonly resources: Readonly<Record<string, N>>;
}

export interface Transaction<N> {
  get(resource: Resource<N>): N;
  set(resource: Resource<N>, value: N): void;
  add(resource: Resource<N>, amount: N): void;
}

export interface Command<N> {
  readonly id: string;
  readonly expectedRevision?: bigint;
  execute(transaction: Transaction<N>): void;
}

export interface CommandReceipt {
  readonly commandId: string;
  readonly revision: bigint;
}

export interface Game<N> {
  getSnapshot(): Snapshot<N>;
  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure>;
  advance(
    elapsedMs: number,
    step: (transaction: Transaction<N>, stepSeconds: number) => void,
  ): Result<Snapshot<N>, CommandFailure>;
  subscribe<T>(
    selector: (snapshot: Snapshot<N>) => T,
    listener: (value: T) => void,
    equal?: (left: T, right: T) => boolean,
  ): () => void;
}

interface Subscriber<N> {
  readonly select: (snapshot: Snapshot<N>) => unknown;
  readonly notify: (value: unknown) => void;
  readonly equal: (left: unknown, right: unknown) => boolean;
  selected: unknown;
}

type CompleteDefinition<N> = GameDefinition<N> & {
  readonly numbers: NonNullable<GameDefinition<N>["numbers"]>;
  readonly resources: readonly Resource<N>[];
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
    );
  }

  getSnapshot(): Snapshot<N> {
    return this.#snapshot;
  }

  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure> {
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
    step: (transaction: Transaction<N>, stepSeconds: number) => void,
  ): Result<Snapshot<N>, CommandFailure> {
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
          step(transaction, this.#definition.stepMs / 1000);
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
  ): Result<Snapshot<N>, CommandFailure> {
    const working = { ...this.#snapshot.resources };
    try {
      execute(makeTransaction(this.#owner, working, this.#definition.numbers));
    } catch (error) {
      return { ok: false, error: failureFrom(error) };
    }
    this.commit(working, gameTimeMs, remainderMs);
    return { ok: true, value: this.#snapshot };
  }

  private commit(
    resources: Readonly<Record<string, N>>,
    gameTimeMs: number,
    remainderMs: number,
  ): void {
    this.#snapshot = makeSnapshot(this.#snapshot.revision + 1n, gameTimeMs, remainderMs, resources);
    publish(this.#subscribers, this.#snapshot);
  }
}

function makeSnapshot<N>(
  revision: bigint,
  gameTimeMs: number,
  remainderMs: number,
  resources: Readonly<Record<string, N>>,
): Snapshot<N> {
  return Object.freeze({ revision, gameTimeMs, remainderMs, resources: Object.freeze(resources) });
}

function makeTransaction<N>(
  owner: object,
  working: Record<string, N>,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
): Transaction<N> {
  const assertResource = (resource: Resource<N>): void => {
    if (ownerOf(resource) !== owner || !(resource.id in working))
      throw new InvalidTarget(resource.id);
  };
  return {
    get: (resource) => {
      assertResource(resource);
      return working[resource.id] as N;
    },
    set: (resource, value) => {
      assertResource(resource);
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid value for ${resource.id}`);
      working[resource.id] = value;
    },
    add(resource, amount) {
      this.set(resource, numbers.add(this.get(resource), amount));
    },
  };
}

class InvalidTarget extends Error {
  constructor(readonly id: string) {
    super(`Invalid target: ${id}`);
  }
}

function failureFrom(error: unknown): CommandFailure {
  if (error instanceof InvalidTarget) return { code: "invalid-target", id: error.id };
  if (error instanceof NumericFault) return { code: "numeric-fault", message: error.message };
  return {
    code: "transaction-failed",
    message: error instanceof Error ? error.message : String(error),
  };
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
