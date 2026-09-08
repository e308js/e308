import type { AutomationState, ProgressionSnapshot } from "./types.js";

export interface MutableProgression<N> {
  upgrades: Record<string, true>;
  milestones: Record<string, true>;
  achievements: Record<string, true>;
  activeChallenges: Set<string>;
  challengeCompletions: Record<string, N>;
  rewardLedger: Set<string>;
  automation: Record<string, AutomationState>;
  won: boolean;
}

export function initialProgression<N>(): MutableProgression<N> {
  return {
    upgrades: {},
    milestones: {},
    achievements: {},
    activeChallenges: new Set(),
    challengeCompletions: {},
    rewardLedger: new Set(),
    automation: {},
    won: false,
  };
}

export function cloneProgression<N>(source: ProgressionSnapshot<N>): MutableProgression<N> {
  return {
    upgrades: { ...source.upgrades },
    milestones: { ...source.milestones },
    achievements: { ...source.achievements },
    activeChallenges: new Set(source.activeChallenges),
    challengeCompletions: { ...source.challengeCompletions },
    rewardLedger: new Set(source.rewardLedger),
    automation: Object.fromEntries(
      Object.entries(source.automation).map(([id, state]) => [id, { ...state }]),
    ),
    won: source.won,
  };
}

export function freezeProgression<N>(source: MutableProgression<N>): ProgressionSnapshot<N> {
  return Object.freeze({
    upgrades: Object.freeze(source.upgrades),
    milestones: Object.freeze(source.milestones),
    achievements: Object.freeze(source.achievements),
    activeChallenges: Object.freeze([...source.activeChallenges].sort()),
    challengeCompletions: Object.freeze(source.challengeCompletions),
    rewardLedger: Object.freeze([...source.rewardLedger].sort()),
    automation: Object.freeze(
      Object.fromEntries(
        Object.entries(source.automation).map(([id, state]) => [id, Object.freeze(state)]),
      ),
    ),
    won: source.won,
  });
}
