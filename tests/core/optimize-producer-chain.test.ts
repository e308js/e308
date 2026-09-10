import { advanceProducerChain, createGame, createGameKit, nativeNumbers } from "@e308/core";
import { advanceOptimized, producerChainBulkCapability } from "@e308/core/optimize";
import { describe, expect, it } from "vitest";
import { generousLimits } from "../helpers/optimizer-fixture.js";

describe("producer-chain bulk advancement", () => {
  it("matches canonical delayed propagation and disabled automation clocks", () => {
    const fixture = chainFixture(false);
    const canonical = fixture.seed(createGame(fixture.definition));
    const optimized = fixture.seed(createGame(fixture.definition));
    canonical.advance(20_000);
    const report = advanceOptimized(optimized, fixture.definition, 20_000, {
      limits: generousLimits,
      capabilities: [fixture.capability],
    });
    expect(report.status).toBe("completed");
    expect(report.bulkSteps).toBe(20);
    expect(comparable(report.snapshot)).toEqual(comparable(canonical.getSnapshot()));
    expect(report.snapshot.progression.automation.pulse?.nextRunMs).toBe(25_000);
  });

  it("returns to canonical steps at enabled automation boundaries", () => {
    const fixture = chainFixture(true);
    const canonical = fixture.seed(createGame(fixture.definition));
    const optimized = fixture.seed(createGame(fixture.definition));
    canonical.advance(12_500);
    const report = advanceOptimized(optimized, fixture.definition, 12_500, {
      limits: generousLimits,
      capabilities: [fixture.capability],
    });
    expect(report.segments.map(({ kind, steps }) => [kind, steps])).toEqual([
      ["bulk", 4],
      ["canonical", 1],
      ["bulk", 4],
      ["canonical", 1],
      ["bulk", 2],
    ]);
    expect(comparable(report.snapshot)).toEqual(comparable(canonical.getSnapshot()));
  });

  it("validates its declaration and falls back with explicit diagnostics", () => {
    const fixture = chainFixture(false);
    expect(() =>
      producerChainBulkCapability({
        ...fixture.options,
        id: "",
      }),
    ).toThrow("identity");
    expect(() =>
      producerChainBulkCapability({
        ...fixture.options,
        tiers: [],
      }),
    ).toThrow("requires a tier");
    expect(() =>
      producerChainBulkCapability({
        ...fixture.options,
        tiers: [fixture.output],
      }),
    ).toThrow("must be unique");

    const report = advanceOptimized(createGame(fixture.definition), fixture.definition, 1_000, {
      limits: generousLimits,
      capabilities: [
        producerChainBulkCapability({
          ...fixture.options,
          coefficient: () => -1,
        }),
      ],
    });
    expect(report.fidelity).toBe("canonical");
    expect(report.diagnostics).toContain("fixture/chain:invalid-producer-chain-coefficient");
  });

  it("reports authored, ownership, and capacity preconditions", () => {
    const fixture = chainFixture(false);
    const other = createGameKit({ numbers: nativeNumbers });
    const otherScope = other.scope("other");
    const unknown = other.resource("unknown", { scope: otherScope, initial: 0 });
    const limited = chainFixture(false, 10);
    for (const [capability, reason] of [
      [producerChainBulkCapability({ ...fixture.options, tiers: [unknown] }), "unknown-resource"],
      [limited.capability, "resource-capacity"],
      [
        producerChainBulkCapability({
          ...fixture.options,
          ineligibleReason: () => "changing-rule",
        }),
        "changing-rule",
      ],
    ] as const) {
      const activeFixture = reason === "resource-capacity" ? limited : fixture;
      const report = advanceOptimized(
        createGame(activeFixture.definition),
        activeFixture.definition,
        1_000,
        {
          limits: generousLimits,
          capabilities: [capability],
        },
      );
      expect(report.diagnostics).toContain(`fixture/chain:${reason}`);
    }
  });
});

function chainFixture(initiallyEnabled: boolean, capacity?: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const output = kit.resource("points", {
    scope: run,
    initial: 0,
    ...(capacity === undefined ? {} : { capacity }),
  });
  const tiers = [
    kit.resource("tier-1", { scope: run, initial: 0 }),
    kit.resource("tier-2", { scope: run, initial: 0 }),
  ] as const;
  const production = kit.steppedRule("chain", {
    scope: run,
    update: (transaction, seconds) =>
      advanceProducerChain(transaction, {
        output,
        tiers,
        seconds,
        rate: ({ amount }) => amount,
      }),
  });
  const pulse = kit.automation("pulse", {
    scope: run,
    priority: 1,
    cadenceMs: 5_000,
    initiallyEnabled,
    unlocked: () => true,
    condition: () => true,
    action: () => ({ id: "pulse", execute: (transaction) => transaction.add(tiers[1], 1) }),
  });
  const definition = kit.defineGame({
    id: "bulk-chain",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [output, ...tiers],
    automation: [pulse],
    steppedRules: [production],
  });
  const options = {
    id: "fixture/chain",
    version: "1",
    output,
    tiers,
    dependencies: ["chain"],
    coefficient: () => 1,
  } as const;
  return {
    definition,
    output,
    options,
    capability: producerChainBulkCapability(options),
    seed: (game: ReturnType<typeof createGame<number>>) => {
      game.dispatch({ id: "seed", execute: (transaction) => transaction.set(tiers[1], 2) });
      return game;
    },
  };
}

function comparable(snapshot: ReturnType<ReturnType<typeof createGame<number>>["getSnapshot"]>) {
  return { ...snapshot, revision: 0n };
}
