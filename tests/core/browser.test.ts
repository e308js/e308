import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  type BrowserClock,
  type BrowserScheduler,
  IndexedDbSaveStore,
  type OwnershipPort,
  type OwnershipStatus,
  openBrowserHost,
  reconcileCheckpoint,
} from "../../packages/core/src/browser/index.js";
import { createSaveCodec } from "../../packages/core/src/persistence/index.js";
import type { Transaction } from "../../packages/core/src/state/types.js";
import { MemorySaveStore, StorageFault } from "../../packages/core/src/storage/index.js";
import {
  createCascadeKernel,
  createHearthKernel,
  createWireworksKernel,
} from "../helpers/kernels.js";
import { persistenceFixture } from "../helpers/persistence-fixture.js";

class TestClock implements BrowserClock {
  wall = 0;
  monotonic = 0;
  wallNowMs = () => this.wall;
  monotonicNowMs = () => this.monotonic;
}

class TestScheduler implements BrowserScheduler {
  readonly runs = new Map<object, () => void>();
  every(_milliseconds: number, run: () => void): object {
    const handle = {};
    this.runs.set(handle, run);
    return handle;
  }
  cancel(handle: unknown): void {
    this.runs.delete(handle as object);
  }
  runAll(): void {
    for (const run of [...this.runs.values()]) run();
  }
}

class TestOwnership implements OwnershipPort {
  readonly statuses = new Set<(status: OwnershipStatus) => void>();
  readonly revisions = new Set<(revision: string) => void>();
  readonly announced: string[] = [];
  disposed = false;
  constructor(public status: OwnershipStatus) {}
  async acquire(): Promise<boolean> {
    return this.status === "primary";
  }
  async requestOwnership(): Promise<boolean> {
    if (this.status === "unsupported") return false;
    this.status = "primary";
    for (const listener of this.statuses) listener(this.status);
    return true;
  }
  release(): void {
    this.status = "secondary";
    for (const listener of this.statuses) listener(this.status);
  }
  subscribe(listener: (status: OwnershipStatus) => void): () => void {
    this.statuses.add(listener);
    return () => this.statuses.delete(listener);
  }
  announceRevision(revision: string): void {
    this.announced.push(revision);
    for (const listener of this.revisions) listener(revision);
  }
  subscribeRevision(listener: (revision: string) => void): () => void {
    this.revisions.add(listener);
    return () => this.revisions.delete(listener);
  }
  dispose(): void {
    this.disposed = true;
  }
}

function setup(status: OwnershipStatus = "primary") {
  const fixture = persistenceFixture();
  const codec = createSaveCodec(fixture.definition, fixture.configuration);
  const store = new MemorySaveStore();
  const clock = new TestClock();
  const scheduler = new TestScheduler();
  const ownership = new TestOwnership(status);
  return {
    fixture,
    codec,
    store,
    clock,
    scheduler,
    ownership,
    options: {
      definition: fixture.definition,
      codec,
      store,
      slot: "main",
      initial: {
        snapshot: fixture.game.getSnapshot(),
        metadata: {
          wallAnchorMs: 0,
          entitlement: fixture.entitlement,
          catchup: null,
        },
      },
      clock,
      scheduler,
      ownership,
      tickMs: 100,
      autosaveMs: 500,
      catchupStepsPerChunk: 2,
    },
  } as const;
}

