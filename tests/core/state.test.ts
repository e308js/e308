import { describe, expect, it, vi } from "vitest";
import { createGame, createGameKit, nativeNumbers } from "../../packages/core/src/index.js";

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const scope = kit.scope("run");
  const value = kit.resource("value", { scope, initial: 1 });
  const definition = kit.defineGame({
    id: "state-test",
    simulationVersion: 1,
    stepMs: 50,
    resources: [value],
  });
  return { game: createGame(definition), kit, scope, value };
}

describe("transactional game state", () => {
  it("keeps snapshot identity until a commit and freezes reachable records", () => {
    const { game, value } = fixture();
    const before = game.getSnapshot();
    expect(game.getSnapshot()).toBe(before);
    const result = game.dispatch({ id: "increment", execute: (tx) => tx.add(value, 2) });
    expect(result).toEqual({ ok: true, value: { commandId: "increment", revision: 1n } });
    const after = game.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.resources.value).toBe(3);
    expect(before.resources.value).toBe(1);
    expect(Object.isFrozen(after.resources)).toBe(true);
  });

  it("rolls back failures and rejects stale revisions", () => {
    const { game, value } = fixture();
    const before = game.getSnapshot();
    expect(
      game.dispatch({
        id: "failure",
        execute: (tx) => {
          tx.set(value, 7);
          throw new Error("stop");
        },
      }),
    ).toEqual({ ok: false, error: { code: "transaction-failed", message: "stop" } });
    expect(game.getSnapshot()).toBe(before);
    expect(game.dispatch({ id: "stale", expectedRevision: 2n, execute: () => undefined })).toEqual({
      ok: false,
      error: { code: "stale-revision", expected: 2n, current: 0n },
    });
  });

  it("rejects foreign resources and non-finite values", () => {
    const { game, value } = fixture();
    const other = fixture().value;
    expect(game.dispatch({ id: "foreign", execute: (tx) => tx.get(other) })).toEqual({
      ok: false,
      error: { code: "invalid-target", id: "value" },
    });
    const result = game.dispatch({ id: "invalid", execute: (tx) => tx.set(value, Number.NaN) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("numeric-fault");
  });

  it("advances in fixed steps in one committed publication", () => {
    const { game, value } = fixture();
    const listener = vi.fn();
    game.subscribe((state) => state.resources.value, listener);
    const result = game.advance(125, (tx, seconds) => tx.add(value, 10 * seconds));
    expect(result.ok).toBe(true);
    expect(game.getSnapshot()).toMatchObject({ gameTimeMs: 100, remainderMs: 25, revision: 1n });
    expect(game.getSnapshot().resources.value).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("commits remainder-only time and isolates observer failures", () => {
    const { game } = fixture();
    const stable = vi.fn();
    game.subscribe(
      (state) => state.gameTimeMs,
      () => {
        throw new Error("view failed");
      },
    );
    const unsubscribe = game.subscribe(
      (state) => state.revision,
      stable,
      () => false,
    );
    expect(game.advance(20, () => undefined).ok).toBe(true);
    expect(game.getSnapshot().remainderMs).toBe(20);
    expect(stable).toHaveBeenCalledOnce();
    const after = game.getSnapshot();
    expect(game.advance(0, () => undefined)).toEqual({ ok: true, value: after });
    expect(game.getSnapshot()).toBe(after);
    unsubscribe();
    game.advance(20, () => undefined);
    expect(stable).toHaveBeenCalledOnce();
  });

  it("rolls back all steps when advancement fails", () => {
    const { game, value } = fixture();
    const before = game.getSnapshot();
    const result = game.advance(100, (tx) => {
      tx.add(value, 1);
      throw "step failed";
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "transaction-failed", message: "step failed" },
    });
    expect(game.getSnapshot()).toBe(before);
  });

  it("requires an owned definition", () => {
    expect(() => createGame({ id: "plain" as never, simulationVersion: 1, stepMs: 50 })).toThrow(
      "createGameKit",
    );
  });
});
