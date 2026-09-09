import type {
  TransferValue,
  WorkerEndpoint,
  WorkerRequest,
  WorkerResponse,
} from "../../packages/core/src/worker/index.js";

export class TestEndpoint<Incoming, Outgoing> implements WorkerEndpoint<Incoming, Outgoing> {
  readonly listeners = new Set<(message: Incoming) => void>();
  peer: TestEndpoint<Outgoing, Incoming> | undefined;

  postMessage(message: Outgoing): void {
    for (const listener of this.peer?.listeners ?? []) listener(message);
  }

  subscribe(listener: (message: Incoming) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function workerEndpointPair<I extends TransferValue, S extends TransferValue>() {
  const runtime = new TestEndpoint<WorkerRequest<I, S>, WorkerResponse<S>>();
  const client = new TestEndpoint<WorkerResponse<S>, WorkerRequest<I, S>>();
  runtime.peer = client;
  client.peer = runtime;
  return { runtime, client };
}
