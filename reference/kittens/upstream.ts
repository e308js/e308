export interface KittensResources {
  catnip: number;
  wood: number;
  minerals: number;
  science: number;
  beam: number;
}

export interface KittensState {
  resources: KittensResources;
  kittens: number;
  workers: { farmer: number; woodcutter: number; miner: number; scholar: number };
  season: number;
  seasonTicks: number;
  year: number;
  barns: number;
  huts: number;
  researchedConstruction: boolean;
  paragon: number;
}

export const SEASON_CATNIP = [1.5, 1, 1, 0.25] as const;
export const TICKS_PER_SEASON = 1_000;

export function kittensState(initial: Partial<KittensState> = {}): KittensState {
  return {
    resources: { catnip: 0, wood: 0, minerals: 0, science: 0, beam: 0, ...initial.resources },
    kittens: initial.kittens ?? 0,
    workers: { farmer: 0, woodcutter: 0, miner: 0, scholar: 0, ...initial.workers },
    season: initial.season ?? 0,
    seasonTicks: initial.seasonTicks ?? 0,
    year: initial.year ?? 0,
    barns: initial.barns ?? 0,
    huts: initial.huts ?? 0,
    researchedConstruction: initial.researchedConstruction ?? false,
    paragon: initial.paragon ?? 0,
  };
}

export function sourceRates(state: KittensState): KittensResources {
  return {
    catnip: state.workers.farmer * (SEASON_CATNIP[state.season] ?? 1) - state.kittens * 0.85,
    wood: state.workers.woodcutter * 0.018,
    minerals: state.workers.miner * 0.05,
    science: state.workers.scholar * 0.035,
    beam: 0,
  };
}

export function sourceTick(state: KittensState, ticks = 1): void {
  for (let index = 0; index < ticks; index += 1) {
    const rates = sourceRates(state);
    for (const key of ["catnip", "wood", "minerals", "science"] as const)
      state.resources[key] = clamp(
        state.resources[key] + rates[key],
        0,
        sourceCapacity(state, key),
      );
    state.seasonTicks += 1;
    if (state.seasonTicks !== TICKS_PER_SEASON) continue;
    state.seasonTicks = 0;
    state.season = (state.season + 1) % 4;
    if (state.season === 0) state.year += 1;
  }
}

export function sourceCapacity(
  state: KittensState,
  resource: "catnip" | "wood" | "minerals" | "science",
): number {
  if (resource === "catnip") return 5_000 + state.barns * 5_000;
  if (resource === "wood") return 200 + state.barns * 200;
  if (resource === "minerals") return 250 + state.barns * 250;
  return 100;
}

export function sourceAssign(
  state: KittensState,
  job: keyof KittensState["workers"],
  count: number,
): boolean {
  if (!Number.isSafeInteger(count) || count < 0) return false;
  const assigned = Object.entries(state.workers).reduce(
    (sum, [id, value]) => sum + (id === job ? count : value),
    0,
  );
  if (assigned > state.kittens) return false;
  state.workers[job] = count;
  return true;
}

export function sourceBuild(state: KittensState, building: "barn" | "hut"): boolean {
  const count = building === "barn" ? state.barns : state.huts;
  const base = building === "barn" ? 50 : 5;
  const ratio = building === "barn" ? 1.75 : 2.5;
  const cost = base * ratio ** count;
  if (state.resources.wood < cost) return false;
  state.resources.wood -= cost;
  if (building === "barn") state.barns += 1;
  else state.huts += 1;
  return true;
}

export function sourceCraft(state: KittensState, craft: "wood" | "beam"): boolean {
  if (craft === "wood") {
    if (state.resources.catnip < 100) return false;
    state.resources.catnip -= 100;
    state.resources.wood = Math.min(sourceCapacity(state, "wood"), state.resources.wood + 1);
    return true;
  }
  if (!state.researchedConstruction || state.resources.wood < 175) return false;
  state.resources.wood -= 175;
  state.resources.beam += 1;
  return true;
}

export function redshiftDays(elapsedMs: number, progressed: boolean): number {
  const days = Math.round(elapsedMs / 2_000);
  if (days < 3) return 0;
  return Math.min(days, (progressed ? 40 : 10) * 4 * 100);
}

export function sourceRedshift(state: KittensState, elapsedMs: number): number {
  const days = redshiftDays(elapsedMs, state.year >= 1_000 || state.paragon > 0);
  if (days === 0) return 0;
  const rates = sourceRates(state);
  for (const key of ["catnip", "wood", "minerals", "science"] as const) {
    if (rates[key] <= 0) continue;
    state.resources[key] = Math.min(
      sourceCapacity(state, key),
      state.resources[key] + rates[key] * days * 10,
    );
  }
  sourceTickCalendar(state, days * 10);
  return days;
}

export function sourceReset(state: KittensState): void {
  const paragon = state.paragon;
  Object.assign(state, kittensState({ paragon }));
}

function sourceTickCalendar(state: KittensState, ticks: number): void {
  const total = state.seasonTicks + ticks;
  const transitions = Math.floor(total / TICKS_PER_SEASON);
  state.seasonTicks = total % TICKS_PER_SEASON;
  const seasons = state.season + transitions;
  state.year += Math.floor(seasons / 4);
  state.season = seasons % 4;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
