import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  advanceAutomaticTick,
  advanceRetailTick,
  autoClipperCurve,
  createPaperclipsReference,
  megaClipperCurve,
  paperclipsBuyables,
  paperclipsResources,
} from "../../reference/paperclips/full/index.js";

interface GoldenTrace {
  readonly sources: Readonly<Record<string, string>>;
  readonly scenarios: {
    readonly initial: Readonly<Record<string, number>>;
    readonly retail: {
      readonly afterManual: Readonly<Record<string, number>>;
      readonly afterPrice: Readonly<Record<string, number>>;
    };
    readonly timedRetail: {
      readonly draws: readonly (readonly [number, number])[];
      readonly checkpoints: readonly Readonly<Record<string, number>>[];
    };
    readonly machineCosts: {
      readonly autoClippers: readonly Readonly<Record<string, number>>[];
      readonly megaClippers: readonly Readonly<Record<string, number>>[];
      readonly marketing: readonly Readonly<Record<string, number>>[];
    };
    readonly autoClipperProjects: readonly Readonly<Record<string, number>>[];
    readonly wireProjects: readonly Readonly<Record<string, number>>[];
    readonly trustProjects: readonly Readonly<Record<string, number | string>>[];
    readonly trustThresholds: readonly Readonly<Record<string, number>>[];
    readonly hypnoTransition: {
      readonly marketing: readonly Readonly<Record<string, number | string>>[];
      readonly released: Readonly<Record<string, number>>;
    };
    readonly strategyProjects: {
      readonly checkpoints: readonly Readonly<Record<string, number | string>>[];
      readonly theoryOfMind: Readonly<Record<string, number>>;
      readonly autoTourney: Readonly<Record<string, number>>;
    };
    readonly photonicChips: {
      readonly purchases: readonly Readonly<Record<string, number>>[];
      readonly computed: Readonly<Record<string, number | readonly number[]>>;
      readonly overflow: Readonly<Record<string, number>>;
    };
    readonly industrySystems: {
      readonly droneCosts: readonly Readonly<Record<string, number>>[];
      readonly unlocks: readonly Readonly<Record<string, number | string>>[];
      readonly initial: DroneRateCheckpoint;
      readonly collision: DroneRateCheckpoint;
      readonly alignment: DroneRateCheckpoint;
      readonly cohesion: DroneRateCheckpoint & { readonly yomi: number };
    };
  };
}

interface DroneRateCheckpoint {
  readonly standardOps?: number;
  readonly harvesterRate: number;
  readonly wireDroneRate: number;
  readonly droneBoost: number;
}

const goldenSource = readFileSync(
  new URL("../../reference/paperclips/golden-trace.json", import.meta.url),
  "utf8",
);
const golden = JSON.parse(goldenSource) as GoldenTrace;
const manifest = JSON.parse(
  readFileSync(new URL("../../reference/paperclips/manifest.json", import.meta.url), "utf8"),
) as {
  readonly sourceSha256: Readonly<Record<string, string>>;
  readonly goldenTrace: { readonly sha256: string; readonly scenarios: readonly string[] };
};

