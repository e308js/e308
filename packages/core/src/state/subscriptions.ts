import type { Snapshot } from "./types.js";

interface Subscriber<N> {
  readonly select: (snapshot: Snapshot<N>) => unknown;
  readonly notify: (value: unknown) => void;
  readonly equal: (left: unknown, right: unknown) => boolean;
  selected: unknown;
}

export class SnapshotSubscriptions<N> {
  readonly #subscribers = new Set<Subscriber<N>>();

  subscribe<T>(
    snapshot: Snapshot<N>,
    selector: (snapshot: Snapshot<N>) => T,
    listener: (value: T) => void,
    equal: (left: T, right: T) => boolean,
  ): () => void {
    const subscriber: Subscriber<N> = {
      select: selector,
      notify: listener as (value: unknown) => void,
      equal: equal as (left: unknown, right: unknown) => boolean,
      selected: selector(snapshot),
    };
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }

  publish(snapshot: Snapshot<N>): void {
    for (const subscriber of this.#subscribers) {
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
}
