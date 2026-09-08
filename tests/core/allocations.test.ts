import { describe, expect, it } from "vitest";
import {
  allocationCommand,
  createGame,
  createGameKit,
  nativeNumbers,
} from "../../packages/core/src/index.js";

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const workers = kit.resource("workers", { scope: run, initial: 5 });
  const output = kit.resource("output", { scope: run, initial: 0 });
  const work = kit.allocation("work", {
    scope: run,
    budget: workers,
    targets: ["manual", "research"],
    initial: { manual: 1 },
  });
  const production = kit.flow("allocated-output", {
    scope: run,
    rate: kit.rates.allocated(work, "manual", 2),
    produces: [[output, 1]],
  });
  const game = createGame(
    kit.defineGame({
      id: "allocations",
      simulationVersion: 1,
      stepMs: 1000,
      resources: [workers, output],
      flows: [production],
      allocations: [work],
    }),
  );
  return { game, kit, output, production, run, work, workers };
}

describe("allocations", () => {
  it("persists assignments and drives inspectable rates", () => {
    const { game, work } = fixture();
    expect(game.getSnapshot().allocations.work).toEqual({ manual: 1, research: 0 });
    expect(game.dispatch(allocationCommand(work, "manual", 3)).ok).toBe(true);
    game.advance(1000);
    expect(game.getSnapshot().resources.output).toBe(6);
    expect(Object.isFrozen(game.getSnapshot().allocations.work)).toBe(true);
  });

  it("rejects over-budget, negative, and unknown assignments", () => {
    const { game, work } = fixture();
    expect(game.dispatch(allocationCommand(work, "research", 5))).toEqual({
      ok: false,
      error: { code: "allocation-exceeded", allocationId: "work", assigned: 6, budget: 5 },
    });
    expect(game.dispatch(allocationCommand(work, "manual", -1))).toEqual({
      ok: false,
      error: { code: "invalid-count", requested: -1 },
    });
    expect(game.dispatch(allocationCommand(work, "unknown", 1))).toEqual({
      ok: false,
      error: { code: "invalid-target", id: "work:unknown" },
    });
  });

  it("rolls back any command that would invalidate the budget", () => {
    const { game, workers } = fixture();
    expect(game.dispatch({ id: "remove-workers", execute: (tx) => tx.set(workers, 0) })).toEqual({
      ok: false,
      error: { code: "allocation-exceeded", allocationId: "work", assigned: 1, budget: 0 },
    });
    expect(game.getSnapshot().resources.workers).toBe(5);
  });

  it("validates definitions and allocated rates", () => {
    const { kit, run, work, workers } = fixture();
    const other = fixture();
    expect(() => kit.rates.allocated(work, "missing", 1)).toThrow("Unknown allocation target");
    expect(() => kit.rates.allocated(other.work, "manual", 1)).toThrow("another game kit");
    expect(() => kit.rates.allocated(work, "manual", Number.NaN)).toThrow("must be finite");
    expect(() => kit.allocation("empty", { scope: run, budget: workers, targets: [] })).toThrow(
      "unique targets",
    );
    expect(() =>
      kit.allocation("duplicate", { scope: run, budget: workers, targets: ["a", "a"] }),
    ).toThrow("unique targets");
    expect(() =>
      kit.allocation("unknown", {
        scope: run,
        budget: workers,
        targets: ["a"],
        initial: { b: 1 },
      }),
    ).toThrow("unknown initial target");
    expect(() =>
      kit.allocation("negative", {
        scope: run,
        budget: workers,
        targets: ["a"],
        initial: { a: -1 },
      }),
    ).toThrow("nonnegative and finite");
    expect(() =>
      kit.allocation("excess", {
        scope: run,
        budget: workers,
        targets: ["a"],
        initial: { a: 6 },
      }),
    ).toThrow("exceeds its initial budget");
  });
});
