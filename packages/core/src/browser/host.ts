import type { LoadedCheckpoint, SaveMetadata } from "../persistence/types.js";
import { createGame } from "../state/game.js";
import type { Command, CommandFailure, CommandReceipt, Game, Result } from "../state/types.js";
import { reconcileCheckpoint } from "./reconcile.js";
import type {
  BrowserHost,
  BrowserHostEvent,
  BrowserHostOptions,
  BrowserLifecycleEvent,
} from "./types.js";

export async function openBrowserHost<N>(options: BrowserHostOptions<N>): Promise<BrowserHost<N>> {
  validateOptions(options);
  const host = new BrowserHostRuntime(options);
  await host.open();
  return host;
}

class BrowserHostRuntime<N> implements BrowserHost<N> {
  readonly #options: BrowserHostOptions<N>;
  readonly #listeners = new Set<(event: BrowserHostEvent) => void>();
  readonly #unsubscribers: (() => void)[] = [];
  #game: Game<N>;
  #metadata: SaveMetadata;
  #storageRevision: string | null = null;
  #lastMonotonicMs: number;
  #monotonicCarryMs = 0;
  #timer: unknown;
  #autosaveTimer: unknown;
  #visible = true;
  #disposed = false;
  #sessionSequence = 0;
  #writeTail: Promise<void> = Promise.resolve();

  constructor(options: BrowserHostOptions<N>) {
    this.#options = options;
    this.#game = createGame(options.definition, { snapshot: options.initial.snapshot });
    this.#metadata = options.initial.metadata;
    this.#lastMonotonicMs = options.clock.monotonicNowMs();
  }

  get ownership() {
    return this.#options.ownership.status;
  }

  get game() {
    return this.#game;
  }

  get storageRevision(): string | null {
    return this.#storageRevision;
  }

