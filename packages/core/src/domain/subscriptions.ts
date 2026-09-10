import type { DomainEvent } from "./types.js";

export class DomainEventSubscriptions {
  readonly #listeners = new Set<(events: readonly DomainEvent[]) => void>();
  #publishing = false;

  get publishing(): boolean {
    return this.#publishing;
  }

  subscribe(listener: (events: readonly DomainEvent[]) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(events: readonly DomainEvent[]): void {
    this.#publishing = true;
    try {
      for (const listener of this.#listeners) {
        try {
          listener(events);
        } catch {
          // Event observers cannot invalidate an already committed transaction.
        }
      }
    } finally {
      this.#publishing = false;
    }
  }
}
