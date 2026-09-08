import { describe, expect, it } from "vitest";
import {
  createGameKit,
  type NumericAdapter,
  nativeNumbers,
  normalPrestige,
  staticPrestige,
} from "../../packages/core/src/index.js";

function context(value: number, reward = 0) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: value });
  const stars = kit.resource("stars", { scope: run, initial: reward });
  const state = {
    get: (resource: typeof points | typeof stars) => resource.initial,
    getAllocation: () => 0,
  };
  return { kit, points, stars, state };
}

describe("prestige formulas", () => {
  it("computes normal prestige from an independent threshold formula", () => {
    const { points, state } = context(6_400);
    const policy = normalPrestige(nativeNumbers, {
      baseResource: points,
      requirement: 100,
      exponent: 0.5,
      gainMultiplier: 2,
      gainExponent: 2,
      directMultiplier: 2,
      softcap: { threshold: 64, power: 0.5 },
    });
    expect(policy.canReset(state)).toBe(true);
    expect(policy.rewardFor(state)).toBe(256);
    expect(
      policy.rewardFor({
        get: () => 99,
        getAllocation: () => 0,
      }),
    ).toBe(0);
    expect(
      policy.canReset({
        get: () => 99,
        getAllocation: () => 0,
      }),
    ).toBe(false);
  });

  it("supports one and max static prestige against current reward count", () => {
    const { points, stars, state } = context(70, 1);
    const one = staticPrestige(nativeNumbers, {
      baseResource: points,
      rewardResource: stars,
      requirement: 10,
      base: 2,
      exponent: 1,
    });
    const max = staticPrestige(nativeNumbers, {
      baseResource: points,
      rewardResource: stars,
      requirement: 10,
      base: 2,
      exponent: 1,
      canBuyMax: true,
    });
    expect(one.rewardFor(state)).toBe(1);
    expect(max.rewardFor(state)).toBe(2);
    expect(
      one.canReset({
        get: (resource) => (resource.id === points.id ? 19 : 1),
        getAllocation: () => 0,
      }),
    ).toBe(false);
  });

  it("rejects invalid parameters and unsupported numeric capabilities", () => {
    const { points, stars } = context(10);
    expect(() =>
      normalPrestige(nativeNumbers, { baseResource: points, requirement: 0, exponent: 1 }),
    ).toThrow("positive");
    const limited: NumericAdapter<number> = { ...nativeNumbers };
    delete (limited as { transcendental?: unknown }).transcendental;
    expect(() =>
      normalPrestige(limited, { baseResource: points, requirement: 1, exponent: 1 }),
    ).toThrow("unsupported");
    expect(() =>
      normalPrestige(nativeNumbers, {
        baseResource: points,
        requirement: 1,
        exponent: 1,
        softcap: { threshold: 0, power: 0.5 },
      }),
    ).toThrow("softcap");
    expect(() =>
      staticPrestige(nativeNumbers, {
        baseResource: points,
        rewardResource: stars,
        requirement: 10,
        base: 1,
        exponent: 1,
      }),
    ).toThrow("greater than one");
  });
});
