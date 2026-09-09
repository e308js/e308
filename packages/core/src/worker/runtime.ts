import { createGame } from "../state/game.js";
import type { Game } from "../state/types.js";
import type {
  TransferValue,
  WorkerRequest,
  WorkerResponse,
  WorkerRuntime,
  WorkerRuntimeOptions,
} from "./protocol.types.js";

export function attachWorkerRuntime<N, I extends TransferValue, S extends TransferValue>(
  options: WorkerRuntimeOptions<N, I, S>,
): WorkerRuntime {
  return new RuntimeController(options);
}

class RuntimeController<N, I extends TransferValue, S extends TransferValue>
  implements WorkerRuntime
{
  readonly #active = new Set<string>();
  readonly #cancelled = new Set<string>();
  readonly #completed = new Map<string, WorkerResponse<S>>();
  readonly #unsubscribe: () => void;
  #game: Game<N> | undefined;
  #disposed = false;

  constructor(readonly options: WorkerRuntimeOptions<N, I, S>) {
    this.#unsubscribe = options.endpoint.subscribe((request) => void this.handle(request));
  }

  dispose(): void {
    this.#disposed = true;
    this.#unsubscribe();
    this.#active.clear();
    this.#cancelled.clear();
  }

  private send(response: WorkerResponse<S>): void {
    if (response.kind !== "error" || response.code !== "protocol")
      this.#completed.set(response.requestId, response);
    this.options.endpoint.postMessage(response);
  }

  private async handle(request: WorkerRequest<I, S>): Promise<void> {
    if (request.protocol !== 1 || !request.requestId || !validKind(request.kind)) {
      this.send(errorResponse(request.requestId ?? "", "protocol", "Unsupported worker message"));
      return;
    }
    const cached = this.#completed.get(request.requestId);
    if (cached) return this.options.endpoint.postMessage(cached);
    if (this.#disposed)
      return this.send(errorResponse(request.requestId, "disposed", "Worker runtime is disposed"));
    if (request.kind === "cancel") {
      if (!this.#active.has(request.targetRequestId))
        return this.send(
          errorResponse(request.requestId, "unknown-cancellation-target", "Target is not active"),
        );
      this.#cancelled.add(request.targetRequestId);
      if (this.#game)
        this.send(resultResponse(this.options, request.requestId, "cancel", this.#game));
      return;
    }
    if (request.kind === "dispose") {
      this.#disposed = true;
      this.send(errorResponse(request.requestId, "disposed", "Worker runtime is disposed"));
      return;
    }
    this.#active.add(request.requestId);
    try {
      if (request.kind === "initialize") return this.initialize(request);
      if (!this.#game)
        return this.send(
          errorResponse(request.requestId, "not-initialized", "Worker is not initialized"),
        );
      await this.execute(request, this.#game);
    } finally {
      this.#active.delete(request.requestId);
      this.#cancelled.delete(request.requestId);
    }
  }

  private initialize(request: Extract<WorkerRequest<I, S>, { kind: "initialize" }>): void {
    if (this.#game) {
      this.send(
        errorResponse(request.requestId, "already-initialized", "Worker already initialized"),
      );
      return;
    }
    this.#game = createGame(this.options.definition, {
      snapshot: this.options.codec.decodeSnapshot(request.snapshot),
    });
    this.send({
      protocol: 1,
      kind: "ready",
      requestId: request.requestId,
      revision: this.#game.getSnapshot().revision.toString(),
    });
  }

  private async execute(
    request: Exclude<WorkerRequest<I, S>, { kind: "initialize" | "cancel" | "dispose" }>,
    game: Game<N>,
  ): Promise<void> {
    const stale = checkRevision(request.sourceRevision, game.getSnapshot().revision);
    if (stale) return this.send(errorResponse(request.requestId, "stale-revision", stale, game));
    if (request.kind === "catchup")
      return runCatchup(this.options, game, request, this.#cancelled, (value) => this.send(value));
    if (request.kind === "advance") {
      if (!validDuration(request.elapsedMs))
        return this.send(
          errorResponse(request.requestId, "invalid-request", "Elapsed time is invalid", game),
        );
      const result = game.advance(request.elapsedMs);
      if (!result.ok)
        return this.send(
          errorResponse(request.requestId, "simulation-failed", result.error.code, game),
        );
    } else if (request.kind === "dispatch") {
      try {
        const result = game.dispatch(
          this.options.codec.decodeIntent(request.intent, game.getSnapshot()),
        );
        if (!result.ok)
          return this.send(
            errorResponse(request.requestId, "simulation-failed", result.error.code, game),
          );
      } catch (error) {
        return this.send(
          errorResponse(request.requestId, "invalid-intent", messageOf(error), game),
        );
      }
    }
    this.send(resultResponse(this.options, request.requestId, request.kind, game));
  }
}

async function runCatchup<N, I extends TransferValue, S extends TransferValue>(
  options: WorkerRuntimeOptions<N, I, S>,
  game: Game<N>,
  request: Extract<WorkerRequest<I, S>, { kind: "catchup" }>,
  cancelled: Set<string>,
  send: (response: WorkerResponse<S>) => void,
): Promise<void> {
  if (!validDuration(request.elapsedMs) || !validBudget(request.maximumStepsPerChunk))
    return send(
      errorResponse(request.requestId, "invalid-request", "Catch-up budget is invalid", game),
    );
  let remaining = request.elapsedMs;
  const duration = request.maximumStepsPerChunk * options.definition.stepMs;
  while (remaining > 0) {
    if (cancelled.has(request.requestId))
      return send(cancelledResponse(options, request.requestId, game));
    const chunk = Math.min(remaining, duration);
    const result = game.advance(chunk);
    if (!result.ok)
      return send(errorResponse(request.requestId, "simulation-failed", result.error.code, game));
    remaining -= chunk;
    await (options.yieldControl?.() ?? Promise.resolve());
  }
  if (cancelled.has(request.requestId))
    return send(cancelledResponse(options, request.requestId, game));
  send(resultResponse(options, request.requestId, "catchup", game));
}

function resultResponse<N, I extends TransferValue, S extends TransferValue>(
  options: WorkerRuntimeOptions<N, I, S>,
  requestId: string,
  operation: "advance" | "dispatch" | "catchup" | "snapshot" | "cancel",
  game: Game<N>,
): WorkerResponse<S> {
  const snapshot = game.getSnapshot();
  return {
    protocol: 1,
    kind: "result",
    requestId,
    operation,
    revision: snapshot.revision.toString(),
    snapshot: options.codec.encodeSnapshot(snapshot),
  };
}

function cancelledResponse<N, I extends TransferValue, S extends TransferValue>(
  options: WorkerRuntimeOptions<N, I, S>,
  requestId: string,
  game: Game<N>,
): WorkerResponse<S> {
  const snapshot = game.getSnapshot();
  return {
    protocol: 1,
    kind: "cancelled",
    requestId,
    revision: snapshot.revision.toString(),
    snapshot: options.codec.encodeSnapshot(snapshot),
  };
}

function errorResponse<N, S extends TransferValue>(
  requestId: string,
  code: Extract<WorkerResponse<S>, { kind: "error" }>["code"],
  message: string,
  game?: Game<N>,
): WorkerResponse<S> {
  return {
    protocol: 1,
    kind: "error",
    requestId,
    code,
    message,
    ...(game ? { revision: game.getSnapshot().revision.toString() } : {}),
  };
}

function checkRevision(source: string, current: bigint): string | undefined {
  return source === current.toString()
    ? undefined
    : `Expected revision ${current}, received ${source}`;
}

function validDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validBudget(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validKind(value: string): value is WorkerRequest["kind"] {
  return ["initialize", "advance", "dispatch", "catchup", "cancel", "snapshot", "dispose"].includes(
    value,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
