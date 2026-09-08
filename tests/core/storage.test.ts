import { describe, expect, it } from "vitest";
import {
  commitCatchupChunk,
  createSaveCodec,
  MemorySaveStore,
  StorageFault,
} from "../../packages/core/src/index.js";
import { persistenceFixture } from "../helpers/persistence-fixture.js";

async function storedFixture() {
  const fixture = persistenceFixture();
  const codec = createSaveCodec(fixture.definition, fixture.configuration);
  const entitlement = { ...fixture.entitlement, capMs: 1_000 };
  const raw = codec.encode(fixture.game.getSnapshot(), {
    wallAnchorMs: 0,
    entitlement,
    catchup: null,
  });
  const store = new MemorySaveStore();
  const written = await store.compareAndSwap("main", null, raw);
  if (!written.ok) throw new TypeError("Could not seed storage fixture");
  return { fixture, codec, entitlement, raw, store };
}

describe("transactional save storage", () => {
  it("detects competing compare-and-swap writers", async () => {
    const { store } = await storedFixture();
    const first = await store.read("main");
    if (!first) throw new TypeError("Missing stored fixture");
    expect(await store.compareAndSwap("main", first.revision, first.value)).toMatchObject({
      ok: true,
    });
    expect(await store.readBackup("main")).toEqual(first);
    expect(await store.compareAndSwap("main", first.revision, first.value)).toEqual({
      ok: false,
      code: "conflict",
      currentRevision: "2",
    });
  });

  it("does not commit a chunk when storage fails before the atomic write", async () => {
    const { fixture, codec, store } = await storedFixture();
    const before = await store.read("main");
    store.injectFault("before-commit");
    await expect(
      commitCatchupChunk({
        store,
        slot: "main",
        codec,
        definition: fixture.definition,
        nowMs: 1_000,
        sessionId: "fault-before",
        maximumSteps: 5,
      }),
    ).rejects.toMatchObject({ phase: "before-commit" });
    expect(await store.read("main")).toEqual(before);
  });

  it("resumes after an after-commit crash without duplicating progress", async () => {
    const { fixture, codec, store } = await storedFixture();
    store.injectFault("after-commit");
    await expect(
      commitCatchupChunk({
        store,
        slot: "main",
        codec,
        definition: fixture.definition,
        nowMs: 1_000,
        sessionId: "fault-after",
        maximumSteps: 5,
      }),
    ).rejects.toBeInstanceOf(StorageFault);
    const committed = await store.read("main");
    if (!committed) throw new TypeError("Missing committed save");
    expect(codec.decode(committed.value).catchup).toMatchObject({
      processedRealMs: 500,
      pendingRealMs: 500,
    });

    const completed = await commitCatchupChunk({
      store,
      slot: "main",
      codec,
      definition: fixture.definition,
      nowMs: 2_000,
      sessionId: "ignored-on-resume",
      maximumSteps: 5,
    });
    expect(completed).toMatchObject({ complete: true, pendingRealMs: 0 });
    const final = await store.read("main");
    if (!final) throw new TypeError("Missing final save");
    const loaded = codec.decode(final.value);
    expect(loaded.snapshot.resources.points).toBeCloseTo(12, 12);
    expect(loaded.catchup).toMatchObject({ processedRealMs: 1_000, pendingRealMs: 0 });
  });

  it("surfaces read faults and missing slots without creating state", async () => {
    const { fixture, codec, store } = await storedFixture();
    store.injectFault("read");
    await expect(store.read("main")).rejects.toMatchObject({ phase: "read" });
    await expect(
      commitCatchupChunk({
        store,
        slot: "missing",
        codec,
        definition: fixture.definition,
        nowMs: 1,
        sessionId: "missing",
        maximumSteps: 1,
      }),
    ).rejects.toThrow("No save exists");
  });
});
