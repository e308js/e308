// Source-faithful bounded port of MIT-licensed Antimatter Dimensions routines.
// Upstream: IvarK/AntimatterDimensionsSourceCode@5409e320cecef96a917cca1dfb68f1f183e499ca.

export const AD_BASE_COSTS = [10, 100, 1e4, 1e6, 1e9, 1e13, 1e18, 1e24] as const;
export const AD_COST_MULTIPLIERS = [1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e12, 1e15] as const;

export interface AdState {
  antimatter: number;
  dimensions: number[];
  bought: number[];
  multipliers: number[];
  tickspeedPerSecond: number;
  boosts: number;
  galaxies: number;
  challenge: 0 | 2 | 3 | 10;
  challengePower: number;
  totalTimePlayedMs: number;
}

export function adState(input: Partial<AdState> = {}): AdState {
  return {
    antimatter: input.antimatter ?? 10,
    dimensions: [...(input.dimensions ?? Array.from({ length: 8 }, () => 0))],
    bought: [...(input.bought ?? Array.from({ length: 8 }, () => 0))],
    multipliers: [...(input.multipliers ?? Array.from({ length: 8 }, () => 1))],
    tickspeedPerSecond: input.tickspeedPerSecond ?? 1,
    boosts: input.boosts ?? 0,
    galaxies: input.galaxies ?? 0,
    challenge: input.challenge ?? 0,
    challengePower: input.challengePower ?? 1,
    totalTimePlayedMs: input.totalTimePlayedMs ?? 0,
  };
}

export function upstreamTick(state: AdState, diffMs: number): void {
  state.totalTimePlayedMs += diffMs;
  updateChallengePower(state, diffMs);
  for (let tier = 6; tier >= 0; tier -= 1) {
    state.dimensions[tier] =
      (state.dimensions[tier] ?? 0) + production(state, tier + 1) * (diffMs / 10_000);
  }
  state.antimatter += production(state, 0) * (diffMs / 1000);
}

export function upstreamBuyOne(state: AdState, tier: number): boolean {
  const index = tier - 1;
  const cost = dimensionCost(state, tier);
  if (!available(state, tier) || state.antimatter < cost) return false;
  state.antimatter -= cost;
  state.dimensions[index] = (state.dimensions[index] ?? 0) + 1;
  state.bought[index] = (state.bought[index] ?? 0) + 1;
  if (state.challenge === 2) state.challengePower = 0;
  return true;
}

export function upstreamBuyUntilTen(state: AdState, tier: number): boolean {
  const index = tier - 1;
  const remaining = 10 - ((state.bought[index] ?? 0) % 10);
  const cost = dimensionCost(state, tier) * remaining;
  if (!available(state, tier) || state.antimatter < cost) return false;
  state.antimatter -= cost;
  state.dimensions[index] = (state.dimensions[index] ?? 0) + remaining;
  state.bought[index] = (state.bought[index] ?? 0) + remaining;
  if (state.challenge === 2) state.challengePower = 0;
  return true;
}

export function upstreamBuyMax(
  state: AdState,
  tier: number,
  bulk = Number.MAX_SAFE_INTEGER,
): number {
  let groups = 0;
  while (groups < bulk && upstreamBuyUntilTen(state, tier)) groups += 1;
  return groups;
}

export function dimensionCost(state: AdState, tier: number): number {
  const index = tier - 1;
  return (
    (AD_BASE_COSTS[index] ?? Number.POSITIVE_INFINITY) *
    (AD_COST_MULTIPLIERS[index] ?? Number.POSITIVE_INFINITY) **
      Math.floor((state.bought[index] ?? 0) / 10)
  );
}

export function dimensionBoostRequirement(
  boosts: number,
  challenge10 = false,
): { tier: number; amount: number } {
  const target = boosts + 1;
  const tier = Math.min(target + 3, challenge10 ? 6 : 8);
  const amount = challenge10
    ? 20 + (tier === 6 ? Math.round((target - 3) * 20) : 0)
    : 20 + (tier === 8 ? Math.round((target - 5) * 15) : 0);
  return { tier, amount };
}

export function galaxyRequirement(galaxies: number): { tier: number; amount: number } {
  return { tier: 8, amount: Math.floor(80 + galaxies * 60) };
}

function production(state: AdState, index: number): number {
  if (state.challenge === 10 && index >= 6) return 0;
  let value =
    (state.dimensions[index] ?? 0) *
    (state.multipliers[index] ?? 1) *
    2 ** Math.floor((state.bought[index] ?? 0) / 10) *
    2 ** Math.max(state.boosts - index, 0) *
    state.tickspeedPerSecond;
  if (state.challenge === 2) value *= state.challengePower;
  if (state.challenge === 3 && index === 0) value *= state.challengePower;
  return value;
}

function available(state: AdState, tier: number): boolean {
  return (
    tier >= 1 &&
    tier <= 8 &&
    tier <= state.boosts + 4 &&
    (tier === 1 || (state.dimensions[tier - 2] ?? 0) > 0) &&
    !(state.challenge === 10 && tier > 6)
  );
}

function updateChallengePower(state: AdState, diffMs: number): void {
  if (state.challenge === 2)
    state.challengePower = Math.min(state.challengePower + diffMs / 100 / 1800, 1);
  if (state.challenge === 3)
    state.challengePower = Math.min(
      state.challengePower * 1.00038 ** (diffMs / 100),
      Number.MAX_VALUE,
    );
}
