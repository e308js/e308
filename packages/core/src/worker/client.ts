import type {
  TransferValue,
  WorkerEndpoint,
  WorkerRequest,
  WorkerResponse,
} from "./protocol.types.js";

export class WorkerProtocolError extends Error {
  constructor(readonly response: Extract<WorkerResponse, { kind: "error" }>) {
    super(response.message);
    this.name = "WorkerProtocolError";
  }
}

export class WorkerClient<I extends TransferValue, S extends TransferValue> {
  readonly #endpoint: WorkerEndpoint<WorkerResponse<S>, WorkerRequest<I, S>>;
  readonly #pending = new Map<string, (response: WorkerResponse<S>) => void>();
  readonly #unsubscribe: () => void;
  #acceptedRevision = 0n;

  constructor(endpoint: WorkerEndpoint<WorkerResponse<S>, WorkerRequest<I, S>>) {
    this.#endpoint = endpoint;
    this.#unsubscribe = endpoint.subscribe((response) => this.receive(response));
  }

  get acceptedRevision(): bigint {
    return this.#acceptedRevision;
  }

  request(request: WorkerRequest<I, S>): Promise<WorkerResponse<S>> {
    if (this.#pending.has(request.requestId))
      return Promise.reject(new TypeError(`Request ${request.requestId} is already pending`));
    return new Promise((resolve) => {
      this.#pending.set(request.requestId, resolve);
      this.#endpoint.postMessage(request);
    });
  }

  dispose(): void {
    this.#unsubscribe();
    this.#pending.clear();
  }

  private receive(response: WorkerResponse<S>): void {
    const revision =
      "revision" in response && response.revision !== undefined
        ? BigInt(response.revision)
        : undefined;
    if (revision !== undefined && revision < this.#acceptedRevision) return;
    if (revision !== undefined && revision > this.#acceptedRevision)
      this.#acceptedRevision = revision;
    const resolve = this.#pending.get(response.requestId);
    if (!resolve) return;
    this.#pending.delete(response.requestId);
    resolve(response);
  }
}
