import type { FlowDefinition, Rate } from "../economy/types.js";
import type { GameDefinition } from "../model/definition.js";
import type { Snapshot, Transaction } from "../state/types.js";
import type { BulkCapability, BulkPlanContext, BulkPlanResult } from "./types.js";

interface LinearRate {
  readonly constant: number;
  readonly coefficients: readonly number[];
}

interface AffineTransform {
  readonly matrix: readonly (readonly number[])[];
  readonly offset: readonly number[];
}

type CompleteOptimizationDefinition = GameDefinition<number> & {
  readonly resources: NonNullable<GameDefinition<number>["resources"]>;
  readonly flows: NonNullable<GameDefinition<number>["flows"]>;
  readonly automation: NonNullable<GameDefinition<number>["automation"]>;
  readonly steppedRules: NonNullable<GameDefinition<number>["steppedRules"]>;
  readonly tasks: NonNullable<GameDefinition<number>["tasks"]>;
  readonly calendars: NonNullable<GameDefinition<number>["calendars"]>;
  readonly triggers: NonNullable<GameDefinition<number>["triggers"]>;
  readonly scopeActivations: NonNullable<GameDefinition<number>["scopeActivations"]>;
  readonly challenges: NonNullable<GameDefinition<number>["challenges"]>;
};

export const nativeAffineCapability: BulkCapability<number> = Object.freeze({
  id: "e308/native-affine",
  version: "1",
  fidelity: "validated-bulk",
  dependencies: ["resources", "flows", "allocations", "automation-clock"],
  plan: planNativeAffine,
});

function planNativeAffine(context: BulkPlanContext<number>): BulkPlanResult<number> {
  const definition = context.definition as CompleteOptimizationDefinition;
  const reason = unsupportedReason(definition, context.snapshot);
  if (reason) return { eligible: false, reason };
  const steps = stepsBeforeAutomation(context);
  if (steps < 1) return { eligible: false, reason: "automation-boundary" };
  try {
    const resources = definition.resources;
    const transform = buildTransform(definition, context.snapshot, resources);
    const initial = resources.map((resource) =>
      requireSafe(requiredValue(context.snapshot.resources, resource.id)),
    );
    const final = applyPower(transform, initial, steps);
    validateProductionTotals(context.snapshot, resources, initial, final);
    return {
      eligible: true,
      steps,
      apply: (transaction) => applyResult(transaction, resources, initial, final),
    };
  } catch (error) {
    return { eligible: false, reason: messageOf(error) };
  }
}

function unsupportedReason(
  definition: CompleteOptimizationDefinition,
  snapshot: Snapshot<number>,
): string | undefined {
  if (definition.numbers?.id !== "native") return "numeric-adapter";
  if (definition.stepMs % 1_000 !== 0) return "fractional-step-seconds";
  if (definition.steppedRules.length > 0) return "custom-stepped-rule";
  if (definition.tasks.length > 0) return "tasks";
  if (definition.calendars.length > 0) return "calendars";
  if (definition.triggers.length > 0) return "progression-triggers";
  if (definition.scopeActivations.length > 0) return "scope-activation";
  if (definition.challenges.length > 0) return "challenges";
  if (definition.win) return "win-condition";
  if (
    definition.resources.some((resource) => resource.capacity !== undefined || resource.capacityFor)
  )
    return "resource-capacity";
  if (definition.flows.some((flow) => flow.consumes.length > 0)) return "flow-inputs";
  if (Object.values(snapshot.resources).some((value) => !isNonnegativeSafe(value)))
    return "unsafe-resource-value";
  return undefined;
}

function stepsBeforeAutomation(context: BulkPlanContext<number>): number {
  const definition = context.definition as CompleteOptimizationDefinition;
  let steps = context.requestedSteps;
  for (const automation of definition.automation) {
    const next =
      context.snapshot.progression.automation[automation.id]?.nextRunMs ?? automation.cadenceMs;
    const before = Math.floor((next - context.snapshot.gameTimeMs - 1) / context.definition.stepMs);
    steps = Math.min(steps, Math.max(0, before));
  }
  return steps;
}

