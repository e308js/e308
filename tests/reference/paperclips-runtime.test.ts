import { beginCatchup, processCatchupChunk, type Transaction } from "@e308/core";
import { attachWorkerRuntime, WorkerClient } from "@e308/core/worker";
import { describe, expect, it } from "vitest";
import {
  createPaperclipsReference,
  importPaperclipsReference,
  type PaperclipsIntent,
  paperclipsDefinition,
  paperclipsResources,
  paperclipsSaveCodec,
  paperclipsWorkerCodec,
} from "../../reference/paperclips/full/index.js";
import { workerEndpointPair } from "../helpers/worker-endpoint.js";

describe("Universal Paperclips runtime boundaries", () => {
  it("round-trips late-game magnitude and progression through its save envelope", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.clips, 5e31);
      transaction.setProgress("milestone", "industry-phase");
      transaction.setProgress("milestone", "space-phase");
      transaction.setProgress("upgrade", "monument");
    });
    const restored = importPaperclipsReference(game.exportSave(123_456)).getSnapshot();
    expect(restored.resources.clips).toBe(5e31);
    expect(restored.progression.milestones).toMatchObject({
      "industry-phase": true,
      "space-phase": true,
    });
    expect(restored.progression.upgrades).toHaveProperty("monument");
  });

  it("resumes interrupted canonical offline progress exactly", () => {
    const saved = createPaperclipsReference();
    seed(saved, (transaction) => transaction.set(paperclipsResources.wire, 100));
    const loaded = paperclipsSaveCodec.decode(saved.exportSave(1_000));
    const started = beginCatchup(paperclipsDefinition, loaded, 61_000, "paperclips-catchup");
    if (!started.catchup) throw new TypeError("Expected catch-up session");
    const resumed = createPaperclipsReference(started.snapshot);
    const first = processCatchupChunk(paperclipsDefinition, resumed.game, started.catchup, 10);
    expect(first).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
    if (first.ok) throw new TypeError("Expected interrupted catch-up");
    const second = processCatchupChunk(
      paperclipsDefinition,
      resumed.game,
      first.error.session,
      100,
    );
    expect(second).toMatchObject({ ok: true, value: { complete: true } });
    const direct = createPaperclipsReference(loaded.snapshot);
    direct.advanceAway(60_000);
    expect({ ...resumed.getSnapshot(), revision: 0n }).toEqual({
      ...direct.getSnapshot(),
      revision: 0n,
    });
  });

  it("matches main-thread dispatch and advancement through the worker protocol", async () => {
    const endpoints = workerEndpointPair<PaperclipsIntent, string>();
    const runtime = attachWorkerRuntime({
      definition: paperclipsDefinition,
      codec: paperclipsWorkerCodec,
      endpoint: endpoints.runtime,
    });
    const client = new WorkerClient<PaperclipsIntent, string>(endpoints.client);
    const main = createPaperclipsReference();
    await client.request({
      protocol: 1,
      kind: "initialize",
      requestId: "paperclips-init",
      snapshot: paperclipsWorkerCodec.encodeSnapshot(main.getSnapshot()),
    });
    const made = await client.request({
      protocol: 1,
      kind: "dispatch",
      requestId: "paperclips-make",
      sourceRevision: "0",
      intent: { type: "make-clip", count: 10 },
    });
    expect(made).toMatchObject({ kind: "result", revision: "1" });
    main.dispatch({ type: "make-clip", count: 10 });
    const advanced = await client.request({
      protocol: 1,
      kind: "advance",
      requestId: "paperclips-advance",
      sourceRevision: "1",
      elapsedMs: 10_000,
    });
    if (advanced.kind !== "result") throw new TypeError("Expected worker result");
    main.advance(10_000);
    expect({ ...paperclipsWorkerCodec.decodeSnapshot(advanced.snapshot), revision: 0n }).toEqual({
      ...main.getSnapshot(),
      revision: 0n,
    });
    client.dispose();
    runtime.dispose();
  });
});

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "paperclips-runtime-seed", execute: apply });
}
