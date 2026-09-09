import type { GameDefinition } from "../model/definition.js";
import type { Game } from "../state/types.js";
import { advanceOptimized } from "./advance.js";
import type { AdvancementOptions, BacklogResult } from "./types.js";

export class AdvanceBacklog<N> {
  #pendingMs: number;

  constructor(
    readonly game: Game<N>,
    readonly definition: GameDefinition<N>,
    readonly maximumPendingMs: number,
    initialPendingMs = 0,
  ) {
    validateDuration(maximumPendingMs, "maximum pending time");
    validateDuration(initialPendingMs, "initial pending time");
    if (initialPendingMs > maximumPendingMs)
      throw new TypeError("Initial pending time exceeds the backlog limit");
    this.#pendingMs = initialPendingMs;
  }

  get pendingMs(): number {
    return this.#pendingMs;
  }

  add(elapsedMs: number): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    validateDuration(elapsedMs, "backlog addition");
    const next = this.#pendingMs + elapsedMs;
    if (!Number.isSafeInteger(next) || next > this.maximumPendingMs)
      return { ok: false, reason: "backlog-overflow" };
    this.#pendingMs = next;
    return { ok: true };
  }

  process(options: AdvancementOptions<N>): BacklogResult<N> {
    const result = advanceOptimized(this.game, this.definition, this.#pendingMs, options);
    this.#pendingMs = result.pendingRealMs;
    return { ...result, backlogMs: this.#pendingMs };
  }
}

function validateDuration(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${name} must be a nonnegative safe integer`);
}
