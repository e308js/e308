import type { GameDefinition } from "../model/definition.js";
import { planAdvance } from "../simulation/clock.js";
import type { Game, Snapshot } from "../state/types.js";
import { nativeAffineCapability } from "./affine.js";
import type {
  AdvancementFidelity,
  AdvancementMode,
  AdvancementOptions,
  AdvancementReport,
  AdvancementSegment,
  BulkCapability,
  BulkPlanResult,
} from "./types.js";

export function advanceOptimized<N>(
  game: Game<N>,
  definition: GameDefinition<N>,
  elapsedMs: number,
  options: AdvancementOptions<N>,
): AdvancementReport<N> {
  if (game.getDefinition() !== definition)
    throw new TypeError("Game and optimizer definition must have identical ownership");
  const mode = options.mode ?? "exact";
  validateInputs(elapsedMs, options, mode);
  const capabilities = capabilitiesFor(definition, options.capabilities ?? []);
  const state: MutableRun = {
    remaining: elapsedMs,
    processed: 0,
    work: 0,
    bulkBatches: 0,
    diagnostics: [],
    segments: [],
  };
  while (state.remaining > 0) {
    const snapshot = game.getSnapshot();
    const advancePlan = planAdvance(snapshot, state.remaining, definition.stepMs);
    if (advancePlan.steps === 0) {
      const tail = game.advance(state.remaining);
      if (!tail.ok) return failedFromState(game, mode, elapsedMs, state, tail.error.code);
      state.processed += state.remaining;
      state.remaining = 0;
      break;
    }
    const selection =
      mode === "canonical" || state.bulkBatches >= options.limits.maximumBulkBatches
        ? {}
        : selectPlan(
            capabilities,
            mode,
            definition,
            snapshot,
            advancePlan.steps,
            state.diagnostics,
          );
    const selected = selection.selected;
    if (selected) {
      if (state.work >= options.limits.maximumWork) break;
      const error = applyBulk(
        game,
        definition.stepMs,
        snapshot,
        advancePlan.steps,
        selected,
        state,
      );
      if (error) return failedFromState(game, mode, elapsedMs, state, error);
      continue;
    }
    if (state.work >= options.limits.maximumWork) break;
    const steps = Math.min(
      selection.retryAfterCanonicalSteps ?? Number.POSITIVE_INFINITY,
      canonicalBatchSteps(
        definition,
        snapshot,
        advancePlan.steps,
        options.limits.maximumWork - state.work,
      ),
    );
    const error = applyCanonical(game, definition.stepMs, snapshot, steps, state);
    if (error) return failedFromState(game, mode, elapsedMs, state, error);
  }
  return reportFromState(game, mode, elapsedMs, state);
}

function canonicalBatchSteps<N>(
  definition: GameDefinition<N>,
  snapshot: Snapshot<N>,
  requested: number,
  availableWork: number,
): number {
  let steps = Math.min(requested, availableWork);
  for (const automation of definition.automation ?? []) {
    const next = snapshot.progression.automation[automation.id]?.nextRunMs ?? automation.cadenceMs;
    const throughBoundary = Math.max(
      1,
      Math.ceil((next - snapshot.gameTimeMs) / definition.stepMs),
    );
    steps = Math.min(steps, throughBoundary);
  }
  return steps;
}

interface MutableRun {
  remaining: number;
  processed: number;
  work: number;
  bulkBatches: number;
  readonly diagnostics: string[];
  readonly segments: AdvancementSegment[];
}

type SelectedPlan<N> = {
  readonly capability: BulkCapability<N>;
  readonly plan: Extract<BulkPlanResult<N>, { eligible: true }>;
};

interface PlanSelection<N> {
  readonly selected?: SelectedPlan<N>;
  readonly retryAfterCanonicalSteps?: number;
}

function applyBulk<N>(
  game: Game<N>,
  stepMs: number,
  snapshot: Snapshot<N>,
  requestedSteps: number,
  selected: SelectedPlan<N>,
  state: MutableRun,
): string | undefined {
  const consumed =
    selected.plan.steps === requestedSteps
      ? state.remaining
      : selected.plan.steps * stepMs - snapshot.remainderMs;
  const result = game.advanceCustom(consumed, selected.plan.apply);
  if (!result.ok) return result.error.code;
  state.work += 1;
  state.bulkBatches += 1;
  state.processed += consumed;
  state.remaining -= consumed;
  state.segments.push({
    kind: "bulk",
    fidelity: selected.capability.fidelity,
    capabilityId: selected.capability.id,
    capabilityVersion: selected.capability.version,
    ...(selected.capability.approximation
      ? { approximation: selected.capability.approximation }
      : {}),
    sourceRevision: snapshot.revision.toString(),
    resultRevision: result.value.revision.toString(),
    steps: selected.plan.steps,
    gameMs: selected.plan.steps * stepMs,
  });
  return undefined;
}

