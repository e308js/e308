import type { Resource } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { Snapshot, Transaction } from "../state/types.js";
import { stepsBeforeAutomation } from "./automation-boundary.js";
import type { BulkCapability, BulkPlanContext, BulkPlanResult } from "./types.js";

export interface ProducerChainBulkContext<N> {
  readonly snapshot: Snapshot<N>;
  readonly index: number;
}

export interface ProducerChainBulkOptions<N> {
  readonly id: string;
  readonly version: string;
  readonly output: Resource<N>;
  readonly tiers: readonly Resource<N>[];
  readonly dependencies: readonly string[];
  /** Amount produced by one unit of this tier during one simulation step. */
  readonly coefficient: (context: ProducerChainBulkContext<N>) => N;
  /** Return a reason while authored state makes the coefficients unstable. */
  readonly ineligibleReason?: (snapshot: Snapshot<N>) => string | undefined;
}

/** Creates an exact bulk capability for a stable, simultaneous producer chain. */
export function producerChainBulkCapability<N>(
  options: ProducerChainBulkOptions<N>,
): BulkCapability<N> {
  validateOptions(options);
  return Object.freeze({
    id: options.id,
    version: options.version,
    fidelity: "validated-bulk" as const,
    dependencies: Object.freeze([...options.dependencies]),
    plan: (context: BulkPlanContext<N>) => planProducerChain(context, options),
  });
}

function planProducerChain<N>(
  context: BulkPlanContext<N>,
  options: ProducerChainBulkOptions<N>,
): BulkPlanResult<N> {
  const numbers = context.definition.numbers;
  if (!numbers) return { eligible: false, reason: "numeric-adapter" };
  const definitionResources = new Set((context.definition.resources ?? []).map(({ id }) => id));
  const resources = [options.output, ...options.tiers];
  if (resources.some(({ id }) => !definitionResources.has(id)))
    return { eligible: false, reason: "unknown-resource" };
  if (resources.some((resource) => resource.capacity !== undefined || resource.capacityFor))
    return { eligible: false, reason: "resource-capacity" };
  const authoredReason = options.ineligibleReason?.(context.snapshot);
  if (authoredReason) return { eligible: false, reason: authoredReason };
  const steps = stepsBeforeAutomation(context, true);
  if (steps < 1)
    return {
      eligible: false,
      reason: "automation-boundary",
      retryAfterCanonicalSteps: 1,
    };
  try {
    const initial = resources.map(({ id }) => requiredValue(context.snapshot.resources, id));
    const coefficients = options.tiers.map((_, index) =>
      requireNonnegative(numbers, options.coefficient({ snapshot: context.snapshot, index })),
    );
    const result = advanceValues(numbers, initial, coefficients, steps);
    return {
      eligible: true,
      steps,
      apply(transaction) {
        applyValues(transaction, resources, result);
        advanceDisabledAutomation(transaction, context, steps);
      },
    };
  } catch (error) {
    return { eligible: false, reason: messageOf(error) };
  }
}

function advanceValues<N>(
  numbers: NumericAdapter<N>,
  initial: readonly N[],
  coefficients: readonly N[],
  steps: number,
): { readonly final: readonly N[]; readonly produced: readonly N[] } {
  const produced = initial.map((_, index) => {
    let result = numbers.fromNumber(0);
    let product = numbers.fromNumber(1);
    let binomial = 1n;
    const maximum = Math.min(steps, initial.length - index - 1);
    for (let distance = 1; distance <= maximum; distance += 1) {
      const coefficient = coefficients[index + distance - 1];
      const source = initial[index + distance];
      if (coefficient === undefined || source === undefined)
        throw new TypeError("incomplete-producer-chain");
      product = numbers.mul(product, coefficient);
      binomial = (binomial * BigInt(steps - distance + 1)) / BigInt(distance);
      result = numbers.add(
        result,
        numbers.mul(numbers.mul(source, product), numbers.fromString(binomial.toString())),
      );
    }
    if (!numbers.isFinite(result)) throw new TypeError("non-finite-producer-chain-result");
    return result;
  });
  return {
    final: initial.map((value, index) => {
      const amount = produced[index];
      if (amount === undefined) throw new TypeError("incomplete-producer-chain");
      return numbers.add(value, amount);
    }),
    produced,
  };
}

function applyValues<N>(
  transaction: Transaction<N>,
  resources: readonly Resource<N>[],
  result: { readonly final: readonly N[]; readonly produced: readonly N[] },
): void {
  resources.forEach((resource, index) => {
    const after = result.final[index];
    const produced = result.produced[index];
    if (after === undefined || produced === undefined)
      throw new TypeError("incomplete-producer-chain");
    transaction.set(resource, after);
    if (transaction.numbers.cmp(produced, transaction.numbers.fromNumber(0)) > 0)
      transaction.addProduction(resource.id, produced);
  });
}

function advanceDisabledAutomation<N>(
  transaction: Transaction<N>,
  context: BulkPlanContext<N>,
  steps: number,
): void {
  const finalGameMs = context.snapshot.gameTimeMs + steps * context.definition.stepMs;
  for (const automation of context.definition.automation ?? []) {
    const state = context.snapshot.progression.automation[automation.id] ?? {
      enabled: automation.initiallyEnabled,
      nextRunMs: automation.cadenceMs,
    };
    if (state.enabled) continue;
    const elapsedCadences = Math.max(
      0,
      Math.floor((finalGameMs - state.nextRunMs) / automation.cadenceMs) + 1,
    );
    transaction.setAutomation(automation.id, {
      enabled: false,
      nextRunMs: state.nextRunMs + elapsedCadences * automation.cadenceMs,
    });
  }
}

function validateOptions<N>(options: ProducerChainBulkOptions<N>): void {
  if (options.id.length === 0 || options.version.length === 0)
    throw new TypeError("Producer-chain bulk identity must be nonempty");
  if (options.tiers.length === 0) throw new TypeError("Producer-chain bulk requires a tier");
  const ids = [options.output.id, ...options.tiers.map(({ id }) => id)];
  if (new Set(ids).size !== ids.length)
    throw new TypeError("Producer-chain bulk resources must be unique");
}

function requireNonnegative<N>(numbers: NumericAdapter<N>, value: N): N {
  if (!numbers.isFinite(value) || numbers.cmp(value, numbers.fromNumber(0)) < 0)
    throw new TypeError("invalid-producer-chain-coefficient");
  return value;
}

function requiredValue<N>(values: Readonly<Record<string, N>>, id: string): N {
  const value = values[id];
  if (value === undefined) throw new TypeError(`missing-owned-value:${id}`);
  return value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
