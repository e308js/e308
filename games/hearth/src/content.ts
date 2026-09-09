import { createGameKit, nativeNumbers, type Transaction } from "@e308/core";

export const hearthKit = createGameKit({ numbers: nativeNumbers });
export const hearthScope = hearthKit.scope("settlement");
const storage = hearthKit.resource("storage", { scope: hearthScope, initial: 0 });

export const hearthResources = {
  workers: hearthKit.resource("workers", { scope: hearthScope, initial: 4 }),
  storage,
  food: hearthKit.resource("food", {
    scope: hearthScope,
    initial: 20,
    capacityFor: (get) => 40 + get(storage) * 40,
    overflow: "clamp",
  }),
  wood: hearthKit.resource("wood", {
    scope: hearthScope,
    initial: 10,
    capacityFor: (get) => 40 + get(storage) * 30,
    overflow: "clamp",
  }),
  stone: hearthKit.resource("stone", {
    scope: hearthScope,
    initial: 0,
    capacityFor: (get) => 30 + get(storage) * 30,
    overflow: "clamp",
  }),
  science: hearthKit.resource("science", {
    scope: hearthScope,
    initial: 0,
    capacity: 500,
    overflow: "clamp",
  }),
  herbs: hearthKit.resource("herbs", {
    scope: hearthScope,
    initial: 0,
    capacity: 100,
    overflow: "clamp",
  }),
  tools: hearthKit.resource("tools", { scope: hearthScope, initial: 0, capacity: 30 }),
  meals: hearthKit.resource("meals", { scope: hearthScope, initial: 0, capacity: 30 }),
  cloth: hearthKit.resource("cloth", { scope: hearthScope, initial: 0, capacity: 30 }),
  medicine: hearthKit.resource("medicine", { scope: hearthScope, initial: 0, capacity: 20 }),
  preserves: hearthKit.resource("preserves", { scope: hearthScope, initial: 0, capacity: 30 }),
  festival: hearthKit.resource("festival", { scope: hearthScope, initial: 0, capacity: 1 }),
  morale: hearthKit.resource("morale", {
    scope: hearthScope,
    initial: 60,
    capacity: 100,
    overflow: "clamp",
  }),
  hall: hearthKit.resource("hall", { scope: hearthScope, initial: 0, capacity: 1 }),
} as const;

export const hearthJobs = hearthKit.allocation("jobs", {
  scope: hearthScope,
  budget: hearthResources.workers,
  targets: ["farmer", "woodcutter", "miner", "scholar"],
  initial: { farmer: 2, woodcutter: 1, miner: 0, scholar: 0 },
});

export const hearthCalendar = hearthKit.calendar("seasons", {
  scope: hearthScope,
  phases: ["spring", "summer", "autumn", "winter"].map((id) => ({
    id,
    durationMs: 45_000,
  })),
});

export const hearthRecipes = {
  meal: hearthKit.recipe("prepare-meal", {
    scope: hearthScope,
    consumes: [
      [hearthResources.food, 5],
      [hearthResources.herbs, 1],
    ],
    produces: [[hearthResources.meals, 1]],
  }),
  tool: hearthKit.recipe("forge-tool", {
    scope: hearthScope,
    consumes: [
      [hearthResources.wood, 5],
      [hearthResources.stone, 3],
    ],
    produces: [[hearthResources.tools, 1]],
  }),
  cloth: hearthKit.recipe("weave-cloth", {
    scope: hearthScope,
    consumes: [[hearthResources.herbs, 4]],
    produces: [[hearthResources.cloth, 1]],
  }),
  medicine: hearthKit.recipe("brew-medicine", {
    scope: hearthScope,
    consumes: [
      [hearthResources.herbs, 3],
      [hearthResources.science, 2],
    ],
    produces: [[hearthResources.medicine, 1]],
  }),
  preserves: hearthKit.recipe("pack-preserves", {
    scope: hearthScope,
    consumes: [
      [hearthResources.food, 8],
      [hearthResources.wood, 1],
    ],
    produces: [[hearthResources.preserves, 1]],
  }),
  festival: hearthKit.recipe("hold-festival", {
    scope: hearthScope,
    consumes: [
      [hearthResources.meals, 2],
      [hearthResources.cloth, 1],
    ],
    produces: [
      [hearthResources.festival, 1],
      [hearthResources.morale, 25],
    ],
  }),
  cottage: hearthKit.recipe("build-cottage", {
    scope: hearthScope,
    consumes: [
      [hearthResources.wood, 12],
      [hearthResources.stone, 8],
      [hearthResources.tools, 1],
    ],
    produces: [[hearthResources.workers, 1]],
  }),
} as const;

export const hearthResearch = [
  hearthKit.upgrade("storehouses", {
    scope: hearthScope,
    costs: [[hearthResources.science, 10]],
    prerequisiteIds: [],
    unlocked: () => true,
    apply: (tx) => tx.add(hearthResources.storage, 1),
  }),
  hearthKit.upgrade("crop-rotation", {
    scope: hearthScope,
    costs: [[hearthResources.science, 20]],
    prerequisiteIds: ["storehouses"],
    unlocked: (state) => state.hasUpgrade("storehouses"),
  }),
  hearthKit.upgrade("stone-granaries", {
    scope: hearthScope,
    costs: [[hearthResources.science, 30]],
    prerequisiteIds: ["crop-rotation"],
    unlocked: (state) => state.hasUpgrade("crop-rotation"),
    apply: (tx) => tx.add(hearthResources.storage, 1),
  }),
  hearthKit.upgrade("civic-charter", {
    scope: hearthScope,
    costs: [[hearthResources.science, 40]],
    prerequisiteIds: ["stone-granaries"],
    unlocked: (state) => state.hasUpgrade("stone-granaries"),
    apply: (tx) => tx.add(hearthResources.workers, 1),
  }),
] as const;

