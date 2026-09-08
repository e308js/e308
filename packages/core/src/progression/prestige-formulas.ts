import type { ReadContext } from "../economy/types.js";
import type { Resource } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { PrestigeDefinition } from "./resets.js";

export type PrestigePolicy<N> = Pick<PrestigeDefinition<N>, "canReset" | "rewardFor">;

interface SharedFormulaOptions<N> {
  readonly baseResource: Resource<N>;
  readonly requirement: N;
  readonly exponent: N;
  readonly gainMultiplier?: N;
  readonly gainExponent?: N;
  readonly directMultiplier?: N;
}

export function normalPrestige<N>(
  numbers: NumericAdapter<N>,
  options: SharedFormulaOptions<N> & {
    readonly softcap?: { readonly threshold: N; readonly power: N };
  },
): PrestigePolicy<N> {
  const math = formulaMath(numbers, options);
  if (
    options.softcap &&
    (!numbers.isFinite(options.softcap.threshold) ||
      !numbers.isFinite(options.softcap.power) ||
      numbers.cmp(options.softcap.threshold, math.zero) <= 0 ||
      numbers.cmp(options.softcap.power, math.zero) <= 0)
  ) {
    throw new TypeError("Normal prestige softcap parameters must be positive and finite");
  }
  const rewardFor = (state: ReadContext<N>): N => {
    if (numbers.cmp(state.get(options.baseResource), options.requirement) < 0) return math.zero;
    let gain = math.pow(
      numbers.div(state.get(options.baseResource), options.requirement),
      options.exponent,
    );
    gain = math.pow(numbers.mul(gain, math.gainMultiplier), math.gainExponent);
    if (options.softcap && numbers.cmp(gain, options.softcap.threshold) >= 0) {
      gain = numbers.mul(
        math.pow(gain, options.softcap.power),
        math.pow(options.softcap.threshold, numbers.sub(math.one, options.softcap.power)),
      );
    }
    return numbers.floor(numbers.mul(gain, math.directMultiplier));
  };
  return Object.freeze({
    canReset: (state: ReadContext<N>) =>
      numbers.cmp(state.get(options.baseResource), options.requirement) >= 0,
    rewardFor,
  });
}

export function staticPrestige<N>(
  numbers: NumericAdapter<N>,
  options: SharedFormulaOptions<N> & {
    readonly rewardResource: Resource<N>;
    readonly base: N;
    readonly canBuyMax?: boolean;
    readonly roundUpCost?: boolean;
  },
): PrestigePolicy<N> {
  const math = formulaMath(numbers, options);
  if (numbers.cmp(options.base, math.one) <= 0)
    throw new TypeError("Static prestige base must be greater than one");
  const nextCost = (state: ReadContext<N>): N => {
    const amount = numbers.div(state.get(options.rewardResource), math.directMultiplier);
    const power = numbers.div(math.pow(amount, options.exponent), math.gainExponent);
    let cost = numbers.mul(
      numbers.mul(math.pow(options.base, power), math.gainMultiplier),
      options.requirement,
    );
    if (numbers.cmp(cost, options.requirement) < 0) cost = options.requirement;
    return options.roundUpCost ? ceil(cost, numbers) : cost;
  };
  const rewardFor = (state: ReadContext<N>): N => {
    if (!options.canBuyMax) return math.one;
    let raw = math.log(
      numbers.div(
        numbers.div(state.get(options.baseResource), options.requirement),
        math.gainMultiplier,
      ),
      options.base,
    );
    if (numbers.cmp(raw, math.zero) < 0) raw = math.zero;
    const target = numbers.mul(
      math.pow(numbers.mul(raw, math.gainExponent), numbers.div(math.one, options.exponent)),
      math.directMultiplier,
    );
    const gain = numbers.add(
      numbers.sub(numbers.floor(target), state.get(options.rewardResource)),
      math.one,
    );
    return numbers.cmp(gain, math.one) < 0 ? math.one : gain;
  };
  return Object.freeze({
    canReset: (state: ReadContext<N>) =>
      numbers.cmp(state.get(options.baseResource), nextCost(state)) >= 0,
    rewardFor,
  });
}

function formulaMath<N>(numbers: NumericAdapter<N>, options: SharedFormulaOptions<N>) {
  const zero = numbers.fromNumber(0);
  const one = numbers.fromNumber(1);
  const pow = numbers.transcendental?.pow;
  const log = numbers.transcendental?.log;
  if (!pow || !log) throw new TypeError(`Prestige formulas are unsupported by ${numbers.id}`);
  const gainMultiplier = options.gainMultiplier ?? one;
  const gainExponent = options.gainExponent ?? one;
  const directMultiplier = options.directMultiplier ?? one;
  for (const value of [
    options.requirement,
    options.exponent,
    gainMultiplier,
    gainExponent,
    directMultiplier,
  ]) {
    if (!numbers.isFinite(value) || numbers.cmp(value, zero) <= 0)
      throw new TypeError("Prestige formula parameters must be positive and finite");
  }
  return { zero, one, pow, log, gainMultiplier, gainExponent, directMultiplier };
}

function ceil<N>(value: N, numbers: NumericAdapter<N>): N {
  const floor = numbers.floor(value);
  return numbers.cmp(floor, value) === 0 ? floor : numbers.add(floor, numbers.fromNumber(1));
}
