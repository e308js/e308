import type { Snapshot } from "@e308/core";
import type { ActionBlocker, ActionView, ViewDocument, ViewNode } from "@e308/ux";
import { hearthCalendar, hearthRecipes, hearthResearch, hearthTasks } from "./content.js";
import type { HearthIntent, HearthRecipe, HearthTask } from "./runtime.js";
import {
  hearthGoal,
  recipeDescription,
  researchDescription,
  taskDescription,
} from "./view-copy.js";
import { seasonalLedger } from "./view-ledger.js";

export function hearthView(snapshot: Snapshot<number>): ViewDocument<HearthIntent, number> {
  return {
    title: "Hearth",
    activeScopeIds: ["settlement"],
    hotkeys: [
      {
        id: "advance",
        key: "w",
        description: "Advance one minute",
        enabled: !snapshot.progression.won,
        intent: { type: "advance", milliseconds: 60_000 },
        scopeId: "settlement",
      },
    ],
    content: [
      { kind: "heading", id: "title", level: 1, text: "Hearth" },
      {
        kind: "description",
        id: "instructions",
        content: [
          {
            kind: "text",
            value:
              "Assign workers, prepare for each season, expand the settlement, and raise the great hall.",
          },
        ],
      },
      goalPanel(snapshot),
      workforceSummary(snapshot),
      calendarPanel(snapshot),
      { kind: "row", id: "settlement-resources", children: resourceNodes(snapshot) },
      {
        kind: "tabs",
        id: "settlement-tabs",
        tabs: [
          { id: "workforce", label: "Workforce", content: workforce(snapshot) },
          { id: "crafting", label: "Crafting", content: crafting(snapshot) },
          { id: "research", label: "Research", content: research(snapshot) },
          { id: "projects", label: "Projects", content: taskNodes(snapshot) },
        ],
      },
      seasonalLedger(snapshot),
      {
        kind: "action",
        id: "wait",
        action: {
          ...simpleAction(
            "Advance one minute",
            { type: "advance", milliseconds: 60_000 },
            !snapshot.progression.won,
          ),
          id: "wait",
        },
      },
      snapshot.progression.won
        ? {
            kind: "notification",
            id: "ending",
            text: "The great hall opens after a hard-won year. Hearth is complete.",
            tone: "positive",
          }
        : shortageNotice(snapshot),
    ],
  };
}

function resourceNodes(snapshot: Snapshot<number>): ViewNode<HearthIntent, number>[] {
  return [
    "workers",
    "food",
    "wood",
    "stone",
    "science",
    "herbs",
    "tools",
    "meals",
    "cloth",
    "medicine",
    "preserves",
    "morale",
  ].map((id) => ({
    kind: "resource",
    id: `resource-${id}`,
    resource: {
      resourceId: id,
      label: id,
      value: snapshot.resources[id] ?? 0,
      ...(capacity(snapshot, id) === undefined
        ? {}
        : { capacity: capacity(snapshot, id) as number }),
    },
  }));
}

function workforce(snapshot: Snapshot<number>): ViewNode<HearthIntent, number>[] {
  const maximum = snapshot.resources.workers ?? 0;
  const assigned = Object.values(snapshot.allocations.jobs ?? {}).reduce(
    (total, value) => total + value,
    0,
  );
  return (["farmer", "woodcutter", "miner", "scholar"] as const).map((job) => ({
    kind: "range-input",
    id: `job-${job}`,
    label: job,
    value: snapshot.allocations.jobs?.[job] ?? 0,
    min: 0,
    max: maximum,
    allowedMax: maximum - assigned + (snapshot.allocations.jobs?.[job] ?? 0),
    step: 1,
    showTicks: true,
    intent: (amount) => ({ type: "allocate", job, amount }),
  }));
}

function workforceSummary(snapshot: Snapshot<number>): ViewNode<HearthIntent, number> {
  const workers = snapshot.resources.workers ?? 0;
  const assigned = Object.values(snapshot.allocations.jobs ?? {}).reduce(
    (total, value) => total + value,
    0,
  );
  return {
    kind: "notification",
    id: "workforce-summary",
    text: `${workers - assigned} of ${workers} workers available. Lower one job to move that worker to another job.`,
    tone: "neutral",
  };
}

function goalPanel(snapshot: Snapshot<number>): ViewNode<HearthIntent, number> {
  return {
    kind: "notification",
    id: "current-goal",
    text: hearthGoal(snapshot),
    tone: "neutral",
  };
}

function crafting(snapshot: Snapshot<number>): ViewNode<HearthIntent, number>[] {
  return (Object.keys(hearthRecipes) as HearthRecipe[]).map((recipe) => ({
    kind: "action",
    id: `recipe-${recipe}`,
    action: recipeAction(snapshot, recipe),
  }));
}

function recipeAction(
  snapshot: Snapshot<number>,
  recipe: HearthRecipe,
): ActionView<HearthIntent, number> {
  const definition = hearthRecipes[recipe];
  const blockers: ActionBlocker<number>[] = definition.consumes
    .filter(([resource, amount]) => (snapshot.resources[resource.id] ?? 0) < amount)
    .map(([resource, amount]) => ({
      kind: "insufficient",
      resourceId: resource.id,
      required: amount,
      available: snapshot.resources[resource.id] ?? 0,
    }));
  return {
    id: recipe,
    label: definition.id.replaceAll("-", " "),
    description: [{ kind: "text", value: recipeDescription(recipe) }],
    enabled: blockers.length === 0,
    intent: { type: "recipe", recipe, count: 1 },
    blockers,
    costs: definition.consumes.map(([resource, amount]) => ({
      resourceId: resource.id,
      label: resource.id,
      value: amount,
    })),
    rewards: definition.produces.map(([resource, amount]) => ({
      resourceId: resource.id,
      label: resource.id,
      value: amount,
    })),
  };
}

