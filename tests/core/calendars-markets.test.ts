import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  currentPhase,
  marketCommand,
  nativeNumbers,
  quoteMarket,
} from "../../packages/core/src/index.js";

describe("calendars", () => {
  it("records exact ordered boundaries and cycles", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const year = kit.calendar("year", {
      scope: run,
      phases: [
        { id: "spring", durationMs: 200 },
        { id: "summer", durationMs: 100 },
      ],
    });
    const auxiliary = kit.calendar("auxiliary", {
      scope: run,
      phases: [{ id: "pulse", durationMs: 300 }],
    });
    const middle = kit.calendar("middle", {
      scope: run,
      phases: [{ id: "beat", durationMs: 400 }],
    });
    const game = createGame(
      kit.defineGame({
        id: "calendar-test",
        simulationVersion: 1,
        stepMs: 100,
        resources: [points],
        calendars: [year, auxiliary, middle],
      }),
    );
    game.advance(700);
    expect(game.getSnapshot().calendars.year).toMatchObject({
      phaseIndex: 0,
      elapsedMs: 100,
      cycle: 2n,
    });
    expect(game.getSnapshot().calendars.year?.boundaries).toEqual([
      { sequence: 1n, phaseId: "summer", cycle: 0n, atGameMs: 200 },
      { sequence: 2n, phaseId: "spring", cycle: 1n, atGameMs: 300 },
      { sequence: 3n, phaseId: "summer", cycle: 1n, atGameMs: 500 },
      { sequence: 4n, phaseId: "spring", cycle: 2n, atGameMs: 600 },
    ]);
    game.dispatch({
      id: "phase",
      execute: (tx) => expect(currentPhase(year, tx).id).toBe("spring"),
    });
  });

  it("rejects empty, duplicate, and misaligned phase definitions", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    expect(() => kit.calendar("empty", { scope: run, phases: [] })).toThrow("phase");
    expect(() =>
      kit.calendar("duplicate", {
        scope: run,
        phases: [
          { id: "same", durationMs: 50 },
          { id: "same", durationMs: 50 },
        ],
      }),
    ).toThrow("Duplicate");
    expect(() =>
      kit.calendar("duration", { scope: run, phases: [{ id: "one", durationMs: 0 }] }),
    ).toThrow("duration");
    const odd = kit.calendar("odd", { scope: run, phases: [{ id: "one", durationMs: 75 }] });
    expect(() =>
      kit.defineGame({
        id: "bad-calendar",
        simulationVersion: 1,
        stepMs: 50,
        resources: [points],
        calendars: [odd],
      }),
    ).toThrow("align");
  });

  it("pauses inactive calendars and rejects corrupt phase state", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const year = kit.calendar("year", { scope: run, phases: [{ id: "only", durationMs: 100 }] });
    const inactive = kit.scopeActivation("paused", { scope: run, active: () => false });
    const game = createGame(
      kit.defineGame({
        id: "paused-calendar",
        simulationVersion: 1,
        stepMs: 100,
        resources: [points],
        calendars: [year],
        scopeActivations: [inactive],
      }),
    );
    game.advance(100);
    expect(game.getSnapshot().calendars.year?.elapsedMs).toBe(0);
    expect(
      game.dispatch({
        id: "corrupt-phase",
        execute: (tx) => {
          tx.setCalendarState(year, { phaseIndex: 2, elapsedMs: 0, cycle: 0n, boundaries: [] });
          currentPhase(year, tx);
        },
      }),
    ).toMatchObject({ ok: false, error: { code: "transaction-failed" } });
  });
});

function marketFixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const warehouses = kit.resource("warehouses", { scope: run, initial: 0 });
  const stock = kit.resource("stock", {
    scope: run,
    initial: 2,
    capacityFor: (get) => 4 + get(warehouses) * 5,
  });
  const cash = kit.resource("cash", { scope: run, initial: 100 });
  const fixed = kit.market("fixed", {
    scope: run,
    inventory: stock,
    currency: cash,
    price: { kind: "fixed", buy: 10, sell: 8 },
    feeRate: 0.15,
    feeRounding: "ceil",
    maximumQuantity: 10,
  });
  const changing = kit.market("changing", {
    scope: run,
    inventory: stock,
    currency: cash,
    price: {
      kind: "marginal",
      price: ({ side, volume, offset }) => (side === "buy" ? 3 + volume + offset : 2),
    },
    feeRate: 0,
    feeRounding: "none",
    maximumQuantity: 10,
  });
  const definition = kit.defineGame({
    id: "market-test",
    simulationVersion: 1,
    stepMs: 100,
    resources: [stock, cash, warehouses],
    markets: [fixed, changing],
  });
  return { game: createGame(definition), fixed, changing, stock, cash, warehouses };
}

describe("markets", () => {
  it("quotes fixed prices, fees, capacity, and settles stock/payment atomically", () => {
    const { game, fixed, stock, cash, warehouses } = marketFixture();
    const quote = quoteMarket(fixed, game.getSnapshot(), "buy", 2, nativeNumbers);
    expect(quote).toMatchObject({
      ok: true,
      value: { gross: 20, fee: 3, settlement: 23, inventoryAfter: 4 },
    });
    if (!quote.ok) throw new Error("expected quote");
    expect(game.dispatch(marketCommand(fixed, quote.value)).ok).toBe(true);
    expect(game.getSnapshot().resources).toMatchObject({ [stock.id]: 4, [cash.id]: 77 });
    expect(quoteMarket(fixed, game.getSnapshot(), "buy", 1, nativeNumbers)).toMatchObject({
      ok: false,
      error: { code: "capacity-blocked" },
    });
    game.dispatch({ id: "warehouse", execute: (tx) => tx.set(warehouses, 1) });
    expect(quoteMarket(fixed, game.getSnapshot(), "buy", 1, nativeNumbers).ok).toBe(true);
  });

  it("uses prior volume for each marginal unit and rejects stale or forged quotes", () => {
    const { game, changing, stock, cash } = marketFixture();
    const quote = quoteMarket(changing, game.getSnapshot(), "buy", 2, nativeNumbers);
    expect(quote).toMatchObject({ ok: true, value: { gross: 7, volumeAfter: 2 } });
    if (!quote.ok) throw new Error("expected quote");
    const forged = { ...quote.value, settlement: 1 };
    expect(game.dispatch(marketCommand(changing, forged))).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(game.getSnapshot().resources).toMatchObject({ [stock.id]: 2, [cash.id]: 100 });
    game.dispatch({ id: "touch", execute: () => undefined });
    expect(game.dispatch(marketCommand(changing, quote.value))).toMatchObject({
      ok: false,
      error: { code: "stale-revision" },
    });
  });

  it("reports invalid counts, inventory shortages, and payment shortages", () => {
    const { game, fixed, stock, cash } = marketFixture();
    expect(quoteMarket(fixed, game.getSnapshot(), "buy", 0, nativeNumbers)).toMatchObject({
      ok: false,
      error: { code: "invalid-count" },
    });
    game.dispatch({ id: "poor", execute: (tx) => tx.set(cash, 0) });
    expect(quoteMarket(fixed, game.getSnapshot(), "buy", 1, nativeNumbers)).toMatchObject({
      ok: false,
      error: { code: "insufficient", resourceId: cash.id },
    });
    game.dispatch({ id: "empty", execute: (tx) => tx.set(stock, 0) });
    expect(quoteMarket(fixed, game.getSnapshot(), "sell", 1, nativeNumbers)).toMatchObject({
      ok: false,
      error: { code: "insufficient", resourceId: stock.id },
    });
  });

  it("validates market definitions and marginal prices", () => {
    const { fixed } = marketFixture();
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const stock = kit.resource("stock", { scope: run, initial: 0 });
    const cash = kit.resource("cash", { scope: run, initial: 1 });
    const options = {
      scope: run,
      inventory: stock,
      currency: cash,
      price: { kind: "fixed" as const, buy: 1, sell: 1 },
      feeRate: 0,
      feeRounding: "none" as const,
      maximumQuantity: 1,
    };
    expect(() => kit.market("quantity", { ...options, maximumQuantity: 0 })).toThrow("maximum");
    expect(() => kit.market("fee", { ...options, feeRate: 2 })).toThrow("fee");
    expect(() =>
      kit.market("price", { ...options, price: { kind: "fixed", buy: -1, sell: 1 } }),
    ).toThrow("prices");
    expect(() => kit.market("foreign", { ...options, inventory: fixed.inventory })).toThrow(
      "another game",
    );
    const bad = kit.market("bad-marginal", {
      ...options,
      price: { kind: "marginal", price: () => -1 },
    });
    const game = createGame(
      kit.defineGame({
        id: "bad-market",
        simulationVersion: 1,
        stepMs: 100,
        resources: [stock, cash],
        markets: [bad],
      }),
    );
    expect(quoteMarket(bad, game.getSnapshot(), "buy", 1, nativeNumbers)).toMatchObject({
      ok: false,
      error: { code: "transaction-failed", message: expect.stringContaining("invalid marginal") },
    });
  });

  it("validates a dynamic capacity against the initial snapshot", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const limit = kit.resource("limit", { scope: run, initial: 1 });
    const stock = kit.resource("stock", {
      scope: run,
      initial: 2,
      capacityFor: (get) => get(limit),
    });
    const definition = kit.defineGame({
      id: "invalid-dynamic-capacity",
      simulationVersion: 1,
      stepMs: 100,
      resources: [limit, stock],
    });
    expect(() => createGame(definition)).toThrow("exceeds capacity");
  });

  it("rejects a forged invalid quantity before settlement", () => {
    const { game, fixed } = marketFixture();
    const quote = quoteMarket(fixed, game.getSnapshot(), "buy", 1, nativeNumbers);
    if (!quote.ok) throw new Error("expected quote");
    expect(game.dispatch(marketCommand(fixed, { ...quote.value, quantity: -1 }))).toMatchObject({
      ok: false,
      error: { code: "invalid-count" },
    });
  });

  it("clears or retains calendar and market state with their tagged scope", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const stock = kit.resource("stock", { scope: run, initial: 0 });
    const cash = kit.resource("cash", { scope: run, initial: 10 });
    const calendar = kit.calendar("cycle", {
      scope: run,
      phases: [{ id: "phase", durationMs: 100 }],
    });
    const market = kit.market("shop", {
      scope: run,
      inventory: stock,
      currency: cash,
      price: { kind: "fixed", buy: 1, sell: 1 },
      feeRate: 0,
      feeRounding: "none",
      maximumQuantity: 2,
    });
    const game = createGame(
      kit.defineGame({
        id: "timed-reset",
        simulationVersion: 1,
        stepMs: 100,
        resources: [stock, cash],
        calendars: [calendar],
        markets: [market],
      }),
    );
    const quote = quoteMarket(market, game.getSnapshot(), "buy", 1, nativeNumbers);
    if (!quote.ok) throw new Error("expected quote");
    game.dispatch(marketCommand(market, quote.value));
    game.advance(100);
    game.dispatch({
      id: "retain",
      execute: (tx) =>
        tx.reset({ clear: [run], retain: { calendars: [calendar], markets: [market] } }),
    });
    expect(game.getSnapshot().markets.shop?.bought).toBe(1);
    expect(game.getSnapshot().calendars.cycle?.cycle).toBe(1n);
    game.dispatch({ id: "clear", execute: (tx) => tx.reset({ clear: [run] }) });
    expect(game.getSnapshot().markets.shop).toEqual({ bought: 0, sold: 0 });
    expect(game.getSnapshot().calendars.cycle).toMatchObject({ cycle: 0n, boundaries: [] });
  });
});