function buildTransform(
  definition: CompleteOptimizationDefinition,
  snapshot: Snapshot<number>,
  resources: NonNullable<GameDefinition<number>["resources"]>,
): AffineTransform {
  const size = resources.length;
  const indexes = new Map(resources.map((resource, index) => [resource.id, index]));
  const matrix: number[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  );
  const offset = Array.from({ length: size }, () => 0);
  const stepSeconds = definition.stepMs / 1_000;
  for (const flow of [...definition.flows].sort(compareFlows)) {
    const rate = linearRate(flow.rate, snapshot, indexes, size);
    for (const [resource, coefficient] of flow.produces) {
      const row = indexes.get(resource.id);
      if (row === undefined) throw new TypeError(`Unknown flow output ${resource.id}`);
      const scale = checkedMultiply(requireNonnegativeSafe(coefficient), stepSeconds);
      offset[row] = checkedAdd(requiredIndex(offset, row), checkedMultiply(rate.constant, scale));
      for (let column = 0; column < size; column += 1) {
        const outputRow = matrix[row];
        if (!outputRow) throw new TypeError("missing-affine-output-row");
        outputRow[column] = checkedAdd(
          requiredIndex(outputRow, column),
          checkedMultiply(requiredIndex(rate.coefficients, column), scale),
        );
      }
    }
  }
  return { matrix, offset };
}

function linearRate(
  rate: Rate<number>,
  snapshot: Snapshot<number>,
  indexes: ReadonlyMap<string, number>,
  size: number,
): LinearRate {
  if (rate.kind === "constant") return constantRate(requireNonnegativeSafe(rate.value), size);
  if (rate.kind === "allocated") {
    const assignments = snapshot.allocations[rate.allocation.id];
    /* v8 ignore next -- owned snapshots contain every definition-owned allocation */
    if (!assignments) throw new TypeError(`missing-allocation:${rate.allocation.id}`);
    const assigned = requiredValue(assignments, rate.targetId);
    return constantRate(
      checkedMultiply(requireNonnegativeSafe(assigned), requireNonnegativeSafe(rate.factor)),
      size,
    );
  }
  if (rate.kind === "proportional") {
    const index = indexes.get(rate.resource.id);
    if (index === undefined)
      throw new TypeError(`Unknown proportional resource ${rate.resource.id}`);
    const coefficients = Array.from({ length: size }, () => 0);
    coefficients[index] = requireNonnegativeSafe(rate.factor);
    return { constant: 0, coefficients };
  }
  if (rate.kind === "purchased") {
    const count = requiredValue(snapshot.purchaseCounts, rate.buyable.id);
    return constantRate(
      checkedMultiply(requireNonnegativeSafe(count), requireNonnegativeSafe(rate.factor)),
      size,
    );
  }
  if (rate.kind === "custom") throw new TypeError("custom-rate");
  if (rate.kind === "sum")
    return rate.terms.reduce(
      (result, term) => addRates(result, linearRate(term, snapshot, indexes, size)),
      constantRate(0, size),
    );
  let result = constantRate(1, size);
  for (const factor of rate.factors)
    result = multiplyRates(result, linearRate(factor, snapshot, indexes, size));
  return result;
}

function addRates(left: LinearRate, right: LinearRate): LinearRate {
  return {
    constant: checkedAdd(left.constant, right.constant),
    coefficients: left.coefficients.map((value, index) =>
      checkedAdd(value, requiredIndex(right.coefficients, index)),
    ),
  };
}

function constantRate(value: number, size: number): LinearRate {
  return { constant: value, coefficients: Array.from({ length: size }, () => 0) };
}

