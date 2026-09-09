import type { NumericAdapter } from "../numbers/types.js";
import { NumericFault } from "../numbers/types.js";

export interface PurchaseCurve<N> {
  readonly kind: string;
  readonly numericAdapterId: string;
  unitCost(count: N): N;
  totalCost(startCount: N, quantity: N): N;
  maxAffordable(balance: N, startCount: N, maximum?: N): N;
}

export interface CurveSegment<N> {
  readonly start: N;
  readonly curve: PurchaseCurve<N>;
}

export function enumeratedCurve<N>(
  numbers: NumericAdapter<N>,
  options: { readonly kind?: string; readonly unitCost: (count: N) => N },
): PurchaseCurve<N> {
  const zero = numbers.fromNumber(0);
  const one = numbers.fromNumber(1);
  const unitCost = (count: N): N => {
    requireWhole(count, numbers, "count");
    const cost = options.unitCost(count);
    if (!numbers.isFinite(cost) || numbers.cmp(cost, zero) <= 0) {
      throw new NumericFault("enumerated unit cost must be positive and finite");
    }
    return cost;
  };
  const totalCost = (startCount: N, quantity: N): N => {
    requireWhole(startCount, numbers, "startCount");
    requireWhole(quantity, numbers, "quantity");
    let cursor = startCount;
    let remaining = quantity;
    let total = zero;
    while (numbers.cmp(remaining, zero) > 0) {
      total = numbers.add(total, unitCost(cursor));
      cursor = incrementCount(cursor, one, numbers);
      remaining = numbers.sub(remaining, one);
    }
    return total;
  };
  const maxAffordable = (balance: N, startCount: N, maximum?: N): N => {
    requireWhole(startCount, numbers, "startCount");
    if (maximum !== undefined) requireWhole(maximum, numbers, "maximum");
    if (!numbers.isFinite(balance) || numbers.cmp(balance, zero) < 0) {
      throw new TypeError("balance must be a nonnegative finite quantity");
    }
    let cursor = startCount;
    let spent = zero;
    let bought = zero;
    while (maximum === undefined || numbers.cmp(bought, maximum) < 0) {
      const cost = unitCost(cursor);
      const nextSpent = numbers.add(spent, cost);
      if (numbers.cmp(nextSpent, balance) > 0) break;
      spent = nextSpent;
      cursor = incrementCount(cursor, one, numbers);
      bought = incrementCount(bought, one, numbers);
    }
    return bought;
  };
  return Object.freeze({
    kind: options.kind ?? "enumerated",
    numericAdapterId: numbers.id,
    unitCost,
    totalCost,
    maxAffordable,
  });
}

function incrementCount<N>(count: N, one: N, numbers: NumericAdapter<N>): N {
  const next = numbers.add(count, one);
  if (numbers.cmp(next, count) <= 0) throw new NumericFault("count precision cannot advance");
  return next;
}

export function segmentedCurve<N>(
  numbers: NumericAdapter<N>,
  input: readonly CurveSegment<N>[],
): PurchaseCurve<N> {
  const segments = validateSegments(numbers, input);
  const unitCost = (count: N): N => {
    requireWhole(count, numbers, "count");
    const segment = segmentAt(segments, count, numbers);
    return segment.curve.unitCost(numbers.sub(count, segment.start));
  };
  const totalCost = (startCount: N, quantity: N): N => {
    requireWhole(startCount, numbers, "startCount");
    requireWhole(quantity, numbers, "quantity");
    let cursor = startCount;
    let remaining = quantity;
    let total = numbers.fromNumber(0);
    while (numbers.cmp(remaining, numbers.fromNumber(0)) > 0) {
      const index = segmentIndex(segments, cursor, numbers);
      const segment = segments[index] as CurveSegment<N>;
      const next = segments[index + 1];
      const available = next ? numbers.sub(next.start, cursor) : remaining;
      const take = minimum(remaining, available, numbers);
      total = numbers.add(total, segment.curve.totalCost(numbers.sub(cursor, segment.start), take));
      cursor = numbers.add(cursor, take);
      remaining = numbers.sub(remaining, take);
    }
    return total;
  };
  const maxAffordable = (balance: N, startCount: N, maximum?: N): N => {
    requireWhole(startCount, numbers, "startCount");
    if (maximum !== undefined) requireWhole(maximum, numbers, "maximum");
    if (numbers.cmp(balance, numbers.fromNumber(0)) < 0)
      throw new TypeError("balance cannot be negative");
    let cursor = startCount;
    let funds = balance;
    let bought = numbers.fromNumber(0);
    while (maximum === undefined || numbers.cmp(bought, maximum) < 0) {
      const index = segmentIndex(segments, cursor, numbers);
      const segment = segments[index] as CurveSegment<N>;
      const next = segments[index + 1];
      let limit = next ? numbers.sub(next.start, cursor) : undefined;
      if (maximum !== undefined) {
        const remaining = numbers.sub(maximum, bought);
        limit = limit === undefined ? remaining : minimum(limit, remaining, numbers);
      }
      const amount = segment.curve.maxAffordable(funds, numbers.sub(cursor, segment.start), limit);
      bought = numbers.add(bought, amount);
      cursor = numbers.add(cursor, amount);
      if (limit === undefined || numbers.cmp(amount, limit) < 0) return bought;
      const spent = totalCost(startCount, bought);
      funds = numbers.sub(balance, spent);
    }
    return bought;
  };
  return Object.freeze({
    kind: "segmented",
    numericAdapterId: numbers.id,
    unitCost,
    totalCost,
    maxAffordable,
  });
}

