import type { CommandFailure, Result } from "./types.js";

export function mutationDuringEventDelivery<N>(): Result<never, CommandFailure<N>> {
  return {
    ok: false,
    error: { code: "transaction-failed", message: "Cannot mutate during domain event delivery" },
  };
}
