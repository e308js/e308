import type { Command, Snapshot } from "../state/types.js";

export type TransferValue =
  | null
  | boolean
  | number
  | string
  | readonly TransferValue[]
  | { readonly [key: string]: TransferValue };

interface WorkerRequestBase {
  readonly protocol: 1;
  readonly requestId: string;
}

interface RevisionRequest extends WorkerRequestBase {
  readonly sourceRevision: string;
}

export type WorkerRequest<
  I extends TransferValue = TransferValue,
  S extends TransferValue = TransferValue,
> =
  | (WorkerRequestBase & { readonly kind: "initialize"; readonly snapshot: S })
  | (RevisionRequest & { readonly kind: "advance"; readonly elapsedMs: number })
  | (RevisionRequest & { readonly kind: "dispatch"; readonly intent: I })
  | (RevisionRequest & {
      readonly kind: "catchup";
      readonly elapsedMs: number;
      readonly maximumStepsPerChunk: number;
    })
  | (WorkerRequestBase & { readonly kind: "cancel"; readonly targetRequestId: string })
  | (RevisionRequest & { readonly kind: "snapshot" })
  | (WorkerRequestBase & { readonly kind: "dispose" });

export type WorkerOperation = Exclude<WorkerRequest["kind"], "cancel"> | "cancel";

export type WorkerErrorCode =
  | "protocol"
  | "not-initialized"
  | "already-initialized"
  | "stale-revision"
  | "invalid-intent"
  | "simulation-failed"
  | "invalid-request"
  | "unknown-cancellation-target"
  | "disposed";

export type WorkerResponse<S extends TransferValue = TransferValue> =
  | {
      readonly protocol: 1;
      readonly kind: "ready";
      readonly requestId: string;
      readonly revision: string;
    }
  | {
      readonly protocol: 1;
      readonly kind: "result";
      readonly requestId: string;
      readonly operation: WorkerOperation;
      readonly revision: string;
      readonly snapshot: S;
    }
  | {
      readonly protocol: 1;
      readonly kind: "cancelled";
      readonly requestId: string;
      readonly revision: string;
      readonly snapshot: S;
    }
  | {
      readonly protocol: 1;
      readonly kind: "error";
      readonly requestId: string;
      readonly code: WorkerErrorCode;
      readonly message: string;
      readonly revision?: string;
    };

export interface WorkerTransferCodec<N, I extends TransferValue, S extends TransferValue> {
  encodeSnapshot(snapshot: Snapshot<N>): S;
  decodeSnapshot(value: S): Snapshot<N>;
  decodeIntent(intent: I, snapshot: Snapshot<N>): Command<N>;
}

export interface WorkerEndpoint<Incoming, Outgoing> {
  postMessage(message: Outgoing): void;
  subscribe(listener: (message: Incoming) => void): () => void;
}

export interface WorkerRuntimeOptions<N, I extends TransferValue, S extends TransferValue> {
  readonly definition: import("../model/definition.js").GameDefinition<N>;
  readonly codec: WorkerTransferCodec<N, I, S>;
  readonly endpoint: WorkerEndpoint<WorkerRequest<I, S>, WorkerResponse<S>>;
  readonly yieldControl?: () => Promise<void>;
}

export interface WorkerRuntime {
  dispose(): void;
}
