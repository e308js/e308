import type { CommandFailure } from "@e308/core";

export type ActionBlocker<N = unknown> =
  | {
      readonly kind: "insufficient";
      readonly resourceId: string;
      readonly required: N;
      readonly available: N;
    }
  | {
      readonly kind: "capacity-blocked";
      readonly resourceId: string;
      readonly attempted: N;
      readonly capacity: N;
    }
  | { readonly kind: "locked"; readonly prerequisiteIds: readonly string[] }
  | {
      readonly kind: "cooldown";
      readonly actionId: string;
      readonly remainingMs: number;
      readonly clock: "game" | "real";
    }
  | { readonly kind: "invalid-count"; readonly requested: N | number }
  | {
      readonly kind: "allocation-exceeded";
      readonly allocationId: string;
      readonly assigned: N;
      readonly budget: N;
    }
  | { readonly kind: "stale-revision"; readonly expected: bigint; readonly current: bigint }
  | { readonly kind: "invalid-target"; readonly id: string }
  | { readonly kind: "disabled"; readonly actionId: string; readonly reasonKey: string }
  | { readonly kind: "budget-exceeded"; readonly budgetId: string }
  | { readonly kind: "numeric-fault"; readonly message: string }
  | { readonly kind: "transaction-failed"; readonly message: string }
  | {
      readonly kind: "extension";
      readonly namespace: string;
      readonly code: string;
      readonly fallbackKey: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };

export function blockerFromFailure<N>(failure: CommandFailure<N>): ActionBlocker<N> {
  const { code, ...details } = failure;
  return { kind: code, ...details } as ActionBlocker<N>;
}
