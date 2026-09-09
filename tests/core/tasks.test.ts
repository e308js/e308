import { describe, expect, it } from "vitest";
import {
  cancelTaskCommand,
  claimTaskRefundCommand,
  createGame,
  createGameKit,
  nativeNumbers,
  queueTaskCommand,
} from "../../packages/core/src/index.js";

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const coins = kit.resource("coins", { scope: run, initial: 20, capacity: 20 });
  const goods = kit.resource("goods", { scope: run, initial: 0, capacity: 5 });
  const speed = kit.resource("speed", { scope: run, initial: 4 });
  const bake = kit.task("bake", {
    scope: run,
    inputs: [[coins, 5]],
    outputs: [[goods, 3]],
    work: { kind: "fixed-duration", durationMs: 100 },
    delivery: "block",
    cancellation: { refund: "full" },
    queueLimit: 2,
  });
  const research = kit.task("research", {
    scope: run,
    inputs: [],
    outputs: [[goods, 1]],
    work: { kind: "current-rate", work: 10, rate: (tx) => tx.get(speed) },
    delivery: "discard-overflow",
    cancellation: { refund: "none" },
    queueLimit: 1,
  });
  const definition = kit.defineGame({
    id: "task-test",
    simulationVersion: 1,
    stepMs: 100,
    resources: [coins, goods, speed],
    tasks: [bake, research],
  });
  return {
    kit,
    run,
    coins,
    goods,
    speed,
    bake,
    research,
    definition,
    game: createGame(definition),
  };
}

