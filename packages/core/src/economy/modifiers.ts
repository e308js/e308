import type { NumericAdapter } from "../numbers/types.js";

export type Modifier<N> =
  | { readonly id: string; readonly stage: "add"; readonly value: N; readonly priority?: number }
  | {
      readonly id: string;
      readonly stage: "multiply";
      readonly value: N;
      readonly priority?: number;
    }
  | { readonly id: string; readonly stage: "power"; readonly value: N; readonly priority?: number }
  | {
      readonly id: string;
      readonly stage: "override";
      readonly value: N;
      readonly priority?: number;
    };

export interface ModifierStep<N> {
  readonly id: string;
  readonly stage: Modifier<N>["stage"];
  readonly before: N;
  readonly value: N;
  readonly after: N;
}

export interface ModifierBreakdown<N> {
  readonly base: N;
  readonly value: N;
  readonly steps: readonly ModifierStep<N>[];
}

const STAGES: Readonly<Record<Modifier<number>["stage"], number>> = {
  add: 0,
  multiply: 1,
  power: 2,
  override: 3,
};

export function applyModifiers<N>(
  base: N,
  modifiers: readonly Modifier<N>[],
  numbers: NumericAdapter<N>,
): ModifierBreakdown<N> {
  let value = base;
  const steps: ModifierStep<N>[] = [];
  for (const modifier of [...modifiers].sort(compareModifiers)) {
    const before = value;
    switch (modifier.stage) {
      case "add":
        value = numbers.add(value, modifier.value);
        break;
      case "multiply":
        value = numbers.mul(value, modifier.value);
        break;
      case "power": {
        const power = numbers.transcendental?.pow;
        if (!power)
          throw new TypeError(`Power modifier ${modifier.id} is unsupported by ${numbers.id}`);
        value = power(value, modifier.value);
        break;
      }
      case "override":
        value = modifier.value;
        break;
    }
    if (!numbers.isFinite(value))
      throw new TypeError(`Modifier ${modifier.id} produced a non-finite value`);
    steps.push(
      Object.freeze({
        id: modifier.id,
        stage: modifier.stage,
        before,
        value: modifier.value,
        after: value,
      }),
    );
  }
  return Object.freeze({ base, value, steps: Object.freeze(steps) });
}

function compareModifiers<N>(left: Modifier<N>, right: Modifier<N>): number {
  const stage = STAGES[left.stage] - STAGES[right.stage];
  if (stage !== 0) return stage;
  const priority = (left.priority ?? 0) - (right.priority ?? 0);
  if (priority !== 0) return priority;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