  async open(): Promise<void> {
    this.#unsubscribers.push(
      this.#options.ownership.subscribe((status) => {
        this.emit({ kind: "ownership", status });
        if (status === "primary") this.startTimers();
        else this.stopTimers();
      }),
      this.#options.ownership.subscribeRevision((revision) => {
        if (revision === this.#storageRevision) return;
        if (this.ownership === "primary") this.#options.ownership.release();
        void this.reload();
      }),
    );
    await this.#options.ownership.acquire();
    await this.reload();
    if (this.ownership === "primary" && this.#storageRevision === null)
      await this.persist("initial");
    this.startTimers();
  }

  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure<N>> {
    if (this.ownership !== "primary")
      return {
        ok: false,
        error: { code: "disabled", actionId: command.id, reasonKey: "secondary" },
      };
    this.advanceActiveTime();
    return this.#game.dispatch(command);
  }

  async saveNow(reason = "manual"): Promise<boolean> {
    if (this.ownership !== "primary" || this.#disposed) return false;
    this.advanceActiveTime();
    return this.persist(reason);
  }

  async exportSave(): Promise<string> {
    if (this.ownership === "primary") await this.saveNow("export");
    const stored = await this.#options.store.read(this.#options.slot);
    if (!stored) throw new TypeError(`No save exists in slot ${this.#options.slot}`);
    this.#options.codec.inspect(stored.value);
    return stored.value;
  }

  async importSave(raw: string): Promise<boolean> {
    if (this.ownership !== "primary" || this.#disposed) return false;
    const checkpoint = this.#options.codec.decode(raw);
    return this.replaceSave(raw, checkpoint, "imported");
  }

  async reset(): Promise<boolean> {
    if (this.ownership !== "primary" || this.#disposed) return false;
    const raw = this.#options.codec.encode(this.#options.initial.snapshot, {
      ...this.#options.initial.metadata,
      wallAnchorMs: this.#options.clock.wallNowMs(),
      catchup: null,
    });
    return this.replaceSave(raw, this.#options.codec.decode(raw), "reset");
  }

  private async replaceSave(
    raw: string,
    checkpoint: LoadedCheckpoint<N>,
    kind: "imported" | "reset",
  ): Promise<boolean> {
    const written = await this.#options.store.compareAndSwap(
      this.#options.slot,
      this.#storageRevision,
      raw,
    );
    if (!written.ok) return this.onConflict(written.currentRevision);
    this.#storageRevision = written.revision;
    this.install(checkpoint);
    this.#options.ownership.announceRevision(written.revision);
    this.emit({ kind, revision: written.revision });
    return true;
  }

  async reload(): Promise<void> {
    if (this.#disposed) return;
    try {
      const stored = await this.#options.store.read(this.#options.slot);
      this.#storageRevision = stored?.revision ?? null;
      if (stored) {
        const checkpoint = this.#options.codec.decode(stored.value);
        if (this.ownership === "primary") await this.installReconciled(checkpoint);
        else this.install(checkpoint);
      }
      this.#lastMonotonicMs = this.#options.clock.monotonicNowMs();
      this.#monotonicCarryMs = 0;
      this.emit({ kind: "reloaded", revision: this.#storageRevision });
    } catch (error) {
      this.emit({ kind: "storage-error", operation: "reload", error });
      throw error;
    }
  }

  async handleLifecycle(event: BrowserLifecycleEvent): Promise<void> {
    if (this.#disposed) return;
    if (event === "hidden" || event === "pagehide") {
      this.advanceActiveTime();
      this.#visible = false;
      this.stopTimers();
      await this.persist(event);
      return;
    }
    this.#visible = true;
    await this.reload();
    this.startTimers();
  }

  async requestOwnership(): Promise<boolean> {
    if (this.#disposed) return false;
    const acquired = await this.#options.ownership.requestOwnership();
    if (acquired) await this.reload();
    return acquired;
  }

  subscribe(listener: (event: BrowserHostEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    if (this.ownership === "primary") await this.saveNow("dispose");
    this.#disposed = true;
    this.stopTimers();
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#options.ownership.dispose();
    this.#listeners.clear();
  }

  private async installReconciled(checkpoint: LoadedCheckpoint<N>): Promise<void> {
    const reconciled = reconcileCheckpoint({
      definition: this.#options.definition,
      checkpoint,
      nowMs: this.#options.clock.wallNowMs(),
      sessionId: `${this.#options.slot}:${++this.#sessionSequence}`,
      maximumSteps: this.#options.catchupStepsPerChunk ?? 10_000,
      ...(this.#options.catchupExecution ? { execution: this.#options.catchupExecution } : {}),
    });
    if (reconciled.clockAnomaly) this.emit({ kind: "clock-anomaly", ...reconciled.clockAnomaly });
    this.install(reconciled.checkpoint);
    if (reconciled.elapsedRealMs > 0) {
      this.emit({
        kind: "catchup",
        elapsedRealMs: reconciled.elapsedRealMs,
        advancedGameMs: reconciled.advancedGameMs,
      });
      await this.persist("catchup");
    }
  }

  private install(checkpoint: LoadedCheckpoint<N>): void {
    this.#game = createGame(this.#options.definition, { snapshot: checkpoint.snapshot });
    this.#metadata = {
      wallAnchorMs: checkpoint.wallAnchorMs,
      entitlement: checkpoint.entitlement,
      catchup: checkpoint.catchup,
      migrationLedger: checkpoint.migrationLedger,
      lastDeliveredEvent: checkpoint.lastDeliveredEvent,
    };
  }

  private advanceActiveTime(): void {
    const now = this.#options.clock.monotonicNowMs();
    if (this.ownership === "primary" && this.#visible) {
      const total = this.#monotonicCarryMs + Math.max(0, now - this.#lastMonotonicMs);
      const elapsed = Math.floor(total);
      this.#monotonicCarryMs = total - elapsed;
      if (elapsed > 0) {
        this.#game.advance(elapsed);
        this.emit({ kind: "advanced", elapsedGameMs: elapsed });
      }
    }
    this.#lastMonotonicMs = now;
  }

  private async persist(reason: string): Promise<boolean> {
    const operation = this.#writeTail.then(() => this.write(reason));
    this.#writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async write(reason: string): Promise<boolean> {
    if (this.ownership !== "primary" || this.#disposed) return false;
    try {
      const anchor = this.#options.clock.wallNowMs();
      const value = this.#options.codec.encode(this.#game.getSnapshot(), {
        ...this.#metadata,
        wallAnchorMs: anchor,
      });
      const written = await this.#options.store.compareAndSwap(
        this.#options.slot,
        this.#storageRevision,
        value,
      );
      if (!written.ok) return this.onConflict(written.currentRevision);
      this.#storageRevision = written.revision;
      this.#metadata = { ...this.#metadata, wallAnchorMs: anchor };
      this.#options.ownership.announceRevision(written.revision);
      this.emit({ kind: "saved", revision: written.revision, reason });
      return true;
    } catch (error) {
      this.emit({ kind: "storage-error", operation: "save", error });
      return false;
    }
  }

  private onConflict(currentRevision: string | null): false {
    this.emit({ kind: "conflict", currentRevision });
    this.stopTimers();
    this.#options.ownership.release();
    return false;
  }

  private startTimers(): void {
    if (this.#timer !== undefined || !this.#visible || this.ownership !== "primary") return;
    this.#lastMonotonicMs = this.#options.clock.monotonicNowMs();
    this.#monotonicCarryMs = 0;
    this.#timer = this.#options.scheduler.every(this.#options.tickMs ?? 100, () => {
      this.advanceActiveTime();
    });
    if (this.#options.autosaveMs !== undefined && this.#autosaveTimer === undefined) {
      this.#autosaveTimer = this.#options.scheduler.every(this.#options.autosaveMs, () => {
        void this.saveNow("autosave");
      });
    }
  }

  private stopTimers(): void {
    if (this.#timer !== undefined) this.#options.scheduler.cancel(this.#timer);
    if (this.#autosaveTimer !== undefined) this.#options.scheduler.cancel(this.#autosaveTimer);
    this.#timer = undefined;
    this.#autosaveTimer = undefined;
  }

  private emit(event: BrowserHostEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

function validateOptions<N>(options: BrowserHostOptions<N>): void {
  for (const [name, value] of [
    ["tickMs", options.tickMs ?? 100],
    ["catchupStepsPerChunk", options.catchupStepsPerChunk ?? 10_000],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be positive`);
  }
  if (
    options.autosaveMs !== undefined &&
    (!Number.isSafeInteger(options.autosaveMs) || options.autosaveMs < 1)
  )
    throw new TypeError("autosaveMs must be positive");
}
