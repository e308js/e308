import { describe, expect, it } from "vitest";
import { createGame, createGameKit, nativeNumbers } from "../../packages/core/src/index.js";
import type { Snapshot, Transaction } from "../../packages/core/src/state/types.js";
import {
  attachWorkerRuntime,
  messageEndpoint,
  WorkerClient,
  WorkerProtocolError,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerTransferCodec,
} from "../../packages/core/src/worker/index.js";
import { TestEndpoint, workerEndpointPair } from "../helpers/worker-endpoint.js";

type Intent =
  | { readonly kind: "add"; readonly amount: number }
  | { readonly kind: "reject" }
  | { readonly kind: "invalid" };

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const scope = kit.scope("run");
  const points = kit.resource("points", { scope, initial: 0 });
  const flow = kit.flow("income", {
    scope,
    rate: kit.rates.constant(2),
    produces: [[points, 1]],
  });
  const definition = kit.defineGame({
    id: "worker-test",
    simulationVersion: 1,
    stepMs: 100,
    resources: [points],
    flows: [flow],
  });
  const game = createGame(definition);
  const codec: WorkerTransferCodec<number, Intent, string> = {
    encodeSnapshot: encodeSnapshot,
    decodeSnapshot: decodeSnapshot,
    decodeIntent: (intent) => {
      if (intent.kind === "invalid") throw new TypeError("unknown intent");
      if (intent.kind === "reject")
        return {
          id: "reject",
          execute: (transaction) => transaction.reject({ code: "invalid-target", id: "nope" }),
        };
      return {
        id: "add",
        execute: (transaction: Transaction<number>) => transaction.add(points, intent.amount),
      };
    },
  };
  return { definition, game, codec };
}

function encodeSnapshot(snapshot: Snapshot<number>): string {
  return JSON.stringify(snapshot, (_key, value: unknown) =>
    typeof value === "bigint" ? { e308BigInt: value.toString() } : value,
  );
}

function decodeSnapshot(value: string): Snapshot<number> {
  return JSON.parse(value, (_key, current: unknown) => {
    if (
      typeof current === "object" &&
      current !== null &&
      "e308BigInt" in current &&
      typeof current.e308BigInt === "string"
    ) {
      return BigInt(current.e308BigInt);
    }
    return current;
  }) as Snapshot<number>;
}