function research(snapshot: Snapshot<number>): ViewNode<HearthIntent, number>[] {
  return hearthResearch.map((entry) => {
    const owned = snapshot.progression.upgrades[entry.id] === true;
    const cost = entry.costs[0]?.[1] ?? 0;
    const missing = entry.prerequisiteIds.filter((id) => !snapshot.progression.upgrades[id]);
    const blockers: ActionBlocker<number>[] = [];
    if (owned) blockers.push({ kind: "disabled", actionId: entry.id, reasonKey: "already-owned" });
    if (missing.length) blockers.push({ kind: "locked", prerequisiteIds: missing });
    if ((snapshot.resources.science ?? 0) < cost)
      blockers.push({
        kind: "insufficient",
        resourceId: "science",
        required: cost,
        available: snapshot.resources.science ?? 0,
      });
    return {
      kind: "action",
      id: `research-${entry.id}`,
      action: {
        id: entry.id,
        label: entry.id.replaceAll("-", " "),
        description: [{ kind: "text", value: researchDescription(entry.id) }],
        enabled: blockers.length === 0,
        intent: { type: "research", id: entry.id },
        blockers,
        costs: [{ resourceId: "science", label: "science", value: cost }],
      },
    };
  });
}

function taskNodes(snapshot: Snapshot<number>): ViewNode<HearthIntent, number>[] {
  return (Object.keys(hearthTasks) as HearthTask[]).flatMap((task) => {
    const definition = hearthTasks[task];
    const state = snapshot.tasks[definition.id];
    const busy = Boolean(state?.active || state?.queue.length);
    const blockers: ActionBlocker<number>[] = definition.inputs
      .filter(([resource, amount]) => (snapshot.resources[resource.id] ?? 0) < amount)
      .map(([resource, amount]) => ({
        kind: "insufficient",
        resourceId: resource.id,
        required: amount,
        available: snapshot.resources[resource.id] ?? 0,
      }));
    if (busy)
      blockers.push({
        kind: "cooldown",
        actionId: definition.id,
        remainingMs: state?.active?.mode === "fixed-duration" ? state.active.remainingMs : 0,
        clock: "game",
      });
    const nodes: ViewNode<HearthIntent, number>[] = [
      {
        kind: "action",
        id: `task-${task}`,
        action: {
          id: definition.id,
          label: definition.id.replaceAll("-", " "),
          description: [{ kind: "text", value: taskDescription(task) }],
          enabled: blockers.length === 0,
          intent: { type: "task", task },
          blockers,
          costs: definition.inputs.map(([resource, amount]) => ({
            resourceId: resource.id,
            label: resource.id,
            value: amount,
          })),
          rewards: definition.outputs.map(([resource, amount]) => ({
            resourceId: resource.id,
            label: resource.id,
            value: amount,
          })),
        },
      },
    ];
    if (state?.active) nodes.push(taskProgress(task, state.active));
    return nodes;
  });
}

function taskProgress(
  task: HearthTask,
  active: NonNullable<Snapshot<number>["tasks"][string]>["active"],
): ViewNode<HearthIntent, number> {
  const duration = hearthTasks[task].work;
  const total = duration.kind === "fixed-duration" ? duration.durationMs : 1;
  const remaining = active?.mode === "fixed-duration" ? active.remainingMs : 0;
  return {
    kind: "progress",
    id: `task-${task}-progress`,
    label: `${hearthTasks[task].id.replaceAll("-", " ")} — ${Math.ceil(remaining / 1_000)} seconds remaining`,
    value: 1 - remaining / total,
    direction: "right",
    animated: true,
    style: { width: "100%", maxWidth: "28rem" },
  };
}

function calendarPanel(snapshot: Snapshot<number>): ViewNode<HearthIntent, number> {
  const state = snapshot.calendars.seasons;
  const phase = hearthCalendar.phases[state?.phaseIndex ?? 0];
  return {
    kind: "progress",
    id: "season",
    label: `${phase?.id ?? "spring"}, year ${Number(state?.cycle ?? 0n) + 1}`,
    value: (state?.elapsedMs ?? 0) / (phase?.durationMs ?? 1),
    direction: "right",
    animated: true,
  };
}

function shortageNotice(snapshot: Snapshot<number>): ViewNode<HearthIntent, number> {
  const recovered = snapshot.progression.achievements["shortage-recovered"];
  return {
    kind: "notification",
    id: "shortage-state",
    text: recovered
      ? "The settlement recovered from winter shortage."
      : snapshot.progression.achievements["winter-shortage"]
        ? "Food ran out. Reassign farmers, restore morale, and prepare a meal."
        : "Winter will test the current stores.",
    tone: recovered ? "positive" : "warning",
  };
}

function capacity(snapshot: Snapshot<number>, id: string): number | undefined {
  const storage = snapshot.resources.storage ?? 0;
  if (id === "food") return 40 + storage * 40;
  if (id === "wood") return 40 + storage * 30;
  if (id === "stone") return 30 + storage * 30;
  return { science: 500, herbs: 100, tools: 30, meals: 30, cloth: 30, morale: 100 }[id];
}

function simpleAction(
  label: string,
  intent: HearthIntent,
  enabled: boolean,
): ActionView<HearthIntent, number> {
  return {
    id: label.toLowerCase().replaceAll(" ", "-"),
    label,
    enabled,
    intent,
    blockers: enabled ? [] : [{ kind: "disabled", actionId: label, reasonKey: "unavailable" }],
  };
}
