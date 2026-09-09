import type { Snapshot } from "../../../packages/core/src/index.js";
import type { PaperclipsStrategy } from "./types.js";

export const paperclipsStrategyProjectIds: Readonly<Partial<Record<PaperclipsStrategy, string>>> = {
  a100: "strategy-a100",
  b100: "strategy-b100",
  greedy: "strategy-greedy",
  generous: "strategy-generous",
  minimax: "strategy-minimax",
  "tit-for-tat": "strategy-tit-for-tat",
  "beat-last": "strategy-beat-last",
};

export function bestPaperclipsStrategy(snapshot: Snapshot<number>): PaperclipsStrategy {
  const unlocked = Object.entries(paperclipsStrategyProjectIds).reverse() as [
    PaperclipsStrategy,
    string,
  ][];
  return unlocked.find(([, id]) => snapshot.progression.upgrades[id])?.[0] ?? "random";
}