describe("worker runtime", () => {
  it("matches main-thread advancement, dispatches intents, and caches replies", async () => {
    const subject = fixture();
    const endpoints = workerEndpointPair<Intent, string>();
    const runtime = attachWorkerRuntime({
      definition: subject.definition,
      codec: subject.codec,
      endpoint: endpoints.runtime,
    });
    const client = new WorkerClient(endpoints.client);
    const before = await client.request({
      protocol: 1,
      kind: "snapshot",
      requestId: "before",
      sourceRevision: "0",
    });
    expect(before).toMatchObject({ kind: "error", code: "not-initialized" });
    const initial = encodeSnapshot(subject.game.getSnapshot());
    expect(
      await client.request({
        protocol: 1,
        kind: "initialize",
        requestId: "init",
        snapshot: initial,
      }),
    ).toMatchObject({ kind: "ready", revision: "0" });
    subject.game.advance(300);
    const advanced = await client.request({
      protocol: 1,
      kind: "advance",
      requestId: "advance",
      sourceRevision: "0",
      elapsedMs: 300,
    });
    expect(advanced.kind).toBe("result");
    if (advanced.kind !== "result") throw new Error("expected result");
    expect(decodeSnapshot(advanced.snapshot)).toEqual(subject.game.getSnapshot());
    const cached: WorkerResponse<string>[] = [];
    const unsubscribe = endpoints.client.subscribe((response) => cached.push(response));
    endpoints.client.postMessage({
      protocol: 1,
      kind: "advance",
      requestId: "advance",
      sourceRevision: "0",
      elapsedMs: 999,
    });
    expect(cached.at(-1)).toEqual(advanced);
    unsubscribe();
    const dispatched = await client.request({
      protocol: 1,
      kind: "dispatch",
      requestId: "dispatch",
      sourceRevision: advanced.revision,
      intent: { kind: "add", amount: 4 },
    });
    expect(dispatched).toMatchObject({ kind: "result", revision: "2" });
    const snapshot = await client.request({
      protocol: 1,
      kind: "snapshot",
      requestId: "snapshot",
      sourceRevision: "2",
    });
    expect(snapshot).toMatchObject({ kind: "result", operation: "snapshot" });
    expect(client.acceptedRevision).toBe(2n);
    client.dispose();
    runtime.dispose();
  });

  it("reports stale revisions, invalid requests, intents, and simulation failures", async () => {
    const subject = fixture();
    const endpoints = workerEndpointPair<Intent, string>();
    attachWorkerRuntime({
      definition: subject.definition,
      codec: subject.codec,
      endpoint: endpoints.runtime,
    });
    const client = new WorkerClient(endpoints.client);
    const protocol: WorkerResponse<string>[] = [];
    const stopProtocol = endpoints.client.subscribe((response) => protocol.push(response));
    endpoints.client.postMessage({
      protocol: 2,
      kind: "snapshot",
      requestId: "protocol",
      sourceRevision: "0",
    } as unknown as WorkerRequest<Intent, string>);
    expect(protocol.at(-1)).toMatchObject({ kind: "error", code: "protocol" });
    stopProtocol();
    const initial = encodeSnapshot(subject.game.getSnapshot());
    await client.request({ protocol: 1, kind: "initialize", requestId: "init", snapshot: initial });
    expect(
      await client.request({
        protocol: 1,
        kind: "initialize",
        requestId: "again",
        snapshot: initial,
      }),
    ).toMatchObject({ kind: "error", code: "already-initialized" });
    expect(
      await client.request({
        protocol: 1,
        kind: "advance",
        requestId: "bad-time",
        sourceRevision: "0",
        elapsedMs: -1,
      }),
    ).toMatchObject({ kind: "error", code: "invalid-request" });
    expect(
      await client.request({
        protocol: 1,
        kind: "dispatch",
        requestId: "bad-intent",
        sourceRevision: "0",
        intent: { kind: "invalid" },
      }),
    ).toMatchObject({ kind: "error", code: "invalid-intent" });
    expect(
      await client.request({
        protocol: 1,
        kind: "dispatch",
        requestId: "rejected",
        sourceRevision: "0",
        intent: { kind: "reject" },
      }),
    ).toMatchObject({ kind: "error", code: "simulation-failed" });
    expect(
      await client.request({
        protocol: 1,
        kind: "snapshot",
        requestId: "stale",
        sourceRevision: "99",
      }),
    ).toMatchObject({ kind: "error", code: "stale-revision", revision: "0" });
    expect(
      await client.request({
        protocol: 1,
        kind: "catchup",
        requestId: "bad-budget",
        sourceRevision: "0",
        elapsedMs: 100,
        maximumStepsPerChunk: 0,
      }),
    ).toMatchObject({ kind: "error", code: "invalid-request" });
    expect(
      await client.request({
        protocol: 1,
        kind: "cancel",
        requestId: "unknown-cancel",
        targetRequestId: "missing",
      }),
    ).toMatchObject({ kind: "error", code: "unknown-cancellation-target" });
  });

  it("acknowledges cancellation after the last committed chunk", async () => {
    const subject = fixture();
    const endpoints = workerEndpointPair<Intent, string>();
    const releases: (() => void)[] = [];
    attachWorkerRuntime({
      definition: subject.definition,
      codec: subject.codec,
      endpoint: endpoints.runtime,
      yieldControl: () => new Promise<void>((resolve) => releases.push(resolve)),
    });
    const client = new WorkerClient(endpoints.client);
    await client.request({
      protocol: 1,
      kind: "initialize",
      requestId: "init",
      snapshot: encodeSnapshot(subject.game.getSnapshot()),
    });
    const catchup = client.request({
      protocol: 1,
      kind: "catchup",
      requestId: "catchup",
      sourceRevision: "0",
      elapsedMs: 500,
      maximumStepsPerChunk: 1,
    });
    expect(releases).toHaveLength(1);
    expect(
      await client.request({
        protocol: 1,
        kind: "cancel",
        requestId: "cancel",
        targetRequestId: "catchup",
      }),
    ).toMatchObject({ kind: "result", operation: "cancel", revision: "1" });
    releases.shift()?.();
    const cancelled = await catchup;
    expect(cancelled).toMatchObject({ kind: "cancelled", revision: "1" });
    if (cancelled.kind !== "cancelled") throw new Error("expected cancellation");
    expect(decodeSnapshot(cancelled.snapshot).gameTimeMs).toBe(100);
  });

  it("completes chunked catch-up and handles disposal", async () => {
    const subject = fixture();
    const endpoints = workerEndpointPair<Intent, string>();
    const runtime = attachWorkerRuntime({
      definition: subject.definition,
      codec: subject.codec,
      endpoint: endpoints.runtime,
    });
    const client = new WorkerClient(endpoints.client);
    await client.request({
      protocol: 1,
      kind: "initialize",
      requestId: "init",
      snapshot: encodeSnapshot(subject.game.getSnapshot()),
    });
    expect(
      await client.request({
        protocol: 1,
        kind: "catchup",
        requestId: "catchup",
        sourceRevision: "0",
        elapsedMs: 250,
        maximumStepsPerChunk: 1,
      }),
    ).toMatchObject({ kind: "result", operation: "catchup", revision: "3" });
    expect(
      await client.request({ protocol: 1, kind: "dispose", requestId: "dispose" }),
    ).toMatchObject({ kind: "error", code: "disposed" });
    expect(
      await client.request({
        protocol: 1,
        kind: "snapshot",
        requestId: "after",
        sourceRevision: "3",
      }),
    ).toMatchObject({ kind: "error", code: "disposed" });
    runtime.dispose();
  });
});

