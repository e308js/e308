import { describe, expect, it } from "vitest";
import {
  automationCommand,
  createGame,
  createGameKit,
  nativeNumbers,
} from "../../packages/core/src/index.js";

describe("automation scheduler", () => {
  it("runs enabled rules at stable cadence and priority through ordinary commands", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const value = kit.resource("value", { scope: run, initial: 1 });
    const multiply = kit.automation("multiply", {
      scope: run,
      priority: 0,
      cadenceMs: 100,
      initiallyEnabled: true,
      unlocked: () => true,
      condition: () => true,
      action: () => ({ id: "times-two", execute: (tx) => tx.set(value, tx.get(value) * 2) }),
    });
    const add = kit.automation("add", {
      scope: run,
      priority: 0,
      cadenceMs: 100,
      initiallyEnabled: true,
      unlocked: () => true,
      condition: () => true,
      action: () => ({ id: "plus-one", execute: (tx) => tx.add(value, 1) }),
    });
    const game = createGame(
      kit.defineGame({
        id: "automation",
        simulationVersion: 1,
        stepMs: 50,
        resources: [value],
        automation: [multiply, add],
      }),
    );
    game.advance(250);
    expect(game.getSnapshot().resources.value).toBe(10);
    expect(game.getSnapshot().progression.automation).toEqual({
      add: { enabled: true, nextRunMs: 300 },
      multiply: { enabled: true, nextRunMs: 300 },
    });
  });

  it("supports explicit enablement and preserves failures atomically", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const value = kit.resource("value", { scope: run, initial: 0 });
    const locked = kit.automation("locked", {
      scope: run,
      cadenceMs: 50,
      initiallyEnabled: false,
      unlocked: (state) => state.get(value) > 0,
      condition: () => true,
      action: () => ({ id: "add", execute: (tx) => tx.add(value, 1) }),
    });
    const game = createGame(
      kit.defineGame({
        id: "automation-toggle",
        simulationVersion: 1,
        stepMs: 50,
        resources: [value],
        automation: [locked],
      }),
    );
    expect(game.dispatch(automationCommand(locked, true))).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    game.dispatch({ id: "unlock", execute: (tx) => tx.set(value, 1) });
    game.dispatch(automationCommand(locked, true));
    game.advance(50);
    expect(game.getSnapshot().resources.value).toBe(2);
    game.dispatch(automationCommand(locked, false));
    game.advance(100);
    expect(game.getSnapshot().resources.value).toBe(2);
  });
});
