import type { GameDefinition } from "../model/definition.js";
import type { CatchupExecution } from "../offline/processor.js";
import type { SaveCodec } from "../persistence/codec.js";
import type { LoadedCheckpoint, SaveMetadata } from "../persistence/types.js";
import type {
  Command,
  CommandFailure,
  CommandReceipt,
  Game,
  Result,
  Snapshot,
} from "../state/types.js";
import type { TransactionalSaveStore } from "../storage/store.js";

export interface BrowserClock {
  wallNowMs(): number;
  monotonicNowMs(): number;
}

export interface BrowserScheduler {
  every(milliseconds: number, run: () => void): unknown;
  cancel(handle: unknown): void;
}

export type OwnershipStatus = "primary" | "secondary" | "unsupported";

export interface OwnershipPort {
  readonly status: OwnershipStatus;
  acquire(): Promise<boolean>;
  requestOwnership(): Promise<boolean>;
  release(): void;
  subscribe(listener: (status: OwnershipStatus) => void): () => void;
  announceRevision(revision: string): void;
  subscribeRevision(listener: (revision: string) => void): () => void;
  dispose(): void;
}

export type BrowserLifecycleEvent = "visible" | "hidden" | "pagehide" | "pageshow";

export type BrowserHostEvent =
  | { readonly kind: "ownership"; readonly status: OwnershipStatus }
  | { readonly kind: "advanced"; readonly elapsedGameMs: number }
  | { readonly kind: "saved"; readonly revision: string; readonly reason: string }
  | { readonly kind: "conflict"; readonly currentRevision: string | null }
  | { readonly kind: "storage-error"; readonly operation: string; readonly error: unknown }
  | { readonly kind: "clock-anomaly"; readonly anchorMs: number; readonly observedMs: number }
  | { readonly kind: "catchup"; readonly elapsedRealMs: number; readonly advancedGameMs: number }
  | { readonly kind: "imported"; readonly revision: string }
  | { readonly kind: "reset"; readonly revision: string }
  | { readonly kind: "reloaded"; readonly revision: string | null };

export interface BrowserHost<N> {
  readonly ownership: OwnershipStatus;
  readonly game: Game<N>;
  readonly storageRevision: string | null;
  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure<N>>;
  saveNow(reason?: string): Promise<boolean>;
  exportSave(): Promise<string>;
  importSave(raw: string): Promise<boolean>;
  reset(): Promise<boolean>;
  reload(): Promise<void>;
  handleLifecycle(event: BrowserLifecycleEvent): Promise<void>;
  requestOwnership(): Promise<boolean>;
  subscribe(listener: (event: BrowserHostEvent) => void): () => void;
  dispose(): Promise<void>;
}

export interface BrowserHostOptions<N> {
  readonly definition: GameDefinition<N>;
  readonly codec: SaveCodec<N>;
  readonly store: TransactionalSaveStore;
  readonly slot: string;
  readonly initial: { readonly snapshot: Snapshot<N>; readonly metadata: SaveMetadata };
  readonly clock: BrowserClock;
  readonly scheduler: BrowserScheduler;
  readonly ownership: OwnershipPort;
  readonly tickMs?: number;
  readonly autosaveMs?: number;
  readonly catchupStepsPerChunk?: number;
  readonly catchupExecution?: CatchupExecution<N>;
}

export interface ReconciledCheckpoint<N> {
  readonly checkpoint: LoadedCheckpoint<N>;
  readonly elapsedRealMs: number;
  readonly advancedGameMs: number;
  readonly clockAnomaly?: { readonly anchorMs: number; readonly observedMs: number };
}
