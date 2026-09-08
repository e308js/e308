// Source-faithful bounded numeric port of MIT-licensed TMT getResetGain/getNextAt.
// Upstream: Acamaeda/The-Modding-Tree@4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621.

export interface TmtPrestigeInput {
  readonly baseAmount: number;
  readonly points: number;
  readonly requires: number;
  readonly exponent: number;
  readonly gainMult: number;
  readonly gainExp: number;
  readonly directMult: number;
}

export function tmtNormalGain(
  input: TmtPrestigeInput & { readonly softcap: number; readonly softcapPower: number },
): number {
  if (input.baseAmount < input.requires || input.gainExp === 0) return 0;
  let gain =
    ((input.baseAmount / input.requires) ** input.exponent * input.gainMult) ** input.gainExp;
  if (gain >= input.softcap) {
    gain = gain ** input.softcapPower * input.softcap ** (1 - input.softcapPower);
  }
  return Math.max(Math.floor(gain * input.directMult), 0);
}

export function tmtStaticGain(
  input: TmtPrestigeInput & { readonly base: number; readonly canBuyMax: boolean },
): number {
  if (!input.canBuyMax || input.baseAmount < input.requires) return 1;
  const raw = Math.max(
    Math.log(input.baseAmount / input.requires / input.gainMult) / Math.log(input.base),
    0,
  );
  const target = (raw * input.gainExp) ** (1 / input.exponent) * input.directMult;
  return Math.max(Math.floor(target) - input.points + 1, 1);
}

export function tmtStaticNextAt(
  input: TmtPrestigeInput & { readonly base: number; readonly roundUpCost: boolean },
): number {
  const amount = input.points / input.directMult;
  const extra = input.base ** (amount ** input.exponent / input.gainExp) * input.gainMult;
  const cost = Math.max(extra * input.requires, input.requires);
  return input.roundUpCost ? Math.ceil(cost) : cost;
}
