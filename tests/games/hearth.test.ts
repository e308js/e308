import { rankedPolicy, runHarness } from "@e308/core/testing";
import {
  createHearth,
  hearthResearch,
  hearthScenario,
  hearthTasks,
  importHearth,
} from "@e308/game-hearth";
import { describe, expect, it } from "vitest";
import { driveScenario } from "../helpers/finished-games.js";

const limits = {
  maximumDecisions: 3_000,
  maximumTraceEntries: 3_000,
  maximumSamples: 100,
  sampleCadenceMs: 60_000,
} as const;

describe("finished Hearth", () => {
  it("matches the independently derived spring worker ledger", () => {
    const hearth = createHearth();
    expect(hearth.dispatch({ type: "advance", milliseconds: 1_000 }).ok).toBe(true);
    const snapshot = hearth.getSnapshot();
    expect(snapshot.resources.food).toBeCloseTo(21.4, 12);
    expect(snapshot.resources.wood).toBe(11);
    expect(snapshot.resources.science).toBe(0.5);
    expect(snapshot.resources.stone).toBe(0);
    expect(snapshot.productionTotals.food).toBe(3);
  });

  it("survives a year, recovers from shortage, exercises content, and wins legally", () => {
    const game = play("stockpile");
    const snapshot = game.getSnapshot();
    expect(snapshot.progression.won).toBe(true);
    expect(snapshot.progression.achievements).toMatchObject({
      "winter-shortage": true,
      "shortage-recovered": true,
      "year-complete": true,
    });
    expect(Object.keys(snapshot.progression.upgrades)).toHaveLength(hearthResearch.length);
    expect(snapshot.tasks[hearthTasks.expedition.id]?.completed).toHaveLength(1);
    expect(snapshot.tasks[hearthTasks.hall.id]?.completed).toHaveLength(1);
    expect(snapshot.resources.medicine).toBe(1);
    expect(snapshot.resources.preserves).toBe(1);
    expect(snapshot.resources.festival).toBe(1);
  });

  it("reports consequential stockpile and research-first outcomes", () => {
    const stockpile = completion("stockpile", "01");
    const research = completion("research-first", "02");
    expect(stockpile.outcome.kind).toBe("reached");
    expect(research.outcome.kind).toBe("reached");
    if (stockpile.outcome.kind !== "reached" || research.outcome.kind !== "reached") return;
    expect(stockpile.outcome.atGameMs).toBeLessThanOrEqual(36 * 60_000);
    expect(research.outcome.atGameMs).not.toBe(stockpile.outcome.atGameMs);
    expect(stockpile.milestones["winter-shortage"]?.gameTimeMs).toBeGreaterThan(
      research.milestones["winter-shortage"]?.gameTimeMs ?? Number.POSITIVE_INFINITY,
    );
    expect(stockpile.diagnostics.resetRecoveries).toBe(1);
    expect(stockpile.diagnostics.overflow).toBeGreaterThan(0);
  });

  it("round-trips the ending including tasks, calendar, and recovery events", () => {
    const played = play("stockpile").getSnapshot();
    const wrapper = createHearth(played);
    const restored = importHearth(wrapper.exportSave(3_000_000));
    expect(restored.getSnapshot()).toEqual(played);
    expect(restored.getSnapshot().calendars.seasons?.cycle).toBe(1n);
  });

  it("keeps failed research and task commands atomic", () => {
    const hearth = createHearth();
    const before = hearth.getSnapshot();
    expect(hearth.dispatch({ type: "research", id: "missing" })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(hearth.getSnapshot()).toBe(before);
    expect(hearth.dispatch({ type: "task", task: "hall" })).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
  });
});

function completion(strategy: "stockpile" | "research-first", botSeed: string) {
  return runHarness({
    scenario: hearthScenario(strategy),
    policy: rankedPolicy({ id: `hearth-${strategy}`, version: "1" }),
    goalId: "great-hall",
    schedule: [{ kind: "active", durationMs: 36 * 60_000 }],
    decisionCadenceMs: 1_000,
    gameSeed: "aa",
    botSeed,
    limits,
    replayCommand: `pnpm replay:game hearth ${strategy}`,
  });
}

function play(strategy: "stockpile" | "research-first") {
  const scenario = hearthScenario(strategy);
  return driveScenario(scenario, {
    cadenceMs: 1_000,
    maximumDecisions: 3_000,
    stop: (snapshot) => snapshot.progression.won,
  });
}