function validateSegments<N>(
  numbers: NumericAdapter<N>,
  input: readonly CurveSegment<N>[],
): readonly CurveSegment<N>[] {
  if (input.length === 0 || numbers.cmp(input[0]?.start as N, numbers.fromNumber(0)) !== 0) {
    throw new TypeError("Segmented curves must begin at count zero");
  }
  const segments = input.map((segment, index) => {
    requireWhole(segment.start, numbers, "segment start");
    if (segment.curve.numericAdapterId !== numbers.id)
      throw new TypeError("Segment uses another numeric adapter");
    if (index > 0 && numbers.cmp(segment.start, (input[index - 1] as CurveSegment<N>).start) <= 0)
      throw new TypeError("Segment starts must be strictly increasing");
    return Object.freeze({ ...segment });
  });
  return Object.freeze(segments);
}

function segmentAt<N>(
  segments: readonly CurveSegment<N>[],
  count: N,
  numbers: NumericAdapter<N>,
): CurveSegment<N> {
  return segments[segmentIndex(segments, count, numbers)] as CurveSegment<N>;
}

function segmentIndex<N>(
  segments: readonly CurveSegment<N>[],
  count: N,
  numbers: NumericAdapter<N>,
): number {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (numbers.cmp(count, (segments[index] as CurveSegment<N>).start) >= 0) return index;
  }
  throw new NumericFault("count precedes the first curve segment");
}

function minimum<N>(left: N, right: N, numbers: NumericAdapter<N>): N {
  return numbers.cmp(left, right) <= 0 ? left : right;
}

export function geometricCurve<N>(
  numbers: NumericAdapter<N>,
  options: { readonly base: N; readonly ratio: N },
): PurchaseCurve<N> {
  const zero = numbers.fromNumber(0);
  const one = numbers.fromNumber(1);
  if (numbers.cmp(options.base, zero) <= 0 || numbers.cmp(options.ratio, one) < 0) {
    throw new TypeError("Geometric base must be positive and ratio must be at least one");
  }
  const power = numbers.transcendental?.pow;
  const logarithm = numbers.transcendental?.log;
  if (!power || !logarithm)
    throw new TypeError("Geometric curves require pow and log capabilities");

  const unitCost = (count: N): N => {
    requireWhole(count, numbers, "count");
    return numbers.mul(options.base, power(options.ratio, count));
  };
  const totalCost = (startCount: N, quantity: N): N => {
    requireWhole(startCount, numbers, "startCount");
    requireWhole(quantity, numbers, "quantity");
    if (numbers.cmp(options.ratio, one) === 0) return numbers.mul(options.base, quantity);
    const first = unitCost(startCount);
    const numerator = numbers.sub(power(options.ratio, quantity), one);
    return numbers.mul(first, numbers.div(numerator, numbers.sub(options.ratio, one)));
  };
  const maxAffordable = (balance: N, startCount: N, maximum?: N): N => {
    requireWhole(startCount, numbers, "startCount");
    if (maximum !== undefined) requireWhole(maximum, numbers, "maximum");
    if (numbers.cmp(balance, zero) < 0) throw new TypeError("balance cannot be negative");
    let candidate: N;
    if (numbers.cmp(options.ratio, one) === 0) {
      candidate = numbers.floor(numbers.div(balance, options.base));
    } else {
      const scaled = numbers.div(
        numbers.mul(balance, numbers.sub(options.ratio, one)),
        unitCost(startCount),
      );
      candidate = numbers.floor(logarithm(numbers.add(one, scaled), options.ratio));
    }
    candidate = maximum === undefined || numbers.cmp(candidate, maximum) <= 0 ? candidate : maximum;
    return correctBoundary(candidate, balance, startCount, maximum, totalCost, numbers);
  };
  return Object.freeze({
    kind: "geometric",
    numericAdapterId: numbers.id,
    unitCost,
    totalCost,
    maxAffordable,
  });
}

function requireWhole<N>(value: N, numbers: NumericAdapter<N>, name: string): void {
  const zero = numbers.fromNumber(0);
  if (
    !numbers.isFinite(value) ||
    numbers.cmp(value, zero) < 0 ||
    numbers.cmp(numbers.floor(value), value) !== 0
  ) {
    throw new TypeError(`${name} must be a nonnegative integer quantity`);
  }
}

function correctBoundary<N>(
  initial: N,
  balance: N,
  start: N,
  maximum: N | undefined,
  totalCost: (start: N, quantity: N) => N,
  numbers: NumericAdapter<N>,
): N {
  const one = numbers.fromNumber(1);
  const zero = numbers.fromNumber(0);
  let candidate = numbers.cmp(initial, zero) < 0 ? zero : initial;
  for (let attempts = 0; attempts < 8; attempts += 1) {
    if (numbers.cmp(totalCost(start, candidate), balance) > 0) {
      const previous = numbers.sub(candidate, one);
      if (numbers.cmp(previous, candidate) === 0)
        throw new NumericFault("count precision cannot resolve max-buy");
      candidate = numbers.cmp(previous, zero) < 0 ? zero : previous;
      continue;
    }
    const next = numbers.add(candidate, one);
    if (maximum !== undefined && numbers.cmp(next, maximum) > 0) return candidate;
    if (numbers.cmp(next, candidate) === 0) {
      throw new NumericFault("count precision cannot resolve max-buy");
    }
    if (numbers.cmp(totalCost(start, next), balance) <= 0) {
      candidate = next;
      continue;
    }
    return candidate;
  }
  throw new NumericFault("max-buy boundary correction did not converge");
}
