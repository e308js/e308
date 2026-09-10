import type { BotContext, BotPolicy, HarnessValue, LegalActionQuote } from "./types.js";

export function scriptedPolicy<O extends HarnessValue, I extends HarnessValue>(options: {
  readonly id: string;
  readonly version: string;
  readonly actions: readonly string[];
  readonly repeat?: boolean;
}): BotPolicy<O, I> {
  let index = 0;
  return {
    id: options.id,
    version: options.version,
    decide: () => {
      if (options.actions.length === 0) return { kind: "wait", reason: "script-empty" };
      if (index >= options.actions.length && !options.repeat)
        return { kind: "wait", reason: "script-complete" };
      const actionId = options.actions[index % options.actions.length] as string;
      index += 1;
      return { kind: "action", actionId };
    },
  };
}

export function rankedPolicy<O extends HarnessValue, I extends HarnessValue>(options: {
  readonly id?: string;
  readonly version: string;
}): BotPolicy<O, I> {
  return {
    id: options.id ?? "ranked",
    version: options.version,
    decide: (context) => chooseRanked(context.quotes, context.random),
  };
}

export function randomLegalPolicy<O extends HarnessValue, I extends HarnessValue>(options: {
  readonly id?: string;
  readonly version: string;
}): BotPolicy<O, I> {
  return {
    id: options.id ?? "random-legal",
    version: options.version,
    decide: (context) => chooseUniform(context.quotes, context.random),
  };
}

export function rankedLegalQuotes<I extends HarnessValue>(
  quotes: readonly LegalActionQuote<I>[],
): readonly LegalActionQuote<I>[] {
  return quotes
    .filter((quote) => quote.legal && quote.useful)
    .map((quote, index) => ({ quote, index }))
    .sort(
      (left, right) => (right.quote.rank ?? 0) - (left.quote.rank ?? 0) || left.index - right.index,
    )
    .map(({ quote }) => quote);
}

export function orderedPolicy<O extends HarnessValue, I extends HarnessValue>(options: {
  readonly id: string;
  readonly version: string;
  readonly actions: readonly string[];
}): BotPolicy<O, I> {
  let index = 0;
  return {
    id: options.id,
    version: options.version,
    decide: (context) => {
      if (index >= options.actions.length) return { kind: "wait", reason: "route-complete" };
      const actionId = options.actions[index] as string;
      const quote = context.quotes.find((candidate) => candidate.id === actionId);
      if (!quote?.legal || !quote.useful) return { kind: "wait", reason: `route-wait:${actionId}` };
      index += 1;
      return { kind: "action", actionId };
    },
  };
}

export function goalPolicy<O extends HarnessValue, I extends HarnessValue>(options: {
  readonly id: string;
  readonly version: string;
  readonly includeAllLegal?: boolean;
  readonly score: (context: BotContext<O, I>, quote: LegalActionQuote<I>) => number;
}): BotPolicy<O, I> {
  return {
    id: options.id,
    version: options.version,
    decide: (context) => {
      const scored = context.quotes
        .filter((quote) => quote.legal && (quote.useful || options.includeAllLegal))
        .map((quote) => ({ quote, score: options.score(context, quote) }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort(
          (left, right) => right.score - left.score || left.quote.id.localeCompare(right.quote.id),
        );
      return scored[0]
        ? { kind: "action", actionId: scored[0].quote.id }
        : { kind: "wait", reason: "no-goal-action" };
    },
  };
}

function chooseRanked<I extends HarnessValue>(
  quotes: readonly LegalActionQuote<I>[],
  random: () => number,
) {
  const legal = rankedLegalQuotes(quotes);
  if (legal.length === 0) return { kind: "wait" as const, reason: "no-ranked-action" };
  const highest = legal[0]?.rank ?? 0;
  const tied = legal.filter((quote) => (quote.rank ?? 0) === highest);
  const index = Math.min(tied.length - 1, Math.floor(random() * tied.length));
  return { kind: "action" as const, actionId: (tied[index] as LegalActionQuote<I>).id };
}

function chooseUniform<I extends HarnessValue>(
  quotes: readonly LegalActionQuote<I>[],
  random: () => number,
) {
  const legal = quotes.filter((quote) => quote.legal && quote.useful);
  if (legal.length === 0) return { kind: "wait" as const, reason: "no-random-action" };
  const index = Math.min(legal.length - 1, Math.floor(random() * legal.length));
  return { kind: "action" as const, actionId: (legal[index] as LegalActionQuote<I>).id };
}
