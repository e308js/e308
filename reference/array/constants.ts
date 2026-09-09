export const GENERATOR_COST_BASES = {
  A: [10, 100, 1_000, 100_000, 10_000_000],
  B: [10, 100, 1_000, 10_000, 100_000],
} as const;

export const GENERATOR_COST_RATIOS = [1.2, 1.3, 1.4, 1.5, 1.6] as const;
export const A_UPGRADE_COST_BASES = [1_000_000, 100_000_000, "1e80"] as const;
export const A_UPGRADE_COST_RATIOS = [10, 100, "1e10"] as const;

export const B_UPGRADE_SPECS = [
  { id: "a-upgrade-max", cost: 0, requires: 20 },
  { id: "stronger-a-count", cost: 50 },
  { id: "passive-b", cost: 200 },
  { id: "b1-boosters", cost: 2_000 },
  { id: "triple-b-upgrade", cost: 15_000 },
  { id: "b-count-boosts-a", cost: 500_000 },
  { id: "stronger-boosterators", cost: 5_000_000 },
  { id: "hundredfold-b", cost: 100_000_000 },
] as const;
