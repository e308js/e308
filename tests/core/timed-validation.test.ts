import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  defineGame,
  nativeNumbers,
  queueTaskCommand,
} from "../../packages/core/src/index.js";
import { deserializeTimedState } from "../../packages/core/src/persistence/deserialize-timed.js";
import type { SerializedScopeState } from "../../packages/core/src/persistence/types.js";
import { validateTimedShape } from "../../packages/core/src/persistence/validate-timed.js";
import {
  initialCalendars,
  initialMarkets,
  initialTasks,
} from "../../packages/core/src/state/timed-state.js";

function fixture(mode: "fixed-duration" | "current-rate" = "fixed-duration") {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const goods = kit.resource("goods", { scope: run, initial: 0, capacity: 5 });
  const cash = kit.resource("cash", { scope: run, initial: 10 });
  const task = kit.task("job", {
    scope: run,
    inputs: [[cash, 1]],
    outputs: [[goods, 1]],
    work:
      mode === "fixed-duration"
        ? { kind: mode, durationMs: 500 }
        : { kind: mode, work: 5, rate: () => 1 },
    delivery: "block",
    cancellation: { refund: "full" },
    queueLimit: 2,
  });
  const calendar = kit.calendar("year", {
    scope: run,
    phases: [{ id: "spring", durationMs: 200 }],
  });
  const market = kit.market("shop", {
    scope: run,
    inventory: goods,
    currency: cash,
    price: { kind: "fixed", buy: 1, sell: 1 },
    feeRate: 0,
    feeRounding: "none",
    maximumQuantity: 2,
  });
  const definition = kit.defineGame({
    id: `timed-${mode}`,
    simulationVersion: 1,
    stepMs: 100,
    resources: [goods, cash],
    tasks: [task],
    calendars: [calendar],
    markets: [market],
  });
  const game = createGame(definition);
  game.dispatch(queueTaskCommand(task));
  return { definition, game, task };
}

describe("timed-state restoration", () => {
  it("rejects initializing market state without a numeric adapter", () => {
    const incomplete = defineGame({ id: "incomplete", simulationVersion: 1, stepMs: 1 });
    expect(initialTasks(incomplete)).toEqual({});
    expect(initialCalendars(incomplete)).toEqual({});
    expect(() => initialMarkets(incomplete)).toThrow("numeric adapter");
  });
  it("rejects invalid task sequences, work, inventories, and queue limits", () => {
    const { definition, game } = fixture();
    const snapshot = game.getSnapshot();
    const state = snapshot.tasks.job as NonNullable<typeof snapshot.tasks.job>;
    const active = required(state.active);
    if (active.mode !== "fixed-duration") throw new Error("expected fixed task");
    const restore = (changed: typeof state) => () =>
      createGame(definition, { snapshot: { ...snapshot, tasks: { job: changed } } });
    expect(restore({ ...state, nextSequence: -1n })).toThrow("task");
    expect(restore({ ...state, active: { ...active, remainingMs: 600 } })).toThrow("progress");
    expect(restore({ ...state, active: { ...active, outputs: { wrong: 1 } } })).toThrow(
      "inventory",
    );
    expect(restore({ ...state, active: { ...active, escrow: { cash: -1 } } })).toThrow("escrow");
    expect(restore({ ...state, completed: [{ sequence: 1n, quantities: { goods: 1 } }] })).toThrow(
      "Duplicate",
    );
    const queued = { sequence: 2n, escrow: active.escrow, outputs: active.outputs };
    expect(
      restore({ ...state, nextSequence: 3n, queue: [queued, { ...queued, sequence: 3n }] }),
    ).toThrow("queue limit");
  });

  it("rejects invalid current work, calendar ledgers, and market totals", () => {
    const current = fixture("current-rate");
    const currentSnapshot = current.game.getSnapshot();
    const currentState = currentSnapshot.tasks.job as NonNullable<typeof currentSnapshot.tasks.job>;
    const currentActive = required(currentState.active);
    if (currentActive.mode !== "current-rate") throw new Error("expected current-rate task");
    expect(() =>
      createGame(current.definition, {
        snapshot: {
          ...currentSnapshot,
          tasks: {
            job: {
              ...currentState,
              active: { ...currentActive, remainingWork: 6 },
            },
          },
        },
      }),
    ).toThrow("progress");
    const { definition, game } = fixture();
    const snapshot = game.getSnapshot();
    const calendar = snapshot.calendars.year as NonNullable<typeof snapshot.calendars.year>;
    const restoreCalendar = (changed: typeof calendar) => () =>
      createGame(definition, { snapshot: { ...snapshot, calendars: { year: changed } } });
    expect(restoreCalendar({ ...calendar, phaseIndex: 2 })).toThrow("calendar");
    expect(restoreCalendar({ ...calendar, elapsedMs: 200 })).toThrow("calendar");
    expect(restoreCalendar({ ...calendar, cycle: -1n })).toThrow("cycle");
    expect(
      restoreCalendar({
        ...calendar,
        boundaries: [{ sequence: 2n, phaseId: "wrong", cycle: 0n, atGameMs: 1 }],
      }),
    ).toThrow("boundary");
    expect(() =>
      createGame(definition, {
        snapshot: { ...snapshot, markets: { shop: { bought: -1, sold: 0 } } },
      }),
    ).toThrow("market bought");
  });
});

