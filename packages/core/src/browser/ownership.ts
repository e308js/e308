import type { OwnershipPort, OwnershipStatus } from "./types.js";

type OwnershipMessage =
  | { readonly kind: "request"; readonly sender: string }
  | { readonly kind: "revision"; readonly sender: string; readonly revision: string };

export interface WebLockOwnershipOptions {
  readonly lockName: string;
  readonly channelName?: string;
  readonly ownerId?: string;
  readonly locks?: LockManager | null;
  readonly channel?: BroadcastChannel;
}

export class WebLockOwnership implements OwnershipPort {
  #status: OwnershipStatus;
  readonly #listeners = new Set<(status: OwnershipStatus) => void>();
  readonly #revisionListeners = new Set<(revision: string) => void>();
  readonly #locks: LockManager | undefined;
  readonly #channel: BroadcastChannel;
  readonly #lockName: string;
  readonly #ownerId: string;
  #releaseLock: (() => void) | undefined;
  #disposed = false;

  constructor(options: WebLockOwnershipOptions) {
    this.#locks =
      options.locks === undefined ? globalThis.navigator?.locks : (options.locks ?? undefined);
    this.#status = this.#locks ? "secondary" : "primary";
    this.#lockName = options.lockName;
    this.#ownerId = options.ownerId ?? crypto.randomUUID();
    this.#channel =
      options.channel ?? new BroadcastChannel(options.channelName ?? options.lockName);
    this.#channel.addEventListener("message", this.onMessage);
  }

  get status(): OwnershipStatus {
    return this.#status;
  }

  async acquire(): Promise<boolean> {
    if (this.#disposed) return false;
    if (!this.#locks || this.#status === "primary") return this.#status === "primary";
    let started!: (held: boolean) => void;
    const acquired = new Promise<boolean>((resolve) => (started = resolve));
    void this.#locks.request(this.#lockName, { ifAvailable: true }, async (lock) => {
      if (!lock) return started(false);
      this.setStatus("primary");
      started(true);
      await new Promise<void>((resolve) => (this.#releaseLock = resolve));
      this.#releaseLock = undefined;
      if (!this.#disposed) this.setStatus("secondary");
    });
    return acquired;
  }

  async requestOwnership(): Promise<boolean> {
    if (this.#disposed) return false;
    if (this.#status === "primary") return true;
    this.#channel.postMessage({
      kind: "request",
      sender: this.#ownerId,
    } satisfies OwnershipMessage);
    if (this.#locks) return this.acquireWaiting();
    await Promise.resolve();
    this.setStatus("primary");
    return true;
  }

  release(): void {
    if (this.#locks) this.#releaseLock?.();
    else this.setStatus("secondary");
  }

  subscribe(listener: (status: OwnershipStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  announceRevision(revision: string): void {
    this.#channel.postMessage({
      kind: "revision",
      sender: this.#ownerId,
      revision,
    } satisfies OwnershipMessage);
  }

  subscribeRevision(listener: (revision: string) => void): () => void {
    this.#revisionListeners.add(listener);
    return () => this.#revisionListeners.delete(listener);
  }

  dispose(): void {
    this.#disposed = true;
    this.#releaseLock?.();
    this.#channel.removeEventListener("message", this.onMessage);
    this.#channel.close();
    this.#listeners.clear();
    this.#revisionListeners.clear();
  }

  private readonly onMessage = (event: MessageEvent<OwnershipMessage>): void => {
    const message = event.data;
    if (!message || message.sender === this.#ownerId) return;
    if (message.kind === "request" && this.#status === "primary") this.release();
    if (message.kind === "revision")
      for (const listener of this.#revisionListeners) listener(message.revision);
  };

  private async acquireWaiting(): Promise<boolean> {
    const locks = this.#locks;
    if (!locks) return false;
    let started!: (held: boolean) => void;
    const acquired = new Promise<boolean>((resolve) => (started = resolve));
    void locks.request(this.#lockName, async () => {
      if (this.#disposed) return started(false);
      this.setStatus("primary");
      started(true);
      await new Promise<void>((resolve) => (this.#releaseLock = resolve));
      this.#releaseLock = undefined;
      if (!this.#disposed) this.setStatus("secondary");
    });
    return acquired;
  }

  private setStatus(status: OwnershipStatus): void {
    if (this.#status === status) return;
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
  }
}
