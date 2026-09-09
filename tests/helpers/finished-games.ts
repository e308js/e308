import type { Game, Snapshot } from "@e308/core";
import { type HarnessScenario, type HarnessValue, rankedLegalQuotes } from "@e308/core/testing";

export function driveScenario<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  options: {
    readonly cadenceMs: number;
    readonly maximumDecisions: number;
    readonly stop: (snapshot: Snapshot<N>) => boolean;
    readonly actionLog?: string[];
  },
): Game<N> {
  const game = scenario.create("aa");
  for (
    let decision = 0;
    decision < options.maximumDecisions && !options.stop(game.getSnapshot());
    decision += 1
  ) {
    const quote = rankedLegalQuotes(scenario.quote(game.getSnapshot()))[0];
    if (quote) {
      options.actionLog?.push(intentLabel(quote.intent, quote.id));
      game.dispatch(scenario.command(quote.intent, game.getSnapshot()));
    }
    game.advance(options.cadenceMs);
  }
  return game;
}

function intentLabel(intent: HarnessValue, quoteId: string): string {
  if (!isHarnessRecord(intent)) return quoteId;
  const type = typeof intent.type === "string" ? intent.type : quoteId;
  const id = typeof intent.id === "string" ? intent.id : quoteId.replace(/^enter-/, "");
  return `${type}:${id}`;
}

function isHarnessRecord(value: HarnessValue): value is { readonly [key: string]: HarnessValue } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
