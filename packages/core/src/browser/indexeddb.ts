import type { StoredSave, StoreWriteResult, TransactionalSaveStore } from "../storage/store.js";

interface SaveRecord {
  readonly slot: string;
  readonly revision: string;
  readonly value: string;
  readonly backup?: StoredSave;
}

export interface IndexedDbSaveStoreOptions {
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly indexedDB?: IDBFactory | null;
}

export class IndexedDbSaveStore implements TransactionalSaveStore {
  readonly #database: Promise<IDBDatabase>;

  constructor(options: IndexedDbSaveStoreOptions = {}) {
    const factory = options.indexedDB === undefined ? globalThis.indexedDB : options.indexedDB;
    if (!factory) throw new TypeError("IndexedDB is unavailable");
    this.#database = openDatabase(
      factory,
      options.databaseName ?? "e308-saves",
      options.databaseVersion ?? 1,
    );
  }

  async read(slot: string): Promise<StoredSave | null> {
    return recordValue(await this.readRecord(slot), "value");
  }

  async readBackup(slot: string): Promise<StoredSave | null> {
    return (await this.readRecord(slot))?.backup ?? null;
  }

  async compareAndSwap(
    slot: string,
    expectedRevision: string | null,
    value: string,
  ): Promise<StoreWriteResult> {
    const database = await this.#database;
    const transaction = database.transaction("saves", "readwrite");
    const store = transaction.objectStore("saves");
    const current = await request<SaveRecord | undefined>(store.get(slot));
    if ((current?.revision ?? null) !== expectedRevision) {
      transaction.abort();
      return { ok: false, code: "conflict", currentRevision: current?.revision ?? null };
    }
    const revision = (BigInt(current?.revision ?? "0") + 1n).toString();
    const next: SaveRecord = {
      slot,
      revision,
      value,
      ...(current ? { backup: { revision: current.revision, value: current.value } } : {}),
    };
    store.put(next);
    await completion(transaction);
    return { ok: true, revision };
  }

  close(): void {
    void this.#database.then((database) => database.close());
  }

  private async readRecord(slot: string): Promise<SaveRecord | null> {
    const database = await this.#database;
    const transaction = database.transaction("saves", "readonly");
    const result = await request<SaveRecord | undefined>(
      transaction.objectStore("saves").get(slot),
    );
    await completion(transaction);
    return result ?? null;
  }
}

function openDatabase(factory: IDBFactory, name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(name, version);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains("saves"))
        opening.result.createObjectStore("saves", { keyPath: "slot" });
    };
    opening.onblocked = () => reject(new Error(`IndexedDB open blocked for ${name}`));
    opening.onerror = () =>
      reject(new Error(`IndexedDB open failed for ${name}`, { cause: opening.error }));
    opening.onsuccess = () => resolve(opening.result);
  });
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () =>
      reject(new Error("IndexedDB request failed", { cause: operation.error }));
  });
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(new Error("IndexedDB transaction aborted", { cause: transaction.error }));
    transaction.onerror = () =>
      reject(new Error("IndexedDB transaction failed", { cause: transaction.error }));
  });
}

function recordValue(record: SaveRecord | null, field: "value"): StoredSave | null {
  return record ? { revision: record.revision, value: record[field] } : null;
}
