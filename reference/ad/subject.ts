import {
  automationCommand,
  type ChallengeDefinition,
  type Command,
  completeChallengeCommand,
  createGame,
  enterChallengeCommand,
  type Game,
  type Resource,
  upgradeCommand,
} from "../../packages/core/src/index.js";
import {
  dimensionBoostCommand,
  galaxyCommand,
  infinityCommand,
  maxPurchaseCommand,
  purchaseCommand,
} from "./subject-actions.js";
import { type AdModel, createAdModel } from "./subject-model.js";
import { type AdState, adState } from "./upstream.js";

export interface AdSubject {
  readonly game: Game<number>;
  readonly model: AdModel;
  buyOne(tier: number): Command<number>;
  buyUntilTen(tier: number): Command<number>;
  buyMax(tier: number): Command<number>;
  dimensionBoost(): Command<number>;
  galaxy(): Command<number>;
  infinity(): Command<number>;
  completeChallenge(): Command<number>;
  buyTimeMult(): Command<number>;
  buyDim18Mult(): Command<number>;
  enableDimensionAutobuyer(enabled: boolean): Command<number>;
  enableDimBoostAutobuyer(enabled: boolean): Command<number>;
}

export function createAdSubject(initial: Partial<AdState> = {}): AdSubject {
  const seed = adState(initial);
  const model = createAdModel(initial);
  const game = createGame(model.definition);
  const activeChallenge = challengeFor(seed.challenge, model);
  if (activeChallenge) game.dispatch(enterChallengeCommand(activeChallenge, model.challenges));
  game.dispatch(seedCommand(seed, model));
  return {
    game,
    model,
    buyOne: (tier) => purchaseCommand(tier, false, model),
    buyUntilTen: (tier) => purchaseCommand(tier, true, model),
    buyMax: (tier) => maxPurchaseCommand(tier, model),
    dimensionBoost: () =>
      dimensionBoostCommand(model.dimensions, model.boosts, model.run, model.challenge10),
    galaxy: () =>
      galaxyCommand(model.dimensions, model.antimatter, model.boosts, model.galaxies, model.run),
    infinity: () =>
      infinityCommand(model.antimatter, model.infinityPoints, model.infinities, model.run),
    completeChallenge: () => completeChallengeCommand(requiredChallenge(activeChallenge)),
    buyTimeMult: () => upgradeCommand(model.timeMult),
    buyDim18Mult: () => upgradeCommand(model.dim18),
    enableDimensionAutobuyer: (enabled) => automationCommand(model.dimensionAuto, enabled),
    enableDimBoostAutobuyer: (enabled) => automationCommand(model.boostAuto, enabled),
  };
}

function seedCommand(seed: AdState, model: AdModel): Command<number> {
  return {
    id: "reference-seed",
    execute: (transaction) => {
      transaction.set(model.antimatter, seed.antimatter);
      transaction.set(model.boosts, seed.boosts);
      transaction.set(model.galaxies, seed.galaxies);
      transaction.set(model.challengePower, seed.challengePower);
      transaction.set(model.totalTimePlayed, seed.totalTimePlayedMs);
      model.dimensions.forEach((resource, index) => {
        transaction.set(resource, seed.dimensions[index] ?? 0);
      });
      model.buyables.forEach((buyable, index) => {
        transaction.setPurchase(buyable.id, seed.bought[index] ?? 0);
      });
    },
  };
}

function challengeFor(
  challenge: AdState["challenge"],
  model: AdModel,
): ChallengeDefinition<number> | undefined {
  return challenge === 2
    ? model.challenges[0]
    : challenge === 3
      ? model.challenges[1]
      : challenge === 10
        ? model.challenges[2]
        : undefined;
}

function requiredChallenge(
  challenge: ChallengeDefinition<number> | undefined,
): ChallengeDefinition<number> {
  if (!challenge) throw new TypeError("The reference subject has no active challenge");
  return challenge;
}

export function subjectState(subject: AdSubject): AdState {
  const snapshot = subject.game.getSnapshot();
  const { model } = subject;
  const active = snapshot.progression.activeChallenges[0];
  return {
    antimatter: snapshot.resources[model.antimatter.id] as number,
    dimensions: model.dimensions.map((resource) => snapshot.resources[resource.id] as number),
    bought: model.buyables.map((buyable) => snapshot.purchaseCounts[buyable.id] as number),
    multipliers: model.dimensions.map(() => 1),
    tickspeedPerSecond: 1,
    boosts: snapshot.resources[model.boosts.id] as number,
    galaxies: snapshot.resources[model.galaxies.id] as number,
    challenge: active === "nc2" ? 2 : active === "nc3" ? 3 : active === "nc10" ? 10 : 0,
    challengePower: snapshot.resources[model.challengePower.id] as number,
    totalTimePlayedMs: snapshot.resources[model.totalTimePlayed.id] as number,
  };
}

export function resourceValue(subject: AdSubject, resource: Resource<number>): number {
  return subject.game.getSnapshot().resources[resource.id] as number;
}