function multiplyRates(left: LinearRate, right: LinearRate): LinearRate {
  const leftLinear = left.coefficients.some((value) => value !== 0);
  const rightLinear = right.coefficients.some((value) => value !== 0);
  if (leftLinear && rightLinear) throw new TypeError("nonlinear-product-rate");
  const coefficients = left.coefficients.map((value, index) =>
    checkedAdd(
      checkedMultiply(value, right.constant),
      checkedMultiply(requiredIndex(right.coefficients, index), left.constant),
    ),
  );
  return { constant: checkedMultiply(left.constant, right.constant), coefficients };
}

function applyPower(
  transform: AffineTransform,
  initial: readonly number[],
  steps: number,
): number[] {
  let value = [...initial];
  let power = transform;
  let remaining = steps;
  while (remaining > 0) {
    if (remaining % 2 === 1) value = applyTransform(power, value);
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) power = compose(power, power);
  }
  return value;
}

function applyTransform(transform: AffineTransform, value: readonly number[]): number[] {
  return transform.matrix.map((row, index) =>
    row.reduce(
      (total, coefficient, column) =>
        checkedAdd(total, checkedMultiply(coefficient, requiredIndex(value, column))),
      requiredIndex(transform.offset, index),
    ),
  );
}

function compose(left: AffineTransform, right: AffineTransform): AffineTransform {
  const size = left.offset.length;
  const matrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      let total = 0;
      for (let inner = 0; inner < size; inner += 1)
        total = checkedAdd(
          total,
          checkedMultiply(
            matrixEntry(left.matrix, row, inner),
            matrixEntry(right.matrix, inner, column),
          ),
        );
      return total;
    }),
  );
  const rightOffset = applyTransform(
    { matrix: left.matrix, offset: Array.from({ length: size }, () => 0) },
    right.offset,
  );
  return {
    matrix,
    offset: rightOffset.map((value, index) => checkedAdd(value, requiredIndex(left.offset, index))),
  };
}

function validateProductionTotals(
  snapshot: Snapshot<number>,
  resources: NonNullable<GameDefinition<number>["resources"]>,
  initial: readonly number[],
  final: readonly number[],
): void {
  resources.forEach((resource, index) => {
    const delta = checkedAdd(requiredIndex(final, index), -requiredIndex(initial, index));
    checkedAdd(requireSafe(requiredValue(snapshot.productionTotals, resource.id)), delta);
  });
}

function applyResult(
  transaction: Transaction<number>,
  resources: NonNullable<GameDefinition<number>["resources"]>,
  initial: readonly number[],
  final: readonly number[],
): void {
  resources.forEach((resource, index) => {
    const value = requiredIndex(final, index);
    const delta = value - requiredIndex(initial, index);
    transaction.set(resource, value);
    if (delta !== 0) transaction.addProduction(resource.id, delta);
  });
}

function checkedAdd(left: number, right: number): number {
  return requireSafe(left + right);
}

function checkedMultiply(left: number, right: number): number {
  return requireSafe(left * right);
}

function requireSafe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new TypeError("unsafe-integer-arithmetic");
  return value;
}

function requireNonnegativeSafe(value: number): number {
  if (!isNonnegativeSafe(value)) throw new TypeError("negative-or-unsafe-coefficient");
  return value;
}

function isNonnegativeSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function requiredValue(values: Readonly<Record<string, number>>, id: string): number {
  const value = values[id];
  /* v8 ignore next -- owned snapshots contain every definition-owned keyed value */
  if (value === undefined) throw new TypeError(`missing-owned-value:${id}`);
  return value;
}

function requiredIndex(values: readonly number[], index: number): number {
  const value = values[index];
  /* v8 ignore next -- matrix dimensions are constructed and traversed together */
  if (value === undefined) throw new TypeError(`missing-matrix-value:${index}`);
  return value;
}

function matrixEntry(matrix: readonly (readonly number[])[], row: number, column: number): number {
  const values = matrix[row];
  /* v8 ignore next -- square matrices are constructed internally */
  if (!values) throw new TypeError(`missing-matrix-row:${row}`);
  return requiredIndex(values, column);
}

function compareFlows(left: FlowDefinition<number>, right: FlowDefinition<number>): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