describe("worker client and endpoint", () => {
  it("rejects duplicate pending IDs, ignores unknown replies, and adapts message targets", async () => {
    const endpoint = new TestEndpoint<WorkerResponse<string>, WorkerRequest<Intent, string>>();
    const client = new WorkerClient(endpoint);
    const pending = client.request({
      protocol: 1,
      kind: "snapshot",
      requestId: "same",
      sourceRevision: "0",
    });
    await expect(
      client.request({ protocol: 1, kind: "snapshot", requestId: "same", sourceRevision: "0" }),
    ).rejects.toThrow("already pending");
    for (const listener of endpoint.listeners)
      listener({ protocol: 1, kind: "ready", requestId: "unknown", revision: "0" });
    client.dispose();
    void pending;

    const target = new EventTarget() as EventTarget & { postMessage(message: string): void };
    const sent: string[] = [];
    target.postMessage = (message) => sent.push(message);
    const adapted = messageEndpoint<string, string>(
      target as unknown as Parameters<typeof messageEndpoint<string, string>>[0],
    );
    const received: string[] = [];
    const unsubscribe = adapted.subscribe((message) => received.push(message));
    adapted.postMessage("out");
    target.dispatchEvent(new MessageEvent("message", { data: "in" }));
    unsubscribe();
    target.dispatchEvent(new MessageEvent("message", { data: "ignored" }));
    expect({ sent, received }).toEqual({ sent: ["out"], received: ["in"] });

    const error = new WorkerProtocolError({
      protocol: 1,
      kind: "error",
      requestId: "e",
      code: "protocol",
      message: "bad protocol",
    });
    expect(error.name).toBe("WorkerProtocolError");
    expect(error.response.code).toBe("protocol");
  });
});