describe("browser host", () => {
  it("carries fractional monotonic milliseconds into integer simulation time", async () => {
    const context = setup();
    const { autosaveMs: _autosaveMs, ...options } = context.options;
    const host = await openBrowserHost(options);
    context.clock.monotonic = 0.6;
    context.scheduler.runAll();
    expect(host.game.getSnapshot().remainderMs).toBe(0);
    context.clock.monotonic = 1.2;
    context.scheduler.runAll();
    expect(host.game.getSnapshot().remainderMs).toBe(1);
    await host.dispose();
  });

  it("round-trips Wireworks, Cascade, and Hearth through the browser host", async () => {
    const kernels = [createWireworksKernel(), createCascadeKernel(), createHearthKernel()];
    for (const { definition, game } of kernels) {
      const codec = createSaveCodec(definition, {
        stateSchemaVersion: 1,
        contentVersion: "1.0.0",
        contentDigest: `${definition.id}-browser`,
      });
      const clock = new TestClock();
      const scheduler = new TestScheduler();
      const host = await openBrowserHost({
        definition,
        codec,
        store: new MemorySaveStore(),
        slot: definition.id,
        initial: {
          snapshot: game.getSnapshot(),
          metadata: {
            wallAnchorMs: 0,
            entitlement: {
              policyVersion: "test",
              enabled: true,
              capMs: null,
              excess: "discard",
            },
            catchup: null,
          },
        },
        clock,
        scheduler,
        ownership: new TestOwnership("primary"),
        tickMs: 100,
      });
      clock.monotonic = 2_000;
      scheduler.runAll();
      const saved = codec.decode(await host.exportSave());
      expect(saved.snapshot).toEqual(host.game.getSnapshot());
      expect(saved.snapshot.gameTimeMs).toBe(2_000);
      await host.dispose();
    }
  });

  it("separates monotonic active time from wall-clock catch-up", async () => {
    const context = setup();
    const host = await openBrowserHost(context.options);
    const events: string[] = [];
    host.subscribe((event) => events.push(event.kind));
    context.clock.monotonic = 100;
    context.scheduler.runAll();
    context.clock.monotonic = 200;
    context.clock.wall = 200;
    await host.handleLifecycle("hidden");
    expect(context.scheduler.runs.size).toBe(0);
    context.clock.wall = 1_200;
    await host.handleLifecycle("visible");
    expect(host.game.getSnapshot().gameTimeMs).toBe(1_200);
    expect(host.game.getSnapshot().resources.points).toBeCloseTo(12.4);
    expect(events).toContain("catchup");
    expect(await host.saveNow()).toBe(true);
    const exported = await host.exportSave();
    expect(context.codec.inspect(exported).format).toBe("e308-save");
    await host.dispose();
    await host.dispose();
    expect(context.ownership.disposed).toBe(true);
  });

  it("keeps secondary views read-only and supports explicit takeover", async () => {
    const primary = setup();
    const first = await openBrowserHost(primary.options);
    await first.dispose();
    const ownership = new TestOwnership("secondary");
    const secondary = await openBrowserHost({ ...primary.options, ownership });
    const command = {
      id: "manual",
      execute: (transaction: Transaction<number>) => transaction.add(primary.fixture.points, 1),
    };
    expect(secondary.dispatch(command)).toMatchObject({ ok: false, error: { code: "disabled" } });
    expect(await secondary.saveNow()).toBe(false);
    expect(await secondary.importSave(await secondary.exportSave())).toBe(false);
    expect(await secondary.reset()).toBe(false);
    expect(await secondary.requestOwnership()).toBe(true);
    expect(secondary.dispatch(command).ok).toBe(true);
    await secondary.handleLifecycle("pagehide");
    await secondary.handleLifecycle("pageshow");
    await secondary.dispose();
  });

  it("reports compare-and-swap conflicts and storage faults without overwriting", async () => {
    const context = setup();
    const host = await openBrowserHost(context.options);
    const events: string[] = [];
    host.subscribe((event) => events.push(event.kind));
    const raw = await host.exportSave();
    const external = await context.store.compareAndSwap("main", host.storageRevision, raw);
    expect(external.ok).toBe(true);
    expect(await host.saveNow()).toBe(false);
    expect(events).toContain("conflict");
    expect(host.ownership).toBe("secondary");
    await host.dispose();

    const faulty = setup();
    const faultyHost = await openBrowserHost(faulty.options);
    const failures: string[] = [];
    faultyHost.subscribe((event) => failures.push(event.kind));
    faulty.store.injectFault("before-commit");
    expect(await faultyHost.saveNow()).toBe(false);
    expect(failures).toContain("storage-error");
    faulty.store.injectFault("read");
    await expect(faultyHost.reload()).rejects.toBeInstanceOf(StorageFault);
    await faultyHost.dispose();
  });

  it("validates settings and imported saves", async () => {
    const context = setup();
    await expect(openBrowserHost({ ...context.options, tickMs: 0 })).rejects.toThrow("tickMs");
    await expect(openBrowserHost({ ...context.options, autosaveMs: 0 })).rejects.toThrow(
      "autosaveMs",
    );
    await expect(openBrowserHost({ ...context.options, catchupStepsPerChunk: 0 })).rejects.toThrow(
      "catchupStepsPerChunk",
    );
    const host = await openBrowserHost(context.options);
    await expect(host.importSave("bad save")).rejects.toThrow();
    const raw = await host.exportSave();
    expect(await host.importSave(raw)).toBe(true);
    expect(await host.reset()).toBe(true);
    expect(host.game.getSnapshot()).toEqual(context.fixture.game.getSnapshot());
    expect(await host.requestOwnership()).toBe(true);
    await host.dispose();
    expect(await host.requestOwnership()).toBe(false);
  });
});