describe("paid tasks", () => {
  it("escrows queued work, blocks output atomically, and delivers each task once", () => {
    const { game, bake, coins, goods } = fixture();
    expect(game.dispatch(queueTaskCommand(bake)).ok).toBe(true);
    expect(game.dispatch(queueTaskCommand(bake)).ok).toBe(true);
    expect(game.dispatch(queueTaskCommand(bake))).toMatchObject({
      ok: false,
      error: { code: "budget-exceeded" },
    });
    expect(game.getSnapshot().resources[coins.id]).toBe(10);
    game.advance(100);
    expect(game.getSnapshot().resources[goods.id]).toBe(3);
    game.advance(100);
    expect(game.getSnapshot().tasks[bake.id]?.active).toMatchObject({ remainingMs: 0 });
    expect(game.getSnapshot().tasks[bake.id]?.completed).toHaveLength(1);
    game.dispatch({ id: "ship", execute: (tx) => tx.set(goods, 0) });
    game.advance(100);
    expect(game.getSnapshot().resources[goods.id]).toBe(3);
    expect(game.getSnapshot().tasks[bake.id]?.completed).toHaveLength(2);
    game.advance(500);
    expect(game.getSnapshot().resources[goods.id]).toBe(3);
  });

  it("persists refund claims when capacity prevents cancellation delivery", () => {
    const { game, bake, coins } = fixture();
    game.dispatch(queueTaskCommand(bake));
    const sequence = game.getSnapshot().tasks[bake.id]?.active?.sequence as bigint;
    game.dispatch(cancelTaskCommand(bake, sequence));
    expect(game.getSnapshot().tasks[bake.id]?.refunds).toHaveLength(1);
    game.dispatch({ id: "fill", execute: (tx) => tx.set(coins, 20) });
    expect(game.dispatch(claimTaskRefundCommand(bake, sequence))).toMatchObject({
      ok: false,
      error: { code: "capacity-blocked" },
    });
    expect(game.getSnapshot().tasks[bake.id]?.refunds).toHaveLength(1);
    game.dispatch({ id: "spend", execute: (tx) => tx.set(coins, 10) });
    expect(game.dispatch(claimTaskRefundCommand(bake, sequence)).ok).toBe(true);
    expect(game.getSnapshot().resources[coins.id]).toBe(15);
    expect(game.getSnapshot().tasks[bake.id]?.refunds).toHaveLength(0);
  });

  it("uses the current rate per canonical step and clears or retains tasks on reset", () => {
    const { game, research, speed, goods, run } = fixture();
    game.dispatch(queueTaskCommand(research));
    game.advance(1_000);
    const remaining = game.getSnapshot().tasks[research.id]?.active;
    expect(remaining?.mode === "current-rate" ? remaining.remainingWork : Number.NaN).toBeCloseTo(
      6,
    );
    game.dispatch({ id: "speed-up", execute: (tx) => tx.set(speed, 10) });
    game.advance(600);
    expect(game.getSnapshot().resources[goods.id]).toBe(1);
    game.dispatch(queueTaskCommand(research));
    game.dispatch({
      id: "retain",
      execute: (tx) => tx.reset({ clear: [run], retain: { tasks: [research] } }),
    });
    expect(game.getSnapshot().tasks[research.id]?.active).not.toBeNull();
    game.dispatch({ id: "clear", execute: (tx) => tx.reset({ clear: [run] }) });
    expect(game.getSnapshot().tasks[research.id]).toMatchObject({ active: null, queue: [] });
  });

  it("validates definitions and rejects absent cancellation targets", () => {
    const { kit, run, goods, game, bake } = fixture();
    expect(() =>
      kit.task("bad", {
        scope: run,
        inputs: [],
        outputs: [[goods, 1]],
        work: { kind: "fixed-duration", durationMs: 0 },
        delivery: "block",
        cancellation: { refund: "none" },
        queueLimit: 1,
      }),
    ).toThrow("duration");
    expect(() =>
      kit.task("bad-current", {
        scope: run,
        inputs: [],
        outputs: [[goods, 1]],
        work: { kind: "current-rate", work: 0, rate: () => 1 },
        delivery: "block",
        cancellation: { refund: "none" },
        queueLimit: 1,
      }),
    ).toThrow("work");
    expect(() =>
      kit.task("bad-queue", {
        scope: run,
        inputs: [],
        outputs: [[goods, 1]],
        work: { kind: "fixed-duration", durationMs: 1 },
        delivery: "block",
        cancellation: { refund: "none" },
        queueLimit: 0,
      }),
    ).toThrow("queue limit");
    expect(() =>
      kit.task("bad-output", {
        scope: run,
        inputs: [],
        outputs: [],
        work: { kind: "fixed-duration", durationMs: 1 },
        delivery: "block",
        cancellation: { refund: "none" },
        queueLimit: 1,
      }),
    ).toThrow("produce");
    expect(() =>
      kit.task("bad-refund", {
        scope: run,
        inputs: [],
        outputs: [[goods, 1]],
        work: { kind: "fixed-duration", durationMs: 1 },
        delivery: "block",
        cancellation: { refund: "fraction", ratio: 2 },
        queueLimit: 1,
      }),
    ).toThrow("refund ratio");
    expect(game.dispatch(cancelTaskCommand(bake, 99n))).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
  });

  it("rejects unpaid and inactive work and validates current-rate callbacks", () => {
    const { game, bake, coins, kit, run, goods } = fixture();
    game.dispatch({ id: "empty", execute: (tx) => tx.set(coins, 0) });
    expect(game.dispatch(queueTaskCommand(bake))).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
    const badRate = kit.task("bad-rate", {
      scope: run,
      inputs: [],
      outputs: [[goods, 1]],
      work: { kind: "current-rate", work: 1, rate: () => -1 },
      delivery: "block",
      cancellation: { refund: "none" },
      queueLimit: 1,
    });
    const inactive = kit.scopeActivation("inactive", { scope: run, active: () => false });
    const inactiveGame = createGame(
      kit.defineGame({
        id: "inactive-task",
        simulationVersion: 1,
        stepMs: 100,
        resources: [coins, goods],
        tasks: [badRate],
        scopeActivations: [inactive],
      }),
    );
    expect(inactiveGame.dispatch(queueTaskCommand(badRate))).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    const rateGame = createGame(
      kit.defineGame({
        id: "bad-rate-task",
        simulationVersion: 1,
        stepMs: 100,
        resources: [coins, goods],
        tasks: [badRate],
      }),
    );
    rateGame.dispatch(queueTaskCommand(badRate));
    expect(rateGame.advance(100)).toMatchObject({
      ok: false,
      error: { code: "transaction-failed" },
    });
  });

  it("records zero delivered overflow and fractional queued refunds", () => {
    const { kit, run, coins, goods } = fixture();
    const task = kit.task("fractional", {
      scope: run,
      inputs: [[coins, 2]],
      outputs: [[goods, 2]],
      work: { kind: "fixed-duration", durationMs: 100 },
      delivery: "discard-overflow",
      cancellation: { refund: "fraction", ratio: 0.5 },
      queueLimit: 2,
    });
    const definition = kit.defineGame({
      id: "fractional-task",
      simulationVersion: 1,
      stepMs: 100,
      resources: [coins, goods],
      tasks: [task],
    });
    const subject = createGame(definition);
    subject.dispatch({ id: "full", execute: (tx) => tx.set(goods, 5) });
    subject.dispatch(queueTaskCommand(task));
    subject.dispatch(queueTaskCommand(task));
    subject.dispatch(cancelTaskCommand(task, 2n));
    expect(subject.getSnapshot().tasks.fractional?.refunds[0]?.quantities.coins).toBe(1);
    subject.advance(100);
    expect(subject.getSnapshot().tasks.fractional?.completed[0]?.quantities.goods).toBe(0);
  });
});
