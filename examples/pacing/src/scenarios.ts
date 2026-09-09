import { createGame, type GameDefinition, type Snapshot } from "@e308/core";
import type { HarnessScenario, HarnessValue } from "@e308/core/testing";
import { createCascadeKernel, createHearthKernel, createWireworksKernel } from "./kernels.js";

export interface KernelObservation extends Readonly<Record<string, HarnessValue>> {
  readonly resources: Readonly<Record<string, string>>;
}

export interface KernelIntent extends Readonly<Record<string, HarnessValue>> {
  readonly kind: "cook";
  readonly count: number;
}

export function kernelScenarios(): readonly HarnessScenario<
  number,
  KernelObservation,
  KernelIntent
>[] {
  return [wireworksScenario(), cascadeScenario(), hearthScenario()];
}

export function wireworksScenario(): HarnessScenario<number, KernelObservation, KernelIntent> {
  const kernel = createWireworksKernel();
  const initial = kernel.game.getSnapshot();
  return passiveScenario(kernel.definition, initial, "wireworks", "wire", 15);
}

export function cascadeScenario(): HarnessScenario<number, KernelObservation, KernelIntent> {
  const kernel = createCascadeKernel();
  return passiveScenario(kernel.definition, kernel.game.getSnapshot(), "cascade", "currency", 3);
}

export function hearthScenario(
  foodCost = 2,
): HarnessScenario<number, KernelObservation, KernelIntent> {
  const kernel = createHearthKernel(foodCost);
  const initial = kernel.game.getSnapshot();
  return {
    ...baseScenario(kernel.definition, initial, "hearth"),
    goals: [{ id: "finish", evaluate: (snapshot) => goal(snapshot, "meals", 1) }],
    quote: (snapshot) => {
      const legal =
        (snapshot.resources.food ?? 0) >= foodCost && (snapshot.resources.wood ?? 0) >= 1;
      return [
        {
          id: "cook",
          revision: snapshot.revision.toString(),
          intent: { kind: "cook", count: 1 },
          legal,
          useful: (snapshot.resources.meals ?? 0) < 1,
          rank: 10,
          constraints: legal
            ? []
            : [
                {
                  kind: "insufficient-input",
                  id: "meal-inputs",
                  detail: `requires ${foodCost} food and 1 wood`,
                },
              ],
        },
      ];
    },
    command: (intent) => kernel.cookCommand(intent.count),
    milestones: (snapshot) => ((snapshot.resources.meals ?? 0) >= 1 ? ["finish"] : []),
  };
}

function passiveScenario(
  definition: GameDefinition<number>,
  initial: Snapshot<number>,
  id: string,
  resourceId: string,
  target: number,
): HarnessScenario<number, KernelObservation, KernelIntent> {
  return {
    ...baseScenario(definition, initial, id),
    goals: [{ id: "finish", evaluate: (snapshot) => goal(snapshot, resourceId, target) }],
    quote: () => [],
    command: () => {
      throw new TypeError("Passive kernel has no player action");
    },
    milestones: (snapshot) => ((snapshot.resources[resourceId] ?? 0) >= target ? ["finish"] : []),
  };
}

function baseScenario(definition: GameDefinition<number>, initial: Snapshot<number>, id: string) {
  return {
    id,
    contentVersion: "kernel-1",
    contentDigest: `${id}-kernel-1`,
    parameters: {},
    definition,
    create: (_seed: string) => createGame(definition, { snapshot: initial }),
    observe: (snapshot: Snapshot<number>) => ({ resources: serializedResources(snapshot) }),
    sample: (snapshot: Snapshot<number>) => serializedResources(snapshot),
    diagnostics: () => ({ overflow: 0, resetRecoveries: 0, taskBlocks: 0 }),
  };
}

function serializedResources(snapshot: Snapshot<number>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(snapshot.resources).map(([id, value]) => [id, String(value)]),
  );
}

function goal(snapshot: Snapshot<number>, resourceId: string, target: number) {
  return (snapshot.resources[resourceId] ?? 0) >= target
    ? ({ kind: "reached" } as const)
    : ({ kind: "pending", constraints: [] } as const);
}
