import type { CommandFailure, Result } from "@e308/core";
import type { TextValue } from "../localization/types.js";
import { blockerFromFailure } from "./failures.js";
import type { ActionView, QuantityLine } from "./models.js";

export interface ActionQuote<Intent, N> {
  readonly id: string;
  readonly revision: bigint;
  readonly intent: Intent;
  readonly label: TextValue<N>;
  readonly costs?: readonly QuantityLine<N>[];
  readonly rewards?: readonly QuantityLine<N>[];
  readonly result: Result<unknown, CommandFailure<N>>;
}

export function actionFromQuote<Intent, N>(quote: ActionQuote<Intent, N>): ActionView<Intent, N> {
  const blockers = quote.result.ok ? [] : [blockerFromFailure(quote.result.error)];
  return {
    id: quote.id,
    label: quote.label,
    enabled: quote.result.ok,
    intent: quote.intent,
    blockers,
    ...(quote.costs ? { costs: quote.costs } : {}),
    ...(quote.rewards ? { rewards: quote.rewards } : {}),
  };
}
