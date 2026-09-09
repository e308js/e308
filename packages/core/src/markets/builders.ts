import { owned } from "../model/handles.js";
import { assertOwner, validId } from "../model/validation.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { MarketDefinition } from "./types.js";

export type MarketOptions<N> = Omit<MarketDefinition<N>, "id">;

export function createMarket<N>(
  id: string,
  options: MarketOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): MarketDefinition<N> {
  validId(id, "market");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  assertOwner(options.inventory, owner, `Inventory for ${id}`);
  assertOwner(options.currency, owner, `Currency for ${id}`);
  if (!Number.isSafeInteger(options.maximumQuantity) || options.maximumQuantity < 1)
    throw new TypeError(`Market ${id} maximum quantity must be a positive safe integer`);
  if (
    !numbers.isFinite(options.feeRate) ||
    numbers.cmp(options.feeRate, numbers.fromNumber(0)) < 0 ||
    numbers.cmp(options.feeRate, numbers.fromNumber(1)) > 0
  ) {
    throw new TypeError(`Market ${id} fee rate must be between zero and one`);
  }
  if (options.price.kind === "fixed") {
    for (const price of [options.price.buy, options.price.sell]) {
      if (!numbers.isFinite(price) || numbers.cmp(price, numbers.fromNumber(0)) < 0)
        throw new TypeError(`Market ${id} prices must be nonnegative and finite`);
    }
  }
  return owned({ ...options, id }, owner);
}
