import { describe, expect, it } from "vitest";
import {
  eternityNumbers,
  geometricCurve,
  type NumericAdapter,
  NumericFault,
  nativeNumbers,
  segmentedCurve,
} from "../../packages/core/src/index.js";

describe("geometric curves", () => {
  it("calculates unit, cumulative, capped, and maximum costs", () => {
    const curve = geometricCurve(nativeNumbers, { base: 10, ratio: 2 });
    expect(curve.unitCost(3)).toBe(80);
    expect(curve.totalCost(0, 3)).toBe(70);
    expect(curve.totalCost(2, 2)).toBe(120);
    expect(curve.maxAffordable(69, 0)).toBe(2);
    expect(curve.maxAffordable(70, 0)).toBe(3);
    expect(curve.maxAffordable(1000, 0, 2)).toBe(2);
  });

  it("handles a constant ratio", () => {
    const curve = geometricCurve(nativeNumbers, { base: 7, ratio: 1 });
    expect(curve.totalCost(100, 3)).toBe(21);
    expect(curve.maxAffordable(20, 100)).toBe(2);
  });

  it("uses the large-number backend without native conversion", () => {
    const curve = geometricCurve(eternityNumbers, {
      base: eternityNumbers.fromString("1e500"),
      ratio: eternityNumbers.fromString("10"),
    });
    const count = curve.maxAffordable(
      eternityNumbers.fromString("2e505"),
      eternityNumbers.fromString("0"),
    );
    expect(eternityNumbers.codec.serialize(count)).toBe("6");
    expect(eternityNumbers.codec.serialize(curve.unitCost(eternityNumbers.fromString("6")))).toBe(
      "1e506",
    );
  });

  it("validates curve and count domains", () => {
    expect(() => geometricCurve(nativeNumbers, { base: 0, ratio: 2 })).toThrow(TypeError);
    expect(() => geometricCurve(nativeNumbers, { base: 1, ratio: 0.9 })).toThrow(TypeError);
    const curve = geometricCurve(nativeNumbers, { base: 1, ratio: 2 });
    expect(() => curve.unitCost(-1)).toThrow(TypeError);
    expect(() => curve.totalCost(0, 1.5)).toThrow(TypeError);
    expect(() => curve.maxAffordable(-1, 0)).toThrow(TypeError);
  });

  it("rejects adapters without transcendental capabilities", () => {
    const limited: NumericAdapter<number> = { ...nativeNumbers };
    delete (limited as { transcendental?: unknown }).transcendental;
    expect(() => geometricCurve(limited, { base: 1, ratio: 2 })).toThrow("require pow and log");
  });

  it("detects a backend that cannot distinguish adjacent counts", () => {
    const stuck: NumericAdapter<number> = {
      ...nativeNumbers,
      add: (left, right) => (right === 1 ? left : nativeNumbers.add(left, right)),
    };
    const curve = geometricCurve(stuck, { base: 1, ratio: 2 });
    expect(() => curve.maxAffordable(2, 0)).toThrow(NumericFault);
  });
});

describe("segmented curves", () => {
  it("quotes across milestones and max-buys at either side of a threshold", () => {
    const curve = segmentedCurve(nativeNumbers, [
      { start: 0, curve: geometricCurve(nativeNumbers, { base: 10, ratio: 2 }) },
      { start: 3, curve: geometricCurve(nativeNumbers, { base: 100, ratio: 3 }) },
    ]);
    expect([0, 1, 2, 3, 4].map(curve.unitCost)).toEqual([10, 20, 40, 100, 300]);
    expect(curve.totalCost(1, 4)).toBe(460);
    expect(curve.maxAffordable(169, 0)).toBe(3);
    expect(curve.maxAffordable(170, 0)).toBe(4);
    expect(curve.maxAffordable(1000, 2, 2)).toBe(2);
  });

  it("validates segment boundaries and numeric backends", () => {
    const base = geometricCurve(nativeNumbers, { base: 1, ratio: 2 });
    const huge = geometricCurve(eternityNumbers, {
      base: eternityNumbers.fromNumber(1),
      ratio: eternityNumbers.fromNumber(2),
    });
    expect(() => segmentedCurve(nativeNumbers, [])).toThrow("begin at count zero");
    expect(() => segmentedCurve(nativeNumbers, [{ start: 1, curve: base }])).toThrow(
      "begin at count zero",
    );
    expect(() =>
      segmentedCurve(nativeNumbers, [
        { start: 0, curve: base },
        { start: 0, curve: base },
      ]),
    ).toThrow("strictly increasing");
    expect(() => segmentedCurve(nativeNumbers, [{ start: 0, curve: huge as never }])).toThrow(
      "another numeric adapter",
    );
  });
});
