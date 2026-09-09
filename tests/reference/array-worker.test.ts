import { attachWorkerRuntime, WorkerClient } from "@e308/core/worker";
import { describe, expect, it } from "vitest";
import {
  type ArrayIntent,
  arrayDefinition,
  arrayWorkerCodec,
  createArrayReference,
} from "../../reference/array/index.js";
import { workerEndpointPair } from "../helpers/worker-endpoint.js";

describe("Array Game worker execution", () => {
  it("matches main-thread commands and 16 ms advancement", async () => {
    const endpoints = workerEndpointPair<ArrayIntent, string>();
    const runtime = attachWorkerRuntime({
      definition: arrayDefinition,
      codec: arrayWorkerCodec,
      endpoint: endpoints.runtime,
    });
    const client = new WorkerClient<ArrayIntent, string>(endpoints.client);
    const main = createArrayReference();
    await client.request({
      protocol: 1,
      kind: "initialize",
      requestId: "array-init",
      snapshot: arrayWorkerCodec.encodeSnapshot(main.getSnapshot()),
    });
    const bought = await client.request({
      protocol: 1,
      kind: "dispatch",
      requestId: "array-buy",
      sourceRevision: "0",
      intent: { type: "buy-generator", family: "A", tier: 1, mode: "one" },
    });
    expect(bought).toMatchObject({ kind: "result", revision: "1" });
    main.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "one" });
    const advanced = await client.request({
      protocol: 1,
      kind: "advance",
      requestId: "array-advance",
      sourceRevision: "1",
      elapsedMs: 1_600,
    });
    expect(advanced).toMatchObject({ kind: "result", operation: "advance" });
    if (advanced.kind !== "result") throw new TypeError("Expected worker result");
    main.advance(1_600);
    expect({ ...arrayWorkerCodec.decodeSnapshot(advanced.snapshot), revision: 0n }).toEqual({
      ...main.getSnapshot(),
      revision: 0n,
    });
    client.dispose();
    runtime.dispose();
  });
});