describe("timed save shapes", () => {
  it("decodes both active modes and rejects invalid integer encodings", () => {
    const scope = serializedScope();
    const fixed = deserializeTimedState({ run: scope }, Number);
    expect(fixed.tasks.job?.active).toMatchObject({ mode: "fixed-duration", remainingMs: 5 });
    const active = required(scope.tasks?.job?.active);
    const currentScope = {
      ...scope,
      tasks: {
        job: {
          ...required(scope.tasks?.job),
          active: {
            ...active,
            mode: "current-rate" as const,
            remainingWork: 2,
            remainingMs: undefined as never,
          },
        },
      },
    };
    const current = deserializeTimedState({ run: currentScope }, Number);
    expect(current.tasks.job?.active).toMatchObject({ mode: "current-rate", remainingWork: 2 });
    expect(() =>
      deserializeTimedState(
        {
          run: {
            ...scope,
            generation: "x",
            tasks: { job: { ...required(scope.tasks?.job), nextSequence: "01" } },
          },
        },
        Number,
      ),
    ).toThrow("task sequence");
  });

  it("rejects unknown fields and malformed task/calendar collections", () => {
    const scope = serializedScope();
    expect(() =>
      validateTimedShape({
        ...scope,
        tasks: { job: { ...required(scope.tasks?.job), extra: true } as never },
      }),
    ).toThrow("Unexpected");
    expect(() =>
      validateTimedShape({
        ...scope,
        tasks: { job: { ...required(scope.tasks?.job), queue: null as never } },
      }),
    ).toThrow("collections");
    expect(() =>
      validateTimedShape({
        ...scope,
        calendars: { year: { ...required(scope.calendars?.year), boundaries: null as never } },
      }),
    ).toThrow("ledger");
    expect(() =>
      validateTimedShape({
        ...scope,
        markets: { shop: { bought: "0", sold: "0", extra: 1 } as never },
      }),
    ).toThrow("Unexpected");
  });
});

function serializedScope(): SerializedScopeState {
  return {
    generation: "0",
    resources: {},
    purchaseCounts: {},
    allocations: {},
    automation: {},
    upgrades: [],
    milestones: [],
    achievements: [],
    activeChallenges: [],
    challengeCompletions: {},
    tasks: {
      job: {
        nextSequence: "1",
        queue: [],
        active: {
          sequence: "1",
          mode: "fixed-duration",
          remainingMs: 5,
          escrow: { cash: "1" },
          outputs: { goods: "1" },
        },
        completed: [{ sequence: "2", quantities: { goods: "1" } }],
        refunds: [{ sequence: "3", quantities: { cash: "1" } }],
      },
    },
    calendars: {
      year: {
        phaseIndex: 0,
        elapsedMs: 0,
        cycle: "0",
        boundaries: [{ sequence: "1", phaseId: "spring", cycle: "0", atGameMs: 0 }],
      },
    },
    markets: { shop: { bought: "1", sold: "2" } },
  };
}

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("missing fixture value");
  return value;
}
