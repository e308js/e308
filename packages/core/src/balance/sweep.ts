import { runHarness } from "../testing/harness.js";
import type { HarnessScenario, HarnessValue } from "../testing/types.js";
import type { SweepOptions, SweepResult } from "./types.js";

export function runSweep<
  N,
  O extends HarnessValue,
  I extends HarnessValue,
  P extends Readonly<Record<string, HarnessValue>>,
>(options: SweepOptions<N, O, I, P>): readonly SweepResult<I>[] {
  validateSweep(options);
  const results: SweepResult<I>[] = [];
  for (const parameterCase of options.cases) {
    let scenario: HarnessScenario<N, O, I>;
    try {
      scenario = options.createScenario(parameterCase.parameters);
    } catch (error) {
      results.push({ kind: "invalid", caseId: parameterCase.id, message: messageOf(error) });
      continue;
    }
    for (const seeds of options.seeds) {
      for (const policy of options.policies) {
        const pairedKey = [seeds.gameSeed, seeds.botSeed, policy.id, options.goalId].join(":");
        try {
          results.push({
            kind: "valid",
            caseId: parameterCase.id,
            pairedKey,
            report: runHarness({
              scenario,
              policy,
              gameSeed: seeds.gameSeed,
              botSeed: seeds.botSeed,
              goalId: options.goalId,
              decisionCadenceMs: options.decisionCadenceMs,
              schedule: options.schedule,
              limits: options.limits,
              replayCommand: options.replayCommand(
                parameterCase.id,
                seeds.gameSeed,
                seeds.botSeed,
                policy.id,
              ),
            }),
          });
        } catch (error) {
          results.push({ kind: "invalid", caseId: parameterCase.id, message: messageOf(error) });
        }
      }
    }
  }
  return results;
}

function validateSweep<
  N,
  O extends HarnessValue,
  I extends HarnessValue,
  P extends Readonly<Record<string, HarnessValue>>,
>(options: SweepOptions<N, O, I, P>): void {
  if (options.cases.length === 0 || options.seeds.length === 0 || options.policies.length === 0)
    throw new TypeError("Sweep cases, seeds, and policies cannot be empty");
  const ids = new Set<string>();
  for (const value of options.cases) {
    if (!value.id || ids.has(value.id))
      throw new TypeError(`Invalid or duplicate sweep case: ${value.id}`);
    ids.add(value.id);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
