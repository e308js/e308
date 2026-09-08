export interface StoredSave {
  readonly revision: string;
  readonly value: string;
}

export type StoreWriteResult =
  | { readonly ok: true; readonly revision: string }
  | { readonly ok: false; readonly code: "conflict"; readonly currentRevision: string | null };

export interface TransactionalSaveStore {
  read(slot: string): Promise<StoredSave | null>;
  readBackup(slot: string): Promise<StoredSave | null>;
  compareAndSwap(
    slot: string,
    expectedRevision: string | null,
    value: string,
  ): Promise<StoreWriteResult>;
}

export class StorageFault extends Error {
  constructor(
    readonly phase: "read" | "before-commit" | "after-commit",
    message = `Injected storage fault at ${phase}`,
  ) {
    super(message);
    this.name = "StorageFault";
  }
}

export class MemorySaveStore implements TransactionalSaveStore {
  readonly #records = new Map<string, StoredSave>();
  readonly #backups = new Map<string, StoredSave>();
  #fault: StorageFault["phase"] | undefined;

  injectFault(phase: StorageFault["phase"]): void {
    this.#fault = phase;
  }

  async read(slot: string): Promise<StoredSave | null> {
    this.failAt("read");
    return this.#records.get(slot) ?? null;
  }

  async readBackup(slot: string): Promise<StoredSave | null> {
    this.failAt("read");
    return this.#backups.get(slot) ?? null;
  }

  async compareAndSwap(
    slot: string,
    expectedRevision: string | null,
    value: string,
  ): Promise<StoreWriteResult> {
    this.failAt("before-commit");
    const current = this.#records.get(slot);
    if ((current?.revision ?? null) !== expectedRevision)
      return { ok: false, code: "conflict", currentRevision: current?.revision ?? null };
    const revision = (BigInt(current?.revision ?? "0") + 1n).toString();
    if (current) this.#backups.set(slot, current);
    this.#records.set(slot, Object.freeze({ revision, value }));
    this.failAt("after-commit");
    return { ok: true, revision };
  }

  private failAt(phase: StorageFault["phase"]): void {
    if (this.#fault !== phase) return;
    this.#fault = undefined;
    throw new StorageFault(phase);
  }
}