describe("checkpoint reconciliation", () => {
  it("handles zero elapsed time and backward wall clocks", () => {
    const context = setup();
    const raw = context.codec.encode(
      context.fixture.game.getSnapshot(),
      context.options.initial.metadata,
    );
    const checkpoint = context.codec.decode(raw);
    const current = reconcileCheckpoint({
      definition: context.fixture.definition,
      checkpoint,
      nowMs: 0,
      sessionId: "zero",
      maximumSteps: 1,
    });
    expect(current.elapsedRealMs).toBe(0);
    const anomaly = reconcileCheckpoint({
      definition: context.fixture.definition,
      checkpoint: { ...checkpoint, wallAnchorMs: 10 },
      nowMs: 5,
      sessionId: "backward",
      maximumSteps: 1,
    });
    expect(anomaly.clockAnomaly).toEqual({ anchorMs: 10, observedMs: 5 });
  });
});

describe("IndexedDbSaveStore", () => {
  it("atomically writes, backs up, conflicts, persists, and closes", async () => {
    const indexedDB = new IDBFactory();
    const first = new IndexedDbSaveStore({ indexedDB, databaseName: "test" });
    expect(await first.read("slot")).toBeNull();
    expect(await first.readBackup("slot")).toBeNull();
    expect(await first.compareAndSwap("slot", null, "one")).toEqual({ ok: true, revision: "1" });
    expect(await first.compareAndSwap("slot", null, "bad")).toEqual({
      ok: false,
      code: "conflict",
      currentRevision: "1",
    });
    expect(await first.compareAndSwap("slot", "1", "two")).toEqual({ ok: true, revision: "2" });
    expect(await first.read("slot")).toEqual({ revision: "2", value: "two" });
    expect(await first.readBackup("slot")).toEqual({ revision: "1", value: "one" });
    const second = new IndexedDbSaveStore({ indexedDB, databaseName: "test" });
    expect(await second.read("slot")).toEqual({ revision: "2", value: "two" });
    first.close();
    second.close();
  });

  it("rejects unavailable IndexedDB", () => {
    expect(() => new IndexedDbSaveStore({ indexedDB: null })).toThrow("unavailable");
  });

  it("reports a blocked database open and supports default options", async () => {
    const blocked = {
      open: () => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() => request.onblocked?.(new Event("blocked") as IDBVersionChangeEvent));
        return request;
      },
    } as unknown as IDBFactory;
    const store = new IndexedDbSaveStore({ indexedDB: blocked, databaseName: "blocked" });
    await expect(store.read("slot")).rejects.toThrow("blocked");

    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() });
    const defaults = new IndexedDbSaveStore();
    expect(await defaults.read("slot")).toBeNull();
    defaults.close();
    if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  });
});
