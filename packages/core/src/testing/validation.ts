import type { HarnessRunOptions, HarnessValue, LegalActionQuote } from "./types.js";

export function validateHarnessOptions<N, O extends HarnessValue, I extends HarnessValue>(
  options: HarnessRunOptions<N, O, I>,
): void {
  const positive = [
    options.decisionCadenceMs,
    options.maximumImmediateActions ?? (options.actionSpace === "complete" ? 64 : 1),
    options.limits.maximumDecisions,
    options.limits.maximumTraceEntries,
    options.limits.maximumSamples,
    options.limits.sampleCadenceMs,
  ];
  if (positive.some((value) => !Number.isSafeInteger(value) || value < 1))
    throw new TypeError("Harness cadence and limits must be positive safe integers");
  if (
    options.schedule.length === 0 ||
    options.schedule.some(
      (segment) => !Number.isSafeInteger(segment.durationMs) || segment.durationMs < 1,
    )
  )
    throw new TypeError("Harness schedule requires positive safe-integer durations");
  if (!/^(?:[0-9a-f]{2})+$/.test(options.botSeed))
    throw new TypeError("Bot seed must be lowercase even-length hex");
  if (options.actionSpace === "complete" && !options.scenario.quoteAll)
    throw new TypeError("Complete action-space runs require scenario.quoteAll");
}

export function validateQuotes<I extends HarnessValue>(
  quotes: readonly LegalActionQuote<I>[],
): void {
  const ids = new Set<string>();
  for (const quote of quotes) {
    if (quote.id.length === 0) throw new TypeError("Harness action quote IDs cannot be empty");
    if (ids.has(quote.id)) throw new TypeError(`Duplicate harness action quote: ${quote.id}`);
    ids.add(quote.id);
  }
}