export const hearthTasks = {
  expedition: hearthKit.task("herbal-expedition", {
    scope: hearthScope,
    inputs: [
      [hearthResources.meals, 1],
      [hearthResources.tools, 1],
    ],
    outputs: [
      [hearthResources.herbs, 8],
      [hearthResources.science, 12],
    ],
    work: { kind: "fixed-duration", durationMs: 60_000 },
    delivery: "discard-overflow",
    cancellation: { refund: "full" },
    queueLimit: 2,
  }),
  hall: hearthKit.task("raise-great-hall", {
    scope: hearthScope,
    inputs: [
      [hearthResources.wood, 30],
      [hearthResources.stone, 20],
      [hearthResources.tools, 2],
      [hearthResources.cloth, 2],
      [hearthResources.meals, 2],
    ],
    outputs: [[hearthResources.hall, 1]],
    work: { kind: "fixed-duration", durationMs: 120_000 },
    delivery: "block",
    cancellation: { refund: "fraction", ratio: 0.5 },
    queueLimit: 1,
  }),
} as const;

export const shortage = hearthKit.achievement("winter-shortage", {
  scope: hearthScope,
  when: (state) => state.get(hearthResources.food) === 0,
});

export const recovery = hearthKit.achievement("shortage-recovered", {
  scope: hearthScope,
  priority: 20,
  when: (state) =>
    state.hasAchievement(shortage.id) &&
    state.get(hearthResources.food) >= 10 &&
    state.get(hearthResources.meals) >= 1 &&
    state.get(hearthResources.morale) >= 20,
});

export const yearComplete = hearthKit.achievement("year-complete", {
  scope: hearthScope,
  priority: 30,
  when: () => false,
});

export const seasonalRule = hearthKit.steppedRule("seasonal-ledger", {
  scope: hearthScope,
  priority: 10,
  update(transaction, stepSeconds) {
    applySeasonalLedger(transaction, stepSeconds);
  },
});

function applySeasonalLedger(transaction: Transaction<number>, stepSeconds: number): void {
  const state = transaction.getCalendarState(hearthCalendar);
  const phaseDefinition = hearthCalendar.phases[state.phaseIndex];
  const phase = phaseDefinition?.id ?? "spring";
  if (
    state.cycle >= 1n ||
    (phase === "winter" &&
      state.elapsedMs + stepSeconds * 1_000 >= (phaseDefinition?.durationMs ?? 0))
  )
    transaction.setProgress("achievement", yearComplete.id);
  const factor = seasonFactor(phase);
  const farmers = transaction.getAllocation(hearthJobs.id, "farmer");
  const labor = laborMultiplier(
    transaction.get(hearthResources.tools),
    transaction.get(hearthResources.morale),
  );
  const foodProduced =
    farmers *
    factor *
    labor *
    stepSeconds *
    (transaction.hasProgress("upgrade", "crop-rotation") ? 1.5 : 1);
  const foodUsed =
    transaction.get(hearthResources.workers) *
    0.4 *
    foodConsumptionMultiplier(phase, transaction.get(hearthResources.preserves)) *
    stepSeconds;
  const before = transaction.get(hearthResources.food);
  transaction.set(hearthResources.food, Math.max(0, before + foodProduced - foodUsed));
  transaction.addProduction(hearthResources.food.id, foodProduced);
  produceJob(transaction, "woodcutter", hearthResources.wood, 1 * labor, stepSeconds);
  produceJob(transaction, "miner", hearthResources.stone, 0.7 * labor, stepSeconds);
  produceJob(transaction, "scholar", hearthResources.science, 0.5 * labor, stepSeconds);
  if (phase === "spring" || phase === "autumn")
    transaction.add(hearthResources.herbs, farmers * 0.08 * stepSeconds);
  if (transaction.get(hearthResources.food) === 0)
    transaction.set(
      hearthResources.morale,
      Math.max(0, transaction.get(hearthResources.morale) - 0.5),
    );
  else if (transaction.get(hearthResources.morale) < 100)
    transaction.add(
      hearthResources.morale,
      (0.1 + transaction.get(hearthResources.medicine) * 0.03) * stepSeconds,
    );
}

export function seasonFactor(phase: string): number {
  return phase === "spring" ? 1.5 : phase === "summer" ? 1.2 : phase === "autumn" ? 1 : 0.35;
}

export function laborMultiplier(tools: number, morale: number): number {
  return (0.75 + Math.min(100, morale) * 0.0025) * (1 + tools * 0.08);
}

export function foodConsumptionMultiplier(phase: string, preserves: number): number {
  return phase === "winter" ? Math.max(0.55, 1 - preserves * 0.08) : 1;
}

function produceJob(
  transaction: Transaction<number>,
  target: "woodcutter" | "miner" | "scholar",
  resource: (typeof hearthResources)[keyof typeof hearthResources],
  rate: number,
  seconds: number,
): void {
  const amount = transaction.getAllocation(hearthJobs.id, target) * rate * seconds;
  transaction.add(resource, amount);
  transaction.addProduction(resource.id, amount);
}
