import { rankedPolicy, runHarness } from "@e308/core/testing";
import { describe, expect, it } from "vitest";
import {
  businessProjects,
  createPaperclipsReference,
  paperclipsBusinessScenario,
  paperclipsFullScenario,
} from "../../reference/paperclips/full/index.js";

describe("Universal Paperclips full-campaign reference", () => {
  it("models manual production, inventory sales, pricing, and automatic production", () => {
    const game = createPaperclipsReference();
    expect(game.dispatch({ type: "make-clip" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({ clips: 1, "unsold-clips": 1, wire: 999 });
    for (let second = 0; second < 100 && game.getSnapshot().resources.funds === 0; second += 1) {
      expect(game.advance(1_000)).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().resources.funds).toBeCloseTo(0.25);
    for (let index = 0; index < 40; index += 1) game.dispatch({ type: "make-clip" });
    for (
      let second = 0;
      second < 100 && (game.getSnapshot().resources.funds ?? 0) < 5;
      second += 1
    ) {
      game.advance(1_000);
    }
    expect(game.dispatch({ type: "buy", id: "auto-clipper" })).toMatchObject({ ok: true });
    const before = game.getSnapshot().resources.clips ?? 0;
    game.advance(5_000);
    expect(game.getSnapshot().resources.clips).toBeGreaterThan(before);
    expect(game.dispatch({ type: "set-price", price: 0 })).toMatchObject({
      ok: false,
      error: { code: "invalid-count" },
    });
  });

  it("keeps the pinned business project chain represented as executable data", () => {
    expect(businessProjects).toHaveLength(50);
    expect(businessProjects.map((project) => project.id)).toEqual(
      expect.arrayContaining([
        "strategic-modeling",
        "algorithmic-trading",
        "quantum-computing",
        "release-hypnodrones",
      ]),
    );
    expect(
      businessProjects.find((project) => project.id === "release-hypnodrones")?.prerequisites,
    ).toEqual(["hypnodrones"]);
  });

  it("advances deterministic market streams identically across save-sized partitions", () => {
    const left = createPaperclipsReference();
    const right = createPaperclipsReference();
    for (const game of [left, right]) {
      for (let index = 0; index < 80; index += 1) game.dispatch({ type: "make-clip" });
      game.advance(20_000);
      game.dispatch({ type: "buy", id: "auto-clipper" });
    }
    left.advance(60_000);
    for (let index = 0; index < 6; index += 1) right.advance(10_000);
    const leftSnapshot = left.getSnapshot();
    const rightSnapshot = right.getSnapshot();
    expect({ ...leftSnapshot, revision: 0n }).toEqual({ ...rightSnapshot, revision: 0n });
  });

  it("reaches the industrial transition through legal player quotes", () => {
    const report = runHarness({
      scenario: paperclipsBusinessScenario(),
      policy: rankedPolicy({ id: "paperclips-business", version: "1" }),
      goalId: "industry-phase",
      schedule: [{ kind: "active", durationMs: 48 * 60 * 60_000 }],
      decisionCadenceMs: 60_000,
      gameSeed: "01",
      botSeed: "02",
      limits: {
        maximumDecisions: 10_000,
        maximumTraceEntries: 10_000,
        maximumSamples: 200,
        sampleCadenceMs: 15 * 60_000,
      },
      replayCommand: "pnpm vitest run tests/reference/paperclips-full.test.ts",
    });
    expect(report.outcome).toMatchObject({ kind: "reached" });
    expect(report.milestones).toHaveProperty("release-hypnodrones");
    expect(report.actions.attempts).toBe(report.actions.successful);
  }, 30_000);

  it("completes business, industry, probe expansion, drift combat, and an ending", () => {
    const report = runHarness({
      scenario: paperclipsFullScenario(),
      policy: rankedPolicy({ id: "paperclips-full", version: "1" }),
      goalId: "campaign-ending",
      schedule: [{ kind: "active", durationMs: 30 * 24 * 60 * 60_000 }],
      decisionCadenceMs: 60_000,
      gameSeed: "03",
      botSeed: "04",
      limits: {
        maximumDecisions: 50_000,
        maximumTraceEntries: 50_000,
        maximumSamples: 500,
        sampleCadenceMs: 60 * 60_000,
      },
      replayCommand: "pnpm vitest run tests/reference/paperclips-full.test.ts",
    });
    expect(report.outcome).toMatchObject({ kind: "reached" });
    expect(Object.keys(report.milestones)).toEqual(
      expect.arrayContaining([
        "release-hypnodrones",
        "space-exploration",
        "combat",
        "name-the-battles",
        "monument",
        "message-from-emperor",
      ]),
    );
    expect(
      Object.hasOwn(report.milestones, "accept-exile") ||
        Object.hasOwn(report.milestones, "reject-exile"),
    ).toBe(true);
    expect(report.actions.attempts).toBe(report.actions.successful);
  }, 30_000);
});
