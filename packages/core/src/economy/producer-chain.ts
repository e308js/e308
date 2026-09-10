import type { Resource } from "../model/handles.js";
import { NumericFault } from "../numbers/types.js";
import type { Transaction } from "../state/types.js";

export interface ProducerChainContext<N> {
  readonly index: number;
  readonly amount: N;
}

export interface ProducerChainOptions<N> {
  readonly output: Resource<N>;
  readonly tiers: readonly Resource<N>[];
  readonly seconds: number;
  readonly rate: (context: ProducerChainContext<N>) => N;
}

/** Advances one ordered producer chain from a stable start-of-step snapshot. */
export function advanceProducerChain<N>(
  transaction: Transaction<N>,
  options: ProducerChainOptions<N>,
): readonly N[] {
  if (!Number.isFinite(options.seconds) || options.seconds < 0) {
    throw new TypeError("Producer-chain seconds must be finite and nonnegative");
  }
  if (options.tiers.length === 0) throw new TypeError("Producer chain requires at least one tier");
  const numbers = transaction.numbers;
  const start = options.tiers.map((tier) => transaction.get(tier));
  const seconds = numbers.fromNumber(options.seconds);
  const zero = numbers.fromNumber(0);
  const produced = start.map((amount, index) => {
    const rate = options.rate({ index, amount });
    if (!numbers.isFinite(rate) || numbers.cmp(rate, zero) < 0) {
      throw new NumericFault(`Producer-chain tier ${index + 1} returned an invalid rate`);
    }
    return numbers.mul(rate, seconds);
  });
  for (let index = 0; index < produced.length; index += 1) {
    const target = index === 0 ? options.output : (options.tiers[index - 1] as Resource<N>);
    const amount = produced[index] as N;
    transaction.add(target, amount);
    transaction.addProduction(target.id, amount);
  }
  return Object.freeze(produced);
}
