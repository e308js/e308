import { createGame, type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import { advanceOptimized } from "@e308/core/optimize";
import {
  cascadeBulkCapability,
  cascadeBuyables,
  cascadeDefinition,
  cascadeKit,
  cascadeResources,
  cascadeSaveCodec,
  cascadeStepMs,
  cascadeTiers,
  encoded,
  progressionCommand,
} from "@e308/game-cascade";
import { createHearth } from "@e308/game-hearth";
import { createWireworks } from "@e308/game-wireworks";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("finished-game invariants", () => {
  it("keeps rejected Wireworks market transactions atomic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 101, max: 100_000 }), (quantity) => {
        const game = createWireworks();
        game.dispatch({ type: "advance", milliseconds: 10_000 });
        const before = game.getSnapshot();
        const result = game.dispatch({ type: "sell", band: "volume", quantity });
        expect(result.ok).toBe(false);
        expect(game.getSnapshot()).toBe(before);
      }),
    );
  });

  it("keeps rejected Hearth worker assignments atomic", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "farmer" as const,
          "woodcutter" as const,
          "miner" as const,
          "scholar" as const,
        ),
        fc.integer({ min: 6, max: 1_000 }),
        (job, amount) => {
          const game = createHearth();
          const before = game.getSnapshot();
          const result = game.dispatch({ type: "allocate", job, amount });
          expect(result.ok).toBe(false);
          expect(game.getSnapshot()).toBe(before);
        },
      ),
    );
  });

  it("preserves Cascade's delayed chain across time partitions and save boundaries", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 20 }),
        (stepGroups) => {
          const total = stepGroups.reduce((sum, value) => sum + value, 0) * cascadeStepMs;
          const oneShot = createGame(cascadeDefinition);
          oneShot.advance(total);
          const partitioned = createGame(cascadeDefinition);
          for (const value of stepGroups) partitioned.advance(value * cascadeStepMs);
          const raw = cascadeSaveCodec.encode(partitioned.getSnapshot(), {
            wallAnchorMs: total,
            entitlement: {
              policyVersion: "property",
              enabled: true,
              capMs: null,
              excess: "discard",
            },
            catchup: null,
          });
          const restored = cascadeSaveCodec.decode(raw).snapshot;
          expect(economicState(restored)).toEqual(economicState(oneShot.getSnapshot()));
        },
      ),
    );
  });

  it("preserves Cascade automation boundaries during exact bulk advancement", () => {
    const canonical = automatedCascade();
    const optimized = automatedCascade();
    canonical.advance(60_000);
    const report = advanceOptimized(optimized, cascadeDefinition, 60_000, {
      limits: { maximumWork: 1_000, maximumBulkBatches: 1_000 },
      capabilities: [cascadeBulkCapability],
    });
    expect(report.status).toBe("completed");
    expect(report.bulkSteps).toBeGreaterThan(0);
    expect(report.canonicalSteps).toBe(12);
    expect(economicState(report.snapshot)).toEqual(economicState(canonical.getSnapshot()));
  });

  it("bulk-advances every Cascade challenge production rule within numeric tolerance", () => {
    for (const challenges of [
      ["composite-trial"],
      ["slow-foundation", "automation-drought", "reversed-emphasis"],
      ["reset-pressure"],
    ]) {
      const canonical = challengedCascade(challenges);
      const optimized = challengedCascade(challenges);
      canonical.advance(5_000);
      const report = advanceOptimized(optimized, cascadeDefinition, 5_000, {
        limits: { maximumWork: 100, maximumBulkBatches: 100 },
        capabilities: [cascadeBulkCapability],
      });
      expect(report.fidelity).toBe("validated-bulk");
      expectEconomicStateClose(report.snapshot, canonical.getSnapshot());
    }
  });

  it("declines Cascade bulk advancement while a purchase milestone is pending", () => {
    const snapshot = createGame(cascadeDefinition).getSnapshot();
    const plan = cascadeBulkCapability.plan({
      definition: cascadeDefinition,
      snapshot: {
        ...snapshot,
        purchaseCounts: {
          ...snapshot.purchaseCounts,
          "dimension-1": cascadeKit.q(10),
        },
      },
      requestedSteps: 10,
    });
    expect(plan).toEqual({ eligible: false, reason: "pending-progression-trigger" });
  });
});

function automatedCascade() {
  const game = createGame(cascadeDefinition);
  const tierOne = cascadeTiers[0];
  const buyable = cascadeBuyables[0];
  if (!tierOne || !buyable) throw new TypeError("Cascade requires tier one");
  game.dispatch({
    id: "seed-automation",
    execute(transaction) {
      transaction.set(cascadeResources.currency, cascadeKit.q("1e20"));
      transaction.set(cascadeResources.infinity, cascadeKit.q(1));
      transaction.set(tierOne, cascadeKit.q(10));
      transaction.setPurchase(buyable.id, cascadeKit.q(10));
    },
  });
  game.dispatch(progressionCommand({ type: "automation", id: "dimension", enabled: true }));
  return game;
}

function challengedCascade(challenges: readonly string[]) {
  const game = createGame(cascadeDefinition);
  const tierTwo = cascadeTiers[1];
  if (!tierTwo) throw new TypeError("Cascade requires tier two");
  game.dispatch({
    id: "seed-challenge",
    execute(transaction) {
      transaction.set(tierTwo, cascadeKit.q(2));
      for (const id of challenges) transaction.setChallengeActive(id, true);
    },
  });
  return game;
}

function economicState(snapshot: Snapshot<EternityQuantity>) {
  const quantities = (values: Readonly<Record<string, EternityQuantity>>) =>
    Object.fromEntries(Object.entries(values).map(([id, value]) => [id, encoded(value)]));
  return {
    gameTimeMs: snapshot.gameTimeMs,
    remainderMs: snapshot.remainderMs,
    resources: quantities(snapshot.resources),
    productionTotals: quantities(snapshot.productionTotals),
    purchaseCounts: quantities(snapshot.purchaseCounts),
    progression: snapshot.progression,
    random: snapshot.random,
  };
}

function expectEconomicStateClose(
  actual: Snapshot<EternityQuantity>,
  expected: Snapshot<EternityQuantity>,
): void {
  const left = economicState(actual);
  const right = economicState(expected);
  expect({ ...left, resources: {}, productionTotals: {} }).toEqual({
    ...right,
    resources: {},
    productionTotals: {},
  });
  expectQuantitiesClose(actual.resources, expected.resources);
  expectQuantitiesClose(actual.productionTotals, expected.productionTotals);
}

function expectQuantitiesClose(
  actual: Readonly<Record<string, EternityQuantity>>,
  expected: Readonly<Record<string, EternityQuantity>>,
): void {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const [id, value] of Object.entries(actual)) {
    const target = expected[id];
    if (!target) throw new TypeError(`Missing expected quantity ${id}`);
    if (eternityNumbers.cmp(value, target) === 0) continue;
    const difference = eternityNumbers.sub(
      eternityNumbers.cmp(value, target) > 0 ? value : target,
      eternityNumbers.cmp(value, target) > 0 ? target : value,
    );
    const scale = eternityNumbers.cmp(value, target) > 0 ? value : target;
    expect(
      eternityNumbers.cmp(difference, eternityNumbers.mul(scale, cascadeKit.q(1e-12))),
    ).toBeLessThanOrEqual(0);
  }
}
