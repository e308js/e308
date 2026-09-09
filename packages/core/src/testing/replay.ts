import type { Game, Snapshot } from "../state/types.js";
import type {
  HarnessReport,
  HarnessScenario,
  HarnessTraceEntry,
  HarnessValue,
  SessionSegment,
} from "./types.js";

export interface ReplayResult<N> {
  readonly snapshot: Snapshot<N>;
  readonly appliedActions: number;
}

export function replayHarness<N, O extends HarnessValue, I extends HarnessValue>(options: {
  readonly scenario: HarnessScenario<N, O, I>;
  readonly report: HarnessReport<I>;
}): ReplayResult<N> {
  const game = options.scenario.create(options.report.gameSeed);
  let elapsed = 0;
  let appliedActions = 0;
  for (const entry of options.report.trace) {
    advanceTimeline(options.scenario, game, options.report.schedule, elapsed, entry.realTimeMs);
    elapsed = entry.realTimeMs;
    if (entry.result !== "success") continue;
    const result = game.dispatch(options.scenario.command(entry.intent, game.getSnapshot()));
    if (!result.ok)
      throw new TypeError(`Replay action ${entry.actionId} failed: ${result.error.code}`);
    appliedActions += 1;
  }
  advanceTimeline(
    options.scenario,
    game,
    options.report.schedule,
    elapsed,
    options.report.timing.realElapsedMs,
  );
  return { snapshot: game.getSnapshot(), appliedActions };
}

function advanceTimeline<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  game: Game<N>,
  schedule: readonly SessionSegment[],
  fromMs: number,
  toMs: number,
): void {
  if (toMs < fromMs) throw new TypeError("Replay trace is not ordered");
  let cursor = 0;
  for (const segment of schedule) {
    const end = cursor + segment.durationMs;
    const start = Math.max(fromMs, cursor);
    const stop = Math.min(toMs, end);
    if (stop > start) advanceSegment(scenario, game, segment.kind, stop - start);
    cursor = end;
    if (cursor >= toMs) return;
  }
  if (toMs > cursor) throw new TypeError("Replay time exceeds the declared schedule");
}

function advanceSegment<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  game: Game<N>,
  kind: SessionSegment["kind"],
  durationMs: number,
): void {
  if (kind === "absent" && scenario.advanceAway) {
    const result = scenario.advanceAway(game, durationMs);
    if (result.snapshot !== game.getSnapshot()) throw new TypeError("Replay away adapter diverged");
    return;
  }
  const result = game.advance(durationMs);
  if (!result.ok) throw new TypeError(`Replay advance failed: ${result.error.code}`);
}

export function successfulTrace<I extends HarnessValue>(
  trace: readonly HarnessTraceEntry<I>[],
): readonly HarnessTraceEntry<I>[] {
  return trace.filter((entry) => entry.result === "success");
}
