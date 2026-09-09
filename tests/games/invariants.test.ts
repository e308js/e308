import { createGame, type EternityQuantity, type Snapshot } from "@e308/core";
import { cascadeDefinition, cascadeSaveCodec, encoded } from "@e308/game-cascade";
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
        (seconds) => {
          const total = seconds.reduce((sum, value) => sum + value, 0) * 1_000;
          const oneShot = createGame(cascadeDefinition);
          oneShot.advance(total);
          const partitioned = createGame(cascadeDefinition);
          for (const value of seconds) partitioned.advance(value * 1_000);
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
});

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