function applyCanonical<N>(
  game: Game<N>,
  stepMs: number,
  snapshot: Snapshot<N>,
  steps: number,
  state: MutableRun,
): string | undefined {
  const complete = steps === planAdvance(snapshot, state.remaining, stepMs).steps;
  const consumed = complete ? state.remaining : steps * stepMs - snapshot.remainderMs;
  const result = game.advance(consumed);
  if (!result.ok) return result.error.code;
  state.work += steps;
  state.processed += consumed;
  state.remaining -= consumed;
  state.segments.push({
    kind: "canonical",
    fidelity: "canonical",
    sourceRevision: snapshot.revision.toString(),
    resultRevision: result.value.revision.toString(),
    steps,
    gameMs: stepMs * steps,
  });
  return undefined;
}

function capabilitiesFor<N>(
  definition: GameDefinition<N>,
  custom: readonly BulkCapability<N>[],
): readonly BulkCapability<N>[] {
  const builtIn = nativeAffineCapability as unknown as BulkCapability<N>;
  const values = [...custom, builtIn];
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) throw new TypeError(`Duplicate bulk capability: ${value.id}`);
    ids.add(value.id);
    if (value.fidelity === "approximate" && !value.approximation)
      throw new TypeError(`Approximate capability ${value.id} requires an error declaration`);
    if (value.fidelity === "validated-bulk" && value.approximation)
      throw new TypeError(`Exact capability ${value.id} cannot declare approximation error`);
  }
  void definition;
  return values;
}

function selectPlan<N>(
  capabilities: readonly BulkCapability<N>[],
  mode: AdvancementMode,
  definition: GameDefinition<N>,
  snapshot: Snapshot<N>,
  requestedSteps: number,
  diagnostics: string[],
): PlanSelection<N> {
  let retryAfterCanonicalSteps: number | undefined;
  for (const capability of capabilities) {
    if (capability.fidelity === "approximate" && mode !== "approximate") continue;
    try {
      const plan = capability.plan({ definition, snapshot, requestedSteps });
      if (!plan.eligible) {
        diagnostics.push(`${capability.id}:${plan.reason}`);
        if (plan.retryAfterCanonicalSteps !== undefined) {
          const retry = plan.retryAfterCanonicalSteps;
          if (Number.isSafeInteger(retry) && retry > 0)
            retryAfterCanonicalSteps = Math.min(
              retryAfterCanonicalSteps ?? Number.POSITIVE_INFINITY,
              retry,
            );
          else diagnostics.push(`${capability.id}:invalid-retry-bound`);
        }
        continue;
      }
      if (!Number.isSafeInteger(plan.steps) || plan.steps < 1 || plan.steps > requestedSteps) {
        diagnostics.push(`${capability.id}:invalid-step-count`);
        continue;
      }
      return {
        selected: { capability, plan },
        ...(retryAfterCanonicalSteps === undefined ? {} : { retryAfterCanonicalSteps }),
      };
    } catch (error) {
      diagnostics.push(`${capability.id}:planner-threw:${messageOf(error)}`);
    }
  }
  return retryAfterCanonicalSteps === undefined ? {} : { retryAfterCanonicalSteps };
}

function report<N>(
  game: Game<N>,
  mode: AdvancementMode,
  requested: number,
  processed: number,
  pending: number,
  work: number,
  segments: readonly AdvancementSegment[],
  diagnostics: readonly string[],
): AdvancementReport<N> {
  return {
    status: pending === 0 ? "completed" : "pending",
    mode,
    fidelity: overallFidelity(segments),
    snapshot: game.getSnapshot(),
    requestedRealMs: requested,
    processedRealMs: processed,
    pendingRealMs: pending,
    workUsed: work,
    canonicalSteps: segments
      .filter((segment) => segment.kind === "canonical")
      .reduce((sum, segment) => sum + segment.steps, 0),
    bulkSteps: segments
      .filter((segment) => segment.kind === "bulk")
      .reduce((sum, segment) => sum + segment.steps, 0),
    diagnostics: [...diagnostics],
    segments: [...segments],
  };
}

function reportFromState<N>(
  game: Game<N>,
  mode: AdvancementMode,
  requested: number,
  state: MutableRun,
): AdvancementReport<N> {
  return report(
    game,
    mode,
    requested,
    state.processed,
    state.remaining,
    state.work,
    state.segments,
    state.diagnostics,
  );
}

function failedFromState<N>(
  game: Game<N>,
  mode: AdvancementMode,
  requested: number,
  state: MutableRun,
  error: string,
): AdvancementReport<N> {
  return {
    ...reportFromState(game, mode, requested, state),
    status: "failed",
    error,
  };
}

function overallFidelity(segments: readonly AdvancementSegment[]): AdvancementFidelity {
  if (segments.some((segment) => segment.fidelity === "approximate")) return "approximate";
  if (segments.some((segment) => segment.fidelity === "validated-bulk")) return "validated-bulk";
  return "canonical";
}

function validateInputs<N>(
  elapsedMs: number,
  options: AdvancementOptions<N>,
  mode: AdvancementMode,
): void {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
    throw new TypeError("Optimized elapsed time must be a nonnegative safe integer");
  if (!["canonical", "exact", "approximate"].includes(mode))
    throw new TypeError(`Unknown advancement mode: ${mode}`);
  for (const value of [options.limits.maximumWork, options.limits.maximumBulkBatches]) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new TypeError("Advancement limits must be positive safe integers");
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
