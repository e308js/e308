import {
  allocationCommand,
  createGame,
  type Game,
  type ResolvedEntitlement,
  recipeCommand,
  resolveEntitlement,
  type Transaction,
} from "../../packages/core/src/index.js";
import { createKittensModel, type KittensModel } from "./subject-model.js";
import type { KittensState } from "./upstream.js";
import { redshiftDays } from "./upstream.js";

export interface KittensSubject {
  readonly model: KittensModel;
  readonly game: Game<number>;
}

export function createKittensSubject(initial: Partial<KittensState> = {}): KittensSubject {
  const model = createKittensModel();
  const game = createGame(model.definition);
  game.dispatch({
    id: "reference-seed",
    execute: (transaction) => seed(transaction, model, initial),
  });
  return { model, game };
}

export function assignWorkers(
  subject: KittensSubject,
  assignments: Partial<KittensState["workers"]>,
): void {
  for (const [job, count] of Object.entries(assignments))
    subject.game.dispatch(allocationCommand(subject.model.workers, job, count));
}

export function build(subject: KittensSubject, kind: "barn" | "hut"): boolean {
  const { resources } = subject.model;
  return subject.game.dispatch({
    id: `build:${kind}`,
    execute: (transaction) => {
      const building = kind === "barn" ? resources.barns : resources.huts;
      const base = kind === "barn" ? 50 : 5;
      const ratio = kind === "barn" ? 1.75 : 2.5;
      const cost = base * ratio ** transaction.get(building);
      const available = transaction.get(resources.wood);
      if (available < cost)
        transaction.reject({
          code: "insufficient",
          resourceId: resources.wood.id,
          required: cost,
          available,
        });
      transaction.add(resources.wood, -cost);
      transaction.add(building, 1);
    },
  }).ok;
}

export function craft(subject: KittensSubject, kind: "wood" | "beam"): boolean {
  const recipe =
    kind === "wood" ? subject.model.recipes.refineWood : subject.model.recipes.craftBeam;
  return subject.game.dispatch(recipeCommand(recipe, { mode: "exact", count: 1 })).ok;
}

export function kittensEntitlement(subject: KittensSubject): ResolvedEntitlement {
  const { year, resources } = subject.model;
  return resolveEntitlement(
    {
      policyVersion: "kittens-redshift-v1",
      enabled: true,
      cap: {
        kind: "dynamic",
        resolve: (snapshot) => {
          const progressed =
            (snapshot.calendars[year.id]?.cycle ?? 0n) >= 1_000n ||
            (snapshot.resources[resources.paragon.id] as number) > 0;
          return (progressed ? 40 : 10) * 4 * 100 * 2_000;
        },
      },
      excess: "discard",
    },
    subject.game.getSnapshot(),
  );
}

export function applyKittensRedshift(
  subject: KittensSubject,
): (transaction: Transaction<number>, advancedGameMs: number) => void {
  return (transaction, advancedGameMs) => {
    const model = subject.model;
    const progressed =
      transaction.getCalendarState(model.year).cycle >= 1_000n ||
      transaction.get(model.resources.paragon) > 0;
    const days = redshiftDays(advancedGameMs, progressed);
    if (days === 0) return;
    const state = transaction.getCalendarState(model.year);
    const seasonRatio = [1.5, 1, 1, 0.25][state.phaseIndex] as number;
    const workers = (job: string) => transaction.getAllocation(model.workers.id, job);
    const rates = {
      catnip: workers("farmer") * seasonRatio - transaction.get(model.resources.kittens) * 0.85,
      wood: workers("woodcutter") * 0.018,
      minerals: workers("miner") * 0.05,
      science: workers("scholar") * 0.035,
    };
    for (const id of ["catnip", "wood", "minerals", "science"] as const)
      if (rates[id] > 0) transaction.add(model.resources[id], rates[id] * days * 10);
    advanceCalendar(transaction, model, days * 2_000, advancedGameMs);
  };
}

export function subjectState(subject: KittensSubject): KittensState {
  const snapshot = subject.game.getSnapshot();
  const { model } = subject;
  const resource = (id: keyof KittensModel["resources"]) =>
    snapshot.resources[model.resources[id].id] as number;
  const calendar = snapshot.calendars[model.year.id] as NonNullable<
    (typeof snapshot.calendars)[string]
  >;
  const worker = (id: string) => snapshot.allocations[model.workers.id]?.[id] as number;
  return {
    resources: {
      catnip: resource("catnip"),
      wood: resource("wood"),
      minerals: resource("minerals"),
      science: resource("science"),
      beam: resource("beam"),
    },
    kittens: resource("kittens"),
    workers: {
      farmer: worker("farmer"),
      woodcutter: worker("woodcutter"),
      miner: worker("miner"),
      scholar: worker("scholar"),
    },
    season: calendar.phaseIndex,
    seasonTicks: calendar.elapsedMs / 200,
    year: Number(calendar.cycle),
    barns: resource("barns"),
    huts: resource("huts"),
    researchedConstruction: Boolean(snapshot.progression.upgrades[model.construction.id]),
    paragon: resource("paragon"),
  };
}

function seed(
  transaction: Transaction<number>,
  model: KittensModel,
  initial: Partial<KittensState>,
): void {
  for (const id of ["kittens", "barns", "huts", "paragon"] as const)
    transaction.set(model.resources[id], initial[id] ?? 0);
  const resources = { catnip: 0, wood: 0, minerals: 0, science: 0, beam: 0, ...initial.resources };
  for (const [id, value] of Object.entries(resources))
    transaction.set(model.resources[id as keyof typeof resources], value);
  const workers = { farmer: 0, woodcutter: 0, miner: 0, scholar: 0, ...initial.workers };
  for (const [id, value] of Object.entries(workers))
    transaction.setAllocation(model.workers.id, id, value);
  if (initial.researchedConstruction) transaction.setProgress("upgrade", model.construction.id);
  if (initial.year || initial.season || initial.seasonTicks)
    transaction.setCalendarState(model.year, {
      phaseIndex: initial.season ?? 0,
      elapsedMs: (initial.seasonTicks ?? 0) * 200,
      cycle: BigInt(initial.year ?? 0),
      boundaries: [],
    });
}

function advanceCalendar(
  transaction: Transaction<number>,
  model: KittensModel,
  elapsedMs: number,
  advancedGameMs: number,
): void {
  let state = transaction.getCalendarState(model.year);
  let pending = state.elapsedMs + elapsedMs;
  const boundaries = [...state.boundaries];
  while (pending >= 200_000) {
    pending -= 200_000;
    const phaseIndex = (state.phaseIndex + 1) % 4;
    const cycle = phaseIndex === 0 ? state.cycle + 1n : state.cycle;
    boundaries.push({
      sequence: (boundaries.at(-1)?.sequence ?? 0n) + 1n,
      phaseId: model.year.phases[phaseIndex]?.id as string,
      cycle,
      atGameMs: transaction.gameTimeMs() - advancedGameMs + (elapsedMs - pending),
    });
    state = { ...state, phaseIndex, cycle, boundaries };
  }
  transaction.setCalendarState(model.year, { ...state, elapsedMs: pending, boundaries });
}
