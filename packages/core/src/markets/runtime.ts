import { resolveCapacity } from "../economy/entries.js";
import type { Resource } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { Command, CommandFailure, Result, Snapshot } from "../state/types.js";
import type { MarketDefinition, MarketQuote, MarketSide } from "./types.js";

export function quoteMarket<N>(
  market: MarketDefinition<N>,
  snapshot: Snapshot<N>,
  side: MarketSide,
  quantity: number,
  numbers: NumericAdapter<N>,
): Result<MarketQuote<N>, CommandFailure<N>> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > market.maximumQuantity)
    return { ok: false, error: { code: "invalid-count", requested: quantity } };
  const state = snapshot.markets[market.id];
  if (!state) return { ok: false, error: { code: "invalid-target", id: market.id } };
  try {
    return calculateQuote(
      market,
      side,
      quantity,
      state,
      (resource) => snapshot.resources[resource.id] as N,
      snapshot.revision,
      numbers,
    );
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "transaction-failed",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function calculateQuote<N>(
  market: MarketDefinition<N>,
  side: MarketSide,
  quantity: number,
  state: { readonly bought: N; readonly sold: N },
  get: (resource: Resource<N>) => N,
  revision: bigint,
  numbers: NumericAdapter<N>,
): Result<MarketQuote<N>, CommandFailure<N>> {
  const volume = side === "buy" ? state.bought : state.sold;
  const gross = totalPrice(market, side, quantity, volume, get, numbers);
  const fee = roundedFee(numbers.mul(gross, market.feeRate), market.feeRounding, numbers);
  const settlement = side === "buy" ? numbers.add(gross, fee) : numbers.sub(gross, fee);
  const inventory = get(market.inventory);
  const currency = get(market.currency);
  const units = numbers.fromNumber(quantity);
  const inventoryAfter =
    side === "buy" ? numbers.add(inventory, units) : numbers.sub(inventory, units);
  const failure = tradeFailure(
    market,
    side,
    inventory,
    currency,
    inventoryAfter,
    settlement,
    get,
    numbers,
  );
  if (failure) return { ok: false, error: failure };
  return {
    ok: true,
    value: Object.freeze({
      marketId: market.id,
      side,
      quantity,
      gross,
      fee,
      settlement,
      inventoryAfter,
      volumeAfter: numbers.add(volume, units),
      revision,
    }),
  };
}

export function marketCommand<N>(market: MarketDefinition<N>, quote: MarketQuote<N>): Command<N> {
  return {
    id: `market:${market.id}:${quote.side}`,
    expectedRevision: quote.revision,
    execute: (transaction) => {
      if (quote.marketId !== market.id)
        transaction.reject({ code: "invalid-target", id: quote.marketId });
      if (
        !Number.isSafeInteger(quote.quantity) ||
        quote.quantity < 1 ||
        quote.quantity > market.maximumQuantity
      )
        transaction.reject({ code: "invalid-count", requested: quote.quantity });
      const current = calculateQuote(
        market,
        quote.side,
        quote.quantity,
        transaction.getMarketState(market.id),
        (resource) => transaction.get(resource),
        quote.revision,
        transaction.numbers,
      );
      const verified = current.ok ? current.value : transaction.reject(current.error);
      if (!sameQuote(quote, verified, transaction.numbers))
        transaction.reject({ code: "invalid-target", id: `${market.id}:quote` });
      const currencyDelta =
        quote.side === "buy" ? negate(quote.settlement, transaction.numbers) : quote.settlement;
      transaction.set(market.inventory, quote.inventoryAfter);
      transaction.add(market.currency, currencyDelta);
      const state = transaction.getMarketState(market.id);
      transaction.setMarketState(
        market.id,
        quote.side === "buy"
          ? { ...state, bought: quote.volumeAfter }
          : { ...state, sold: quote.volumeAfter },
      );
    },
  };
}

function totalPrice<N>(
  market: MarketDefinition<N>,
  side: MarketSide,
  quantity: number,
  volume: N,
  get: (resource: Resource<N>) => N,
  numbers: NumericAdapter<N>,
): N {
  if (market.price.kind === "fixed")
    return numbers.mul(
      side === "buy" ? market.price.buy : market.price.sell,
      numbers.fromNumber(quantity),
    );
  let total = numbers.fromNumber(0);
  for (let offset = 0; offset < quantity; offset += 1) {
    const price = market.price.price({ get, side, volume, offset });
    if (!numbers.isFinite(price) || numbers.cmp(price, numbers.fromNumber(0)) < 0)
      throw new TypeError(`Market ${market.id} returned an invalid marginal price`);
    total = numbers.add(total, price);
  }
  return total;
}

function sameQuote<N>(
  left: MarketQuote<N>,
  right: MarketQuote<N>,
  numbers: NumericAdapter<N>,
): boolean {
  return (
    left.marketId === right.marketId &&
    left.side === right.side &&
    left.quantity === right.quantity &&
    left.revision === right.revision &&
    numbers.cmp(left.gross, right.gross) === 0 &&
    numbers.cmp(left.fee, right.fee) === 0 &&
    numbers.cmp(left.settlement, right.settlement) === 0 &&
    numbers.cmp(left.inventoryAfter, right.inventoryAfter) === 0 &&
    numbers.cmp(left.volumeAfter, right.volumeAfter) === 0
  );
}

function tradeFailure<N>(
  market: MarketDefinition<N>,
  side: MarketSide,
  inventory: N,
  currency: N,
  inventoryAfter: N,
  settlement: N,
  get: (resource: Resource<N>) => N,
  numbers: NumericAdapter<N>,
): CommandFailure<N> | undefined {
  const zero = numbers.fromNumber(0);
  if (side === "sell" && numbers.cmp(inventoryAfter, zero) < 0)
    return {
      code: "insufficient",
      resourceId: market.inventory.id,
      required: numbers.sub(inventory, inventoryAfter),
      available: inventory,
    };
  if (side === "buy" && numbers.cmp(currency, settlement) < 0)
    return {
      code: "insufficient",
      resourceId: market.currency.id,
      required: settlement,
      available: currency,
    };
  const capacity = resolveCapacity(market.inventory, get, numbers);
  if (side === "buy" && capacity !== undefined && numbers.cmp(inventoryAfter, capacity) > 0)
    return {
      code: "capacity-blocked",
      resourceId: market.inventory.id,
      attempted: inventoryAfter,
      capacity,
    };
  return undefined;
}

function roundedFee<N>(
  fee: N,
  rounding: MarketDefinition<N>["feeRounding"],
  numbers: NumericAdapter<N>,
): N {
  if (rounding === "none") return fee;
  if (rounding === "floor") return numbers.floor(fee);
  return negate(numbers.floor(negate(fee, numbers)), numbers);
}

function negate<N>(value: N, numbers: NumericAdapter<N>): N {
  return numbers.sub(numbers.fromNumber(0), value);
}
