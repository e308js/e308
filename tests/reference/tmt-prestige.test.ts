import { describe, expect, it } from "vitest";
import {
  createGameKit,
  nativeNumbers,
  normalPrestige,
  staticPrestige,
} from "../../packages/core/src/index.js";
import {
  type TmtPrestigeInput,
  tmtNormalGain,
  tmtStaticGain,
  tmtStaticNextAt,
} from "../../reference/tmt/prestige.js";

function fixture(baseAmount: number, points: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const scope = kit.scope("layer");
  const base = kit.resource("base", { scope, initial: baseAmount });
  const reward = kit.resource("reward", { scope, initial: points });
  return {
    base,
    reward,
    state: {
      get: (resource: typeof base | typeof reward) => resource.initial,
      getAllocation: () => 0,
      purchaseCount: () => 0,
    },
  };
}

describe("pinned TMT prestige differentials", () => {
  it("T04 matches normal gain including gain exponent, direct gain, and softcap", () => {
    const source: TmtPrestigeInput & { softcap: number; softcapPower: number } = {
      baseAmount: 6_400,
      points: 0,
      requires: 100,
      exponent: 0.5,
      gainMult: 2,
      gainExp: 2,
      directMult: 2,
      softcap: 64,
      softcapPower: 0.5,
    };
    const { base, state } = fixture(source.baseAmount, source.points);
    const policy = normalPrestige(nativeNumbers, {
      baseResource: base,
      requirement: source.requires,
      exponent: source.exponent,
      gainMultiplier: source.gainMult,
      gainExponent: source.gainExp,
      directMultiplier: source.directMult,
      softcap: { threshold: source.softcap, power: source.softcapPower },
    });
    expect(policy.rewardFor(state)).toBe(tmtNormalGain(source));
    expect(tmtNormalGain({ ...source, baseAmount: 99 })).toBe(0);
    expect(tmtNormalGain({ ...source, gainExp: 0 })).toBe(0);
  });

  it("T05 matches static one/max gain and rounded next-cost eligibility", () => {
    const source: TmtPrestigeInput & { base: number; canBuyMax: boolean } = {
      baseAmount: 70,
      points: 1,
      requires: 10,
      exponent: 1,
      gainMult: 1,
      gainExp: 1,
      directMult: 1,
      base: 2,
      canBuyMax: true,
    };
    const { base, reward, state } = fixture(source.baseAmount, source.points);
    const policy = staticPrestige(nativeNumbers, {
      baseResource: base,
      rewardResource: reward,
      requirement: source.requires,
      exponent: source.exponent,
      gainMultiplier: source.gainMult,
      gainExponent: source.gainExp,
      directMultiplier: source.directMult,
      base: source.base,
      canBuyMax: true,
      roundUpCost: true,
    });
    expect(policy.rewardFor(state)).toBe(tmtStaticGain(source));
    expect(policy.canReset(state)).toBe(
      source.baseAmount >= tmtStaticNextAt({ ...source, roundUpCost: true }),
    );
    expect(tmtStaticGain({ ...source, canBuyMax: false })).toBe(1);
    expect(tmtStaticGain({ ...source, baseAmount: 9 })).toBe(1);
    expect(tmtStaticNextAt({ ...source, roundUpCost: false })).toBe(20);
  });
});
