import { randomLegalPolicy, rankedPolicy, runHarness } from "@e308/core/testing";
import {
  createWireworks,
  importWireworks,
  wireworksProjects,
  wireworksResources,
  wireworksScenario,
  wireworksTerminalView,
  wireworksView,
} from "@e308/game-wireworks";
import { describe, expect, it } from "vitest";

const limits = {
  maximumDecisions: 5_000,
  maximumTraceEntries: 5_000,
  maximumSamples: 100,
  sampleCadenceMs: 60_000,
} as const;

describe("finished Wireworks", () => {
  it("shows the full feedstock, machine, wire, and clip production chain", () => {
    const wireworks = createWireworks();
    expect(wireworks.dispatch({ type: "supply" })).toMatchObject({ ok: true });
    expect(wireworks.getSnapshot().resources).toMatchObject({ cash: 10, matter: 440 });
    expect(wireworks.dispatch({ type: "advance", milliseconds: 1_000 })).toMatchObject({
      ok: true,
    });
    expect(wireworks.getSnapshot().resources.wire).toBeGreaterThan(10);
    expect(wireworks.getSnapshot().resources.clips).toBeGreaterThan(0);
    expect(JSON.stringify(wireworksView(wireworks.getSnapshot()))).toContain(
      "Production chain: feedstock → wire → clips",
    );
  });

  it("makes a clip and reports both manufacturing limits", () => {
    const wireworks = createWireworks();
    expect(wireworks.dispatch({ type: "make" })).toMatchObject({ ok: true });
    expect(wireworks.getSnapshot().resources).toMatchObject({ wire: 9, clips: 1 });

    wireworks.game.dispatch({
      id: "empty-wire-fixture",
      execute: (transaction) => transaction.set(wireworksResources.wire, 0),
    });
    expect(JSON.stringify(wireworksView(wireworks.getSnapshot()))).toContain("insufficient");
    expect(wireworks.dispatch({ type: "make" })).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });

    wireworks.game.dispatch({
      id: "full-inventory-fixture",
      execute(transaction) {
        transaction.set(wireworksResources.wire, 1);
        transaction.set(wireworksResources.clips, 500);
      },
    });
    expect(JSON.stringify(wireworksView(wireworks.getSnapshot()))).toContain("capacity-blocked");
    expect(wireworks.dispatch({ type: "make" })).toMatchObject({
      ok: false,
      error: { code: "capacity-blocked" },
    });
  });

  it("keeps manufacturing inventory separate from revision-bound sales", () => {
    const wireworks = createWireworks();
    const before = wireworks.getSnapshot();
    expect(wireworks.dispatch({ type: "advance", milliseconds: 10_000 }).ok).toBe(true);
    const produced = wireworks.getSnapshot();
    expect(produced.resources.clips).toBeGreaterThan(0);
    expect(produced.resources.cash).toBe(before.resources.cash);

    const staleRevision = produced.revision;
    expect(wireworks.dispatch({ type: "sell", band: "premium", quantity: 5 }).ok).toBe(true);
    expect(wireworks.getSnapshot().resources.cash).toBe(80);
    expect(wireworks.getSnapshot().revision).toBeGreaterThan(staleRevision);
  });

  it("reaches the authored ending through public legal actions", () => {
    const report = completion("hybrid");
    expect(report.outcome).toMatchObject({ kind: "reached" });
    expect(report.timing.gameAdvancedMs).toBeLessThanOrEqual(12 * 60 * 60_000);
    expect(Object.keys(report.milestones)).toEqual(
      expect.arrayContaining(["powered-extrusion", "autonomous-control", "final-expansion"]),
    );
    expect(report.actions.successful).toBeGreaterThanOrEqual(13);
  });

  it("reports materially different price strategies", () => {
    const hybrid = completion("hybrid");
    const premium = completion("premium");
    const volume = completion("volume");
    expect(hybrid.outcome.kind).toBe("reached");
    expect(premium.outcome.kind).toBe("reached");
    expect(volume.outcome.kind).toBe("reached");
    if (
      hybrid.outcome.kind !== "reached" ||
      premium.outcome.kind !== "reached" ||
      volume.outcome.kind !== "reached"
    )
      return;
    expect(hybrid.outcome.atGameMs).toBeLessThan(premium.outcome.atGameMs);
    expect(hybrid.outcome.atGameMs).toBeLessThan(volume.outcome.atGameMs);
  });

  it("makes random legal play materially slower than a ranked strategy", () => {
    const ranked = completion("hybrid");
    const random = ["01", "02", "03"].map((seed) => randomCompletion(seed));
    expect(ranked.outcome.kind).toBe("reached");
    expect(random.every((report) => report.outcome.kind === "reached")).toBe(true);
    if (ranked.outcome.kind !== "reached") return;
    const randomTimes = random.map((report) =>
      report.outcome.kind === "reached" ? report.outcome.atGameMs : Number.POSITIVE_INFINITY,
    );
    expect(Math.min(...randomTimes)).toBeGreaterThan(ranked.outcome.atGameMs * 2);
  });

  it("round-trips middle saves and exposes two compositions over one snapshot", () => {
    const original = createWireworks();
    for (let index = 0; index < 5; index += 1) {
      original.dispatch({ type: "advance", milliseconds: 20_000 });
      original.dispatch({ type: "sell", band: "premium", quantity: 5 });
      const next = wireworksProjects.find(
        (project) =>
          project.id !== "throughput-drive" &&
          !original.getSnapshot().progression.upgrades[project.id],
      );
      if (next) original.dispatch({ type: "project", id: next.id });
    }
    const restored = importWireworks(original.exportSave(1_000_000));
    expect(restored.getSnapshot()).toEqual(original.getSnapshot());

    const panel = wireworksView(restored.getSnapshot());
    const terminal = wireworksTerminalView(restored.getSnapshot());
    expect(panel.title).toContain("Wireworks");
    expect(terminal.title).toBe("Wireworks terminal");
    expect(JSON.stringify(panel)).toContain("Market");
    expect(JSON.stringify(terminal)).toContain("terminal-stocks");
  });

  it("rejects oversubscribed power without changing allocation", () => {
    const wireworks = createWireworks();
    while (!wireworks.getSnapshot().progression.upgrades["powered-extrusion"]) {
      wireworks.dispatch({ type: "advance", milliseconds: 20_000 });
      wireworks.dispatch({ type: "sell", band: "premium", quantity: 5 });
      const next = wireworksProjects.find(
        (project) =>
          !wireworks.getSnapshot().progression.upgrades[project.id] &&
          project.id !== "throughput-drive",
      );
      if (next) wireworks.dispatch({ type: "project", id: next.id });
    }
    const before = wireworks.getSnapshot();
    const result = wireworks.dispatch({ type: "allocate", target: "extrusion", amount: 99 });
    expect(result).toMatchObject({ ok: false, error: { code: "allocation-exceeded" } });
    expect(wireworks.getSnapshot()).toBe(before);
  });
});

function completion(strategy: "hybrid" | "premium" | "volume") {
  return runHarness({
    scenario: wireworksScenario(strategy),
    policy: rankedPolicy({ id: `wireworks-${strategy}`, version: "1" }),
    goalId: "final-expansion",
    schedule: [{ kind: "active", durationMs: 12 * 60 * 60_000 }],
    decisionCadenceMs: 20_000,
    gameSeed: "aa",
    botSeed: strategy === "hybrid" ? "01" : strategy === "premium" ? "02" : "03",
    limits,
    replayCommand: `pnpm replay:game wireworks ${strategy}`,
  });
}

function randomCompletion(botSeed: string) {
  return runHarness({
    scenario: wireworksScenario("hybrid"),
    policy: randomLegalPolicy({ id: "wireworks-random", version: "1" }),
    goalId: "final-expansion",
    schedule: [{ kind: "active", durationMs: 12 * 60 * 60_000 }],
    decisionCadenceMs: 20_000,
    gameSeed: "aa",
    botSeed,
    limits,
    replayCommand: `pnpm replay:game wireworks random ${botSeed}`,
  });
}
