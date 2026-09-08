import { describe, expect, it } from "vitest";
import { createAdSubject, subjectState } from "../../reference/ad/subject.js";
import { adPurchaseCurve } from "../../reference/ad/subject-production.js";
import {
  adState,
  dimensionBoostRequirement,
  dimensionCost,
  galaxyRequirement,
  upstreamBuyMax,
  upstreamBuyOne,
  upstreamBuyUntilTen,
  upstreamTick,
} from "../../reference/ad/upstream.js";

function expectStateClose(
  actual: ReturnType<typeof subjectState>,
  expected: ReturnType<typeof adState>,
) {
  expect(actual.antimatter).toBeCloseTo(expected.antimatter, 10);
  actual.dimensions.forEach((value, index) => {
    expect(value).toBeCloseTo(expected.dimensions[index] ?? 0, 10);
  });
  expect(actual.bought).toEqual(expected.bought);
  expect(actual.boosts).toBe(expected.boosts);
  expect(actual.galaxies).toBe(expected.galaxies);
  expect(actual.challengePower).toBeCloseTo(expected.challengePower, 12);
}

describe("Antimatter Dimensions AD01-AD03", () => {
  it("AD01 matches the eight-tier descending tick and a purchase midway", () => {
    const initial = {
      antimatter: 1_000,
      dimensions: [8, 7, 6, 5, 4, 3, 2, 1],
      multipliers: [1, 2, 3, 4, 5, 6, 7, 8],
      tickspeedPerSecond: 2,
    };
    const upstream = adState(initial);
    const subject = createAdSubject(initial);
    for (const elapsed of [100, 100, 100]) {
      upstreamTick(upstream, elapsed);
      subject.game.advance(elapsed);
      expectStateClose(subjectState(subject), upstream);
    }
    expect(upstreamBuyOne(upstream, 1)).toBe(true);
    expect(subject.game.dispatch(subject.buyOne(1)).ok).toBe(true);
    for (const elapsed of [100, 100]) {
      upstreamTick(upstream, elapsed);
      subject.game.advance(elapsed);
      expectStateClose(subjectState(subject), upstream);
    }
  });

  it("AD02 matches single, until-ten, max, grouped prices, and buy-ten power", () => {
    const single = adState({ antimatter: 10 });
    const singleSubject = createAdSubject({ antimatter: 10 });
    expect(upstreamBuyOne(single, 1)).toBe(true);
    expect(singleSubject.game.dispatch(singleSubject.buyOne(1)).ok).toBe(true);
    expectStateClose(subjectState(singleSubject), single);
    const ten = createAdSubject({ antimatter: 100 });
    expect(ten.game.dispatch(ten.buyUntilTen(1)).ok).toBe(true);
    expect(subjectState(ten).bought[0]).toBe(10);

    const bulk = adState({ antimatter: 100_100, dimensions: [1, 0, 0, 0, 0, 0, 0, 0] });
    const bulkSubject = createAdSubject(bulk);
    expect(upstreamBuyMax(bulk, 1)).toBe(2);
    expect(bulkSubject.game.dispatch(bulkSubject.buyMax(1)).ok).toBe(true);
    expectStateClose(subjectState(bulkSubject), bulk);
    expect(dimensionCost(bulk, 1)).toBe(10_000_000);

    const powered = adState({
      antimatter: 10,
      dimensions: [9, 0, 0, 0, 0, 0, 0, 0],
      bought: [9, 0, 0, 0, 0, 0, 0, 0],
    });
    const poweredSubject = createAdSubject(powered);
    upstreamBuyOne(powered, 1);
    poweredSubject.game.dispatch(poweredSubject.buyOne(1));
    upstreamTick(powered, 100);
    poweredSubject.game.advance(100);
    expectStateClose(subjectState(poweredSubject), powered);

    const locked = createAdSubject({ antimatter: 1e30 });
    expect(locked.game.dispatch(locked.buyOne(2))).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(locked.game.dispatch(locked.buyOne(5))).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(upstreamBuyUntilTen(adState({ antimatter: 99 }), 1)).toBe(false);
    expect(upstreamBuyOne(adState({ antimatter: 1e30 }), 0)).toBe(false);
    expect(upstreamBuyOne(adState({ antimatter: 1e30 }), 9)).toBe(false);
    expect(
      upstreamBuyOne(
        adState({
          antimatter: 1e30,
          boosts: 4,
          challenge: 10,
          dimensions: Array(8).fill(1),
        }),
        7,
      ),
    ).toBe(false);
    const curve = adPurchaseCurve(10, 1_000);
    expect(curve.maxAffordable(100_099, 0)).toBe(19);
    expect(curve.maxAffordable(1e20, 0, 3)).toBe(3);
  });

  it("AD03 matches early boost/galaxy requirements and reset state", () => {
    expect(dimensionBoostRequirement(0)).toEqual({ tier: 4, amount: 20 });
    expect(dimensionBoostRequirement(5)).toEqual({ tier: 8, amount: 35 });
    expect(dimensionBoostRequirement(6)).toEqual({ tier: 8, amount: 50 });
    expect(dimensionBoostRequirement(3, true)).toEqual({ tier: 6, amount: 40 });
    expect(galaxyRequirement(2)).toEqual({ tier: 8, amount: 200 });

    const boost = createAdSubject({ antimatter: 1e12, dimensions: [5, 4, 3, 20, 0, 0, 0, 0] });
    expect(boost.game.dispatch(boost.dimensionBoost()).ok).toBe(true);
    expect(subjectState(boost)).toMatchObject({
      antimatter: 10,
      boosts: 1,
      dimensions: Array(8).fill(0),
    });
    expect(boost.game.dispatch(boost.dimensionBoost())).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(boost.game.dispatch(boost.galaxy())).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(boost.game.dispatch(boost.infinity())).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(boost.game.dispatch(boost.buyOne(0))).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(boost.game.dispatch(boost.buyMax(9))).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });

    const galaxy = createAdSubject({
      antimatter: 1e30,
      boosts: 5,
      dimensions: [1, 1, 1, 1, 1, 1, 1, 80],
    });
    expect(galaxy.game.dispatch(galaxy.galaxy()).ok).toBe(true);
    expect(subjectState(galaxy)).toMatchObject({
      antimatter: 10,
      boosts: 0,
      galaxies: 1,
      dimensions: Array(8).fill(0),
    });
  });
});
