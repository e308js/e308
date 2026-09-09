import { readFileSync } from "node:fs";
import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  createPaperclipsReference,
  droneCurve,
  paperclipsBuyables,
  paperclipsResources,
} from "../../reference/paperclips/full/index.js";

interface IndustryGolden {
  readonly droneCosts: readonly Readonly<Record<string, number>>[];
  readonly unlocks: readonly Readonly<Record<string, number | string>>[];
  readonly initial: DroneCheckpoint;
  readonly collision: DroneCheckpoint;
  readonly alignment: DroneCheckpoint;
  readonly cohesion: DroneCheckpoint & { readonly yomi: number };
}

interface DroneCheckpoint {
  readonly harvesterRate: number;
  readonly droneBoost: number;
}

const golden = JSON.parse(
  readFileSync(new URL("../../reference/paperclips/golden-trace.json", import.meta.url), "utf8"),
) as { readonly scenarios: { readonly industrySystems: IndustryGolden } };

describe("Universal Paperclips terrestrial source trace", () => {
  it("matches the source drone purchase curve", () => {
    const checkpoints = golden.scenarios.industrySystems.droneCosts;
    let spent = 0;
    for (let count = 0; count < checkpoints.length; count += 1) {
      const expected = checkpoints[count];
      expect(droneCurve.unitCost(count)).toBeCloseTo(
        count === 0 ? 1_000_000 : (checkpoints[count - 1]?.harvesterCost as number),
      );
      spent += droneCurve.unitCost(count);
      expect(1_000_000_000_000 - spent).toBeCloseTo(expected?.unusedClips as number);
    }
    expect(droneCurve.totalCost(0, 3)).toBeCloseTo(spent);
    expect(droneCurve.maxAffordable(spent, 0)).toBe(3);
  });

  it("matches terrestrial unlocks and every source drone-flocking multiplier", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "industry-phase");
      transaction.setProgress("upgrade", "toth-sausage");
      transaction.set(paperclipsResources.operations, 1_000_000);
    });
    for (const [index, id] of [
      "toth-tubule-enfolding",
      "power-grid",
      "nanoscale-wire-production",
    ].entries()) {
      expect(game.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      expect(game.getSnapshot().resources.operations).toBe(
        golden.scenarios.industrySystems.unlocks[index]?.standardOps,
      );
    }
    seed(game, (transaction) => {
      transaction.setPurchase(paperclipsBuyables.harvester.id, 249);
      transaction.setPurchase(paperclipsBuyables.wireDrone.id, 250);
    });
    expect(game.dispatch({ type: "project", id: "drone-flocking" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    buyDrones(game, 250);
    expect(game.dispatch({ type: "project", id: "drone-flocking" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources[paperclipsResources.droneRateMultiplier.id]).toBe(
      rateRatio("collision"),
    );
    buyDrones(game, 2_500);
    expect(game.dispatch({ type: "project", id: "drone-flocking-alignment" })).toMatchObject({
      ok: true,
    });
    expect(game.getSnapshot().resources[paperclipsResources.droneRateMultiplier.id]).toBe(
      rateRatio("alignment"),
    );
    buyDrones(game, 25_000);
    seed(game, (transaction) => transaction.set(paperclipsResources.yomi, 50_000));
    expect(game.dispatch({ type: "project", id: "drone-flocking-cohesion" })).toMatchObject({
      ok: true,
    });
    expect(game.getSnapshot().resources).toMatchObject({
      "drone-boost": golden.scenarios.industrySystems.cohesion.droneBoost,
      yomi: golden.scenarios.industrySystems.cohesion.yomi,
    });
  });
});

function rateRatio(checkpoint: "collision" | "alignment"): number {
  return (
    golden.scenarios.industrySystems[checkpoint].harvesterRate /
    golden.scenarios.industrySystems.initial.harvesterRate
  );
}

function buyDrones(game: ReturnType<typeof createPaperclipsReference>, count: number): void {
  seed(game, (transaction) => {
    transaction.setPurchase(paperclipsBuyables.harvester.id, count);
    transaction.setPurchase(paperclipsBuyables.wireDrone.id, count);
  });
}

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "industry-golden-seed", execute: apply });
}
