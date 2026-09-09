import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";
import {
  bindBrowserLifecycle,
  browserClock,
  browserScheduler,
  WebLockOwnership,
} from "../../packages/core/src/browser/index.js";
import type { BrowserHost, BrowserLifecycleEvent } from "../../packages/core/src/browser/types.js";

class TestChannel extends EventTarget {
  readonly sent: unknown[] = [];
  closed = false;
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
  close(): void {
    this.closed = true;
  }
  receive(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

class TestLocks {
  held = false;
  async request(
    _name: string,
    options: { ifAvailable?: boolean } | ((lock: Lock) => Promise<void>),
    maybeCallback?: (lock: Lock | null) => Promise<void>,
  ): Promise<void> {
    const callback: ((lock: Lock | null) => Promise<void>) | undefined =
      typeof options === "function" ? (lock) => options(lock as Lock) : maybeCallback;
    if (!callback) throw new TypeError("callback required");
    if (this.held && typeof options !== "function" && options.ifAvailable) return callback(null);
    while (this.held) await Promise.resolve();
    this.held = true;
    try {
      await callback({ name: "test", mode: "exclusive" } as Lock);
    } finally {
      this.held = false;
    }
  }
}

describe("browser ownership", () => {
  it("acquires, announces, handles transfer requests, and releases", async () => {
    const channel = new TestChannel();
    const locks = new TestLocks();
    const owner = new WebLockOwnership({
      lockName: "game",
      ownerId: "a",
      channel: channel as unknown as BroadcastChannel,
      locks: locks as unknown as LockManager,
    });
    const statuses: string[] = [];
    const revisions: string[] = [];
    const unsubscribeStatus = owner.subscribe((status) => statuses.push(status));
    const unsubscribeRevision = owner.subscribeRevision((revision) => revisions.push(revision));
    expect(await owner.acquire()).toBe(true);
    expect(await owner.acquire()).toBe(true);
    expect(await owner.requestOwnership()).toBe(true);
    owner.announceRevision("2");
    channel.receive({ kind: "revision", sender: "b", revision: "3" });
    channel.receive({ kind: "revision", sender: "a", revision: "4" });
    expect(revisions).toEqual(["3"]);
    channel.receive({ kind: "request", sender: "b" });
    await vi.waitFor(() => expect(owner.status).toBe("secondary"));
    expect(statuses).toEqual(["primary", "secondary"]);
    expect(channel.sent).toContainEqual({ kind: "revision", sender: "a", revision: "2" });
    expect(await owner.requestOwnership()).toBe(true);
    owner.release();
    await vi.waitFor(() => expect(owner.status).toBe("secondary"));
    unsubscribeStatus();
    unsubscribeRevision();
    owner.dispose();
    expect(channel.closed).toBe(true);
  });

  it("uses compare-and-swap ownership fallback without Web Locks", async () => {
    const channel = new TestChannel();
    const owner = new WebLockOwnership({
      lockName: "unsupported",
      ownerId: "a",
      channel: channel as unknown as BroadcastChannel,
      locks: null,
    });
    expect(owner.status).toBe("primary");
    expect(await owner.acquire()).toBe(true);
    owner.release();
    expect(owner.status).toBe("secondary");
    expect(await owner.requestOwnership()).toBe(true);
    owner.dispose();
    expect(await owner.acquire()).toBe(false);
    expect(await owner.requestOwnership()).toBe(false);
  });

  it("reports a contended Web Lock", async () => {
    const locks = new TestLocks();
    locks.held = true;
    const owner = new WebLockOwnership({
      lockName: "busy",
      ownerId: "a",
      channel: new TestChannel() as unknown as BroadcastChannel,
      locks: locks as unknown as LockManager,
    });
    expect(await owner.acquire()).toBe(false);
    owner.dispose();
  });

  it("uses platform lock, channel, and owner defaults", async () => {
    const owner = new WebLockOwnership({ lockName: `defaults-${Date.now()}` });
    expect(["primary", "secondary"]).toContain(owner.status);
    if (owner.status === "secondary") {
      expect(await owner.acquire()).toBe(true);
      owner.release();
    }
    owner.dispose();
  });
});

describe("browser adapters", () => {
  it("binds and unbinds document lifecycle events", async () => {
    const window = new Window();
    const events: BrowserLifecycleEvent[] = [];
    const host = {
      handleLifecycle: async (event: BrowserLifecycleEvent) => void events.push(event),
    } as unknown as BrowserHost<unknown>;
    const unbind = bindBrowserLifecycle(
      host,
      window.document as unknown as Document,
      window as unknown as Parameters<typeof bindBrowserLifecycle>[2],
    );
    Object.defineProperty(window.document, "hidden", { configurable: true, value: true });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    window.dispatchEvent(new window.Event("pagehide"));
    window.dispatchEvent(new window.Event("pageshow"));
    Object.defineProperty(window.document, "hidden", { configurable: true, value: false });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    await Promise.resolve();
    expect(events).toEqual(["hidden", "pagehide", "pageshow", "visible"]);
    unbind();
    window.dispatchEvent(new window.Event("pageshow"));
    expect(events).toHaveLength(4);

    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    const addDescriptor = Object.getOwnPropertyDescriptor(globalThis, "addEventListener");
    const removeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "removeEventListener");
    Object.defineProperties(globalThis, {
      document: { configurable: true, value: window.document },
      addEventListener: { configurable: true, value: window.addEventListener.bind(window) },
      removeEventListener: { configurable: true, value: window.removeEventListener.bind(window) },
    });
    const unbindDefaults = bindBrowserLifecycle(host);
    unbindDefaults();
    restoreGlobal("document", documentDescriptor);
    restoreGlobal("addEventListener", addDescriptor);
    restoreGlobal("removeEventListener", removeDescriptor);
  });

  it("provides default clocks and cancellable scheduling", () => {
    expect(Number.isFinite(browserClock.wallNowMs())).toBe(true);
    expect(Number.isFinite(browserClock.monotonicNowMs())).toBe(true);
    vi.useFakeTimers();
    const run = vi.fn();
    const handle = browserScheduler.every(10, run);
    vi.advanceTimersByTime(10);
    expect(run).toHaveBeenCalledOnce();
    browserScheduler.cancel(handle);
    vi.advanceTimersByTime(20);
    expect(run).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