describe("Universal Paperclips pinned-source golden trace", () => {
  it("is generated from the four pinned scripts and protected by the manifest", () => {
    expect(golden.sources).toEqual({
      "combat.js": manifest.sourceSha256["combat.js?v3"],
      "globals.js": manifest.sourceSha256["globals.js?v3"],
      "main.js": manifest.sourceSha256["main.js?v3"],
      "projects.js": manifest.sourceSha256["projects.js?v3"],
    });
    expect(Object.keys(golden.scenarios)).toEqual(manifest.goldenTrace.scenarios);
    expect(createHash("sha256").update(goldenSource).digest("hex")).toBe(
      manifest.goldenTrace.sha256,
    );
  });

  it("matches canonical initial retail and compute state", () => {
    const snapshot = createPaperclipsReference().getSnapshot();
    expect(snapshot.resources).toMatchObject({
      clips: golden.scenarios.initial.clips,
      "unsold-clips": golden.scenarios.initial.unsoldClips,
      funds: golden.scenarios.initial.funds,
      "clip-price": golden.scenarios.initial.margin,
      wire: golden.scenarios.initial.wire,
      "wire-cost": golden.scenarios.initial.wireCost,
      "wire-supply": golden.scenarios.initial.wireSupply,
      "marketing-level": golden.scenarios.initial.marketingLvl,
      operations: golden.scenarios.initial.operations,
      trust: golden.scenarios.initial.trust,
    });
    expect(snapshot.allocations.compute).toEqual({
      processors: golden.scenarios.initial.processors,
      memory: golden.scenarios.initial.memory,
    });
  });

  it("matches manual production and the source price-control checkpoint", () => {
    const game = createPaperclipsReference();
    for (let index = 0; index < 10; index += 1) {
      expect(game.dispatch({ type: "make-clip" })).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().resources).toMatchObject({
      clips: golden.scenarios.retail.afterManual.clips,
      "unsold-clips": golden.scenarios.retail.afterManual.unsoldClips,
      wire: golden.scenarios.retail.afterManual.wire,
    });
    const sourcePrice = golden.scenarios.retail.afterPrice.margin as number;
    expect(game.dispatch({ type: "set-price", price: sourcePrice })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources[paperclipsResources.price.id]).toBe(sourcePrice);
  });

  it("matches the source's discontinuous machine purchase curves", () => {
    const auto = golden.scenarios.machineCosts.autoClippers;
    const mega = golden.scenarios.machineCosts.megaClippers;
    expect(autoClipperCurve.unitCost(0)).toBe(golden.scenarios.initial.clipperCost);
    expect(megaClipperCurve.unitCost(0)).toBe(golden.scenarios.initial.megaClipperCost);
    for (let count = 1; count <= 3; count += 1) {
      expect(autoClipperCurve.unitCost(count)).toBeCloseTo(auto[count - 1]?.clipperCost as number);
      expect(megaClipperCurve.unitCost(count)).toBeCloseTo(
        mega[count - 1]?.megaClipperCost as number,
      );
    }
    expect(autoClipperCurve.totalCost(0, 3)).toBeCloseTo(20_000 - (auto[2]?.funds as number));
    expect(megaClipperCurve.totalCost(0, 3)).toBeCloseTo(20_000 - (mega[2]?.funds as number));
    expect(autoClipperCurve.maxAffordable(17.31, 0)).toBe(3);
    expect(megaClipperCurve.maxAffordable(2_714.9, 0)).toBe(3);
    expect(autoClipperCurve.maxAffordable(1_000, 0, 2)).toBe(2);
    expect(() => autoClipperCurve.maxAffordable(-1, 0)).toThrow("balance");
    expect(() => autoClipperCurve.unitCost(-1)).toThrow("count");
  });

  it("charges the source prices through ordinary e308 purchase commands", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.funds, 20_000);
      transaction.setProgress("upgrade", "mega-clippers");
    });
    for (let count = 1; count <= 3; count += 1) {
      expect(game.dispatch({ type: "buy", id: "auto-clipper" })).toMatchObject({ ok: true });
      expect(game.getSnapshot().purchaseCounts[paperclipsBuyables.autoClipper.id]).toBe(count);
    }
    expect(game.getSnapshot().resources.funds).toBeCloseTo(
      golden.scenarios.machineCosts.autoClippers[2]?.funds as number,
    );
  });

  it("matches additive AutoClipper boosts and source wire-supply mutations", () => {
    const boostGame = createPaperclipsReference();
    seed(boostGame, (transaction) => {
      transaction.set(paperclipsResources.wire, 100);
      transaction.setPurchase(paperclipsBuyables.autoClipper.id, 1);
      transaction.set(paperclipsResources.operations, 20_000);
    });
    for (const id of [
      "improved-auto-clippers",
      "even-better-auto-clippers",
      "optimized-auto-clippers",
    ]) {
      expect(boostGame.dispatch({ type: "project", id })).toMatchObject({ ok: true });
    }
    boostGame.advance(1_000);
    expect(boostGame.getSnapshot().resources.clips).toBeCloseTo(
      golden.scenarios.autoClipperProjects[2]?.clipperBoost as number,
    );

    const wireGame = createPaperclipsReference();
    seed(wireGame, (transaction) => transaction.set(paperclipsResources.operations, 50_000));
    for (const [index, id] of [
      "improved-wire-extrusion",
      "optimized-wire-extrusion",
      "microlattice-shapecasting",
      "spectral-froth-annealment",
      "quantum-foam-annealment",
    ].entries()) {
      if (id === "quantum-foam-annealment") {
        seed(wireGame, (transaction) => transaction.set(paperclipsResources.wireCost, 125));
      }
      expect(wireGame.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      expect(wireGame.getSnapshot().resources[paperclipsResources.wireSupply.id]).toBe(
        golden.scenarios.wireProjects[index]?.wireSupply,
      );
    }
  });

  it("matches the source's 100 ms sale and wire-price schedule", () => {
    let state = {
      clips: 20,
      demand: 3.2,
      funds: 0,
      margin: 0.25,
      unsoldClips: 20,
      wire: 100,
      wireBasePrice: 20,
      wireCost: 20,
      wirePriceCounter: 0,
      wirePriceTimer: 248,
    };
    for (const [index, [wire, sale]] of golden.scenarios.timedRetail.draws.entries()) {
      for (let tick = 0; tick < 10; tick += 1) {
        state = {
          ...state,
          ...advanceAutomaticTick(state, {
            autoPerTick: 0.1,
            megaPerTick: 0,
            wireBuyer: false,
            wireCost: state.wireCost,
            wireSupply: 1_000,
          }),
        };
      }
      state = { ...state, ...advanceRetailTick(state, { wire, sale }) };
      const expected = golden.scenarios.timedRetail.checkpoints[index];
      expect(state.clips).toBe(expected?.clips);
      expect(state.unsoldClips).toBeCloseTo(expected?.unsoldClips as number);
      expect(state.wire).toBe(expected?.wire);
      expect(state.funds).toBe(expected?.funds);
      expect(state.wireBasePrice).toBe(expected?.wireBasePrice);
      expect(state.wireCost).toBe(expected?.wireCost);
      expect(state.wirePriceCounter).toBe(expected?.wirePriceCounter);
      expect(state.wirePriceTimer).toBe(expected?.wirePriceTimer);
    }
  });

  it("uses the source scheduler and wire-purchase mutations through the game API", () => {
    const game = createPaperclipsReference();
    expect(game.advance(1_000)).toMatchObject({ ok: true });
    expect(game.getSnapshot()).toMatchObject({
      gameTimeMs: 1_000,
      resources: { demand: 3.2, "wire-price-timer": 10 },
    });
    const purchaseGame = createPaperclipsReference();
    seed(purchaseGame, (transaction) => transaction.set(paperclipsResources.funds, 20));
    expect(purchaseGame.dispatch({ type: "buy-wire" })).toMatchObject({ ok: true });
    expect(purchaseGame.getSnapshot().resources).toMatchObject({
      funds: 0,
      wire: 2_000,
      "wire-base-price": 20.05,
      "wire-price-timer": 0,
    });
  });

  it("matches the source Trust grants and social-project costs", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.operations, 250_000);
      transaction.set(paperclipsResources.creativity, 5_000);
      transaction.set(paperclipsResources.yomi, 50_000);
      transaction.set(paperclipsResources.trust, 8);
      transaction.setProgress("upgrade", "creativity");
    });
    const ids = [
      "limerick",
      "lexical-processing",
      "combinatory-harmonics",
      "hadwiger-problem",
      "toth-sausage",
      "donkey-space",
      "coherent-extrapolated-volition",
      "cure-for-cancer",
      "world-peace",
      "global-warming",
      "male-pattern-baldness",
    ];
    for (const [index, id] of ids.entries()) {
      expect(game.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      const expected = golden.scenarios.trustProjects[index];
      expect(game.getSnapshot().resources).toMatchObject({
        trust: expected?.trust,
        operations: expected?.standardOps,
        creativity: expected?.creativity,
        yomi: expected?.yomi,
        "stock-gain-threshold": expected?.stockGainThreshold,
      });
    }
  });

  it("matches source marketing multipliers and the HypnoDrone transition", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.operations, 100_000);
      transaction.set(paperclipsResources.creativity, 500);
      transaction.set(paperclipsResources.trust, 100);
      transaction.set(paperclipsResources.wire, 4_321);
      transaction.setPurchase(paperclipsBuyables.autoClipper.id, 75);
      transaction.setPurchase(paperclipsBuyables.megaClipper.id, 4);
    });
    const ids = [
      "lexical-processing",
      "new-slogan",
      "combinatory-harmonics",
      "catchy-jingle",
      "hypno-harmonics",
    ];
    for (const [index, id] of ids.entries()) {
      expect(game.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      const expected = golden.scenarios.hypnoTransition.marketing[index];
      expect(game.getSnapshot().resources).toMatchObject({
        trust: expected?.trust,
        operations: expected?.standardOps,
        creativity: expected?.creativity,
        "marketing-effectiveness": expected?.marketingEffectiveness,
      });
    }
    expect(game.dispatch({ type: "project", id: "hypnodrones" })).toMatchObject({ ok: true });
    expect(game.dispatch({ type: "project", id: "release-hypnodrones" })).toMatchObject({
      ok: true,
    });
    const snapshot = game.getSnapshot();
    expect(snapshot.resources).toMatchObject({
      trust: golden.scenarios.hypnoTransition.released.trust,
      wire: golden.scenarios.hypnoTransition.released.wire,
      "nano-wire": golden.scenarios.hypnoTransition.released.nanoWire,
    });
    expect(snapshot.purchaseCounts).toMatchObject({ "auto-clipper": 0, "mega-clipper": 0 });
    expect(snapshot.resources.clips).toBe(0);
    expect(snapshot.progression.milestones).toHaveProperty("industry-phase");
  });

  it("preserves project Trust while advancing source Fibonacci thresholds", () => {
    const game = createPaperclipsReference();
    const checkpoints = golden.scenarios.trustThresholds;
    for (const [index, clips] of [3_000, 5_000, 8_000, 13_000].entries()) {
      seed(game, (transaction) => transaction.set(paperclipsResources.clips, clips));
      game.advance(1_000);
      expectTrustCheckpoint(game, checkpoints[index]);
    }
    seed(game, (transaction) => transaction.set(paperclipsResources.creativity, 50));
    expect(game.dispatch({ type: "project", id: "lexical-processing" })).toMatchObject({
      ok: true,
    });
    expectTrustCheckpoint(game, checkpoints[4]);
    seed(game, (transaction) => transaction.set(paperclipsResources.clips, 21_000));
    game.advance(1_000);
    expectTrustCheckpoint(game, checkpoints[5]);
  });

  it("matches the seven strategy unlock costs and tournament multipliers", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.setProgress("upgrade", "strategic-modeling");
      transaction.set(paperclipsResources.operations, 300_000);
      transaction.set(paperclipsResources.creativity, 75_000);
      transaction.set(paperclipsResources.trust, 90);
    });
    const ids = [
      "strategy-a100",
      "strategy-b100",
      "strategy-greedy",
      "strategy-generous",
      "strategy-minimax",
      "strategy-tit-for-tat",
      "strategy-beat-last",
    ];
    for (const [index, id] of ids.entries()) {
      expect(game.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      const expected = golden.scenarios.strategyProjects.checkpoints[index];
      expect(game.getSnapshot().resources).toMatchObject({
        operations: expected?.standardOps,
        "tournament-cost": expected?.tourneyCost,
        "strategy-count": expected?.strategies,
      });
    }
    expect(game.dispatch({ type: "project", id: "theory-of-mind" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({
      creativity: golden.scenarios.strategyProjects.theoryOfMind.creativity,
      "tournament-cost": golden.scenarios.strategyProjects.theoryOfMind.tourneyCost,
      "yomi-boost": golden.scenarios.strategyProjects.theoryOfMind.yomiBoost,
    });
    expect(game.dispatch({ type: "project", id: "auto-tourney" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.creativity).toBe(
      golden.scenarios.strategyProjects.autoTourney.creativity,
    );
  });

  it("matches all Photonic Chip prices and quantum-operation buffering", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.operations, 510_000);
      transaction.set(paperclipsResources.trust, 6);
      transaction.set(paperclipsResources.computeCapacity, 6);
      transaction.setAllocation("compute", "processors", 5);
      transaction.setAllocation("compute", "memory", 1);
    });
    expect(game.dispatch({ type: "project", id: "quantum-computing" })).toMatchObject({ ok: true });
    for (let index = 0; index < 10; index += 1) {
      expect(game.dispatch({ type: "project", id: "photonic-chip" })).toMatchObject({ ok: true });
      const expected = golden.scenarios.photonicChips.purchases[index];
      expect(game.getSnapshot().resources).toMatchObject({
        operations: expected?.standardOps,
        "photonic-chip-cost": expected?.qChipCost,
        "photonic-chips": expected?.active,
      });
    }
    expect(game.dispatch({ type: "project", id: "photonic-chip" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.operations, 0);
      transaction.set(paperclipsResources.temporaryOperations, 0);
      transaction.set(paperclipsResources.trust, 10);
      transaction.set(paperclipsResources.computeCapacity, 10);
      transaction.setAllocation("compute", "processors", 0);
      transaction.setAllocation("compute", "memory", 10);
    });
    game.advance(1_000);
    expect(game.dispatch({ type: "quantum-compute" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.operations).toBe(
      golden.scenarios.photonicChips.computed.standardOps,
    );
    expect(game.getSnapshot().resources[paperclipsResources.quantumClock.id]).toBeCloseTo(
      golden.scenarios.photonicChips.computed.qClock as number,
    );
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.operations, 9_900);
      transaction.set(paperclipsResources.temporaryOperations, 0);
    });
    expect(game.dispatch({ type: "quantum-compute" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({
      operations: golden.scenarios.photonicChips.overflow.standardOps,
      "temporary-operations": golden.scenarios.photonicChips.overflow.tempOps,
    });
  });
});

function expectTrustCheckpoint(
  game: ReturnType<typeof createPaperclipsReference>,
  expected: Readonly<Record<string, number>> | undefined,
): void {
  expect(game.getSnapshot().resources).toMatchObject({
    clips: expected?.clips,
    trust: expected?.trust,
    "next-trust": expected?.nextTrust,
    "trust-fibonacci-previous": expected?.fib1,
    "trust-fibonacci-current": expected?.fib2,
  });
}

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "golden-seed", execute: apply });
}
