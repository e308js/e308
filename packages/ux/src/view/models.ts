import type { DescriptionNode, TextValue } from "../localization/types.js";
import type { ActionBlocker } from "./failures.js";

export interface QuantityLine<N> {
  readonly resourceId: string;
  readonly label: TextValue<N>;
  readonly value: N;
  readonly format?: string;
}

export type EtaView =
  | { readonly kind: "finite"; readonly ms: number; readonly clock: "game" | "real" }
  | { readonly kind: "blocked"; readonly reason: TextValue }
  | {
      readonly kind: "capacity-unreachable";
      readonly assumptions: readonly string[];
      readonly proofScope: string;
    }
  | { readonly kind: "unknown" };

export interface ActionView<Intent = unknown, N = unknown> {
  readonly id: string;
  readonly domId?: string;
  readonly label: TextValue<N>;
  readonly description?: readonly DescriptionNode<N>[];
  readonly tooltip?: TextValue<N>;
  readonly enabled: boolean;
  /** Visual and assistive state. Pending actions are never dispatched. */
  readonly state?: "available" | "pending" | "successful" | "rejected";
  readonly tone?: "primary" | "secondary" | "destructive";
  readonly intent: Intent;
  readonly blockers: readonly ActionBlocker<N>[];
  readonly costs?: readonly QuantityLine<N>[];
  readonly rewards?: readonly QuantityLine<N>[];
  readonly eta?: EtaView;
  readonly confirm?: TextValue<N>;
  readonly hold?: {
    readonly intent: Intent;
    readonly delayMs?: number;
    readonly repeatMs?: number;
  };
}

export interface ResourceView<N> extends QuantityLine<N> {
  readonly rate?: N;
  readonly capacity?: N;
}

export interface ResetView<Intent, N> {
  readonly kind: "reset";
  readonly id: string;
  readonly action: ActionView<Intent, N>;
  readonly gain: readonly QuantityLine<N>[];
  readonly clears: readonly TextValue<N>[];
  readonly retains: readonly TextValue<N>[];
}

export interface OfflineView<N> {
  readonly kind: "offline";
  readonly id: string;
  readonly elapsedMs: number;
  readonly processedMs: number;
  readonly pendingMs: number;
  readonly discardedMs: number;
  readonly gains: readonly QuantityLine<N>[];
  readonly policyLabel: TextValue<N>;
}

export interface SaveView<Intent, N = unknown> {
  readonly kind: "save";
  readonly id: string;
  readonly status: "clean" | "saving" | "saved" | "failed";
  readonly lastSavedAtMs?: number;
  readonly message?: TextValue<N>;
  readonly save?: ActionView<Intent, N>;
  readonly export?: ActionView<Intent, N>;
  readonly import?: ActionView<Intent, N>;
  readonly wipe?: ActionView<Intent, N>;
}
