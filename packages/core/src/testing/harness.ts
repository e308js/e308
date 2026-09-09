import { deriveRandomState, Xoshiro128 } from "../random/xoshiro.js";
import type { Game, Snapshot } from "../state/types.js";
import { createTotals, type HarnessTotals } from "./run-state.js";
import type {
  BotDecision,
  ConstraintEvidence,
  GoalEvaluation,
  HarnessReport,
  HarnessRunOptions,
  HarnessTraceEntry,
  HarnessValue,
  LegalActionQuote,
  SessionKind,
} from "./types.js";
import { validateHarnessOptions, validateQuotes } from "./validation.js";

export function runHarness<N, O extends HarnessValue, I extends HarnessValue>(
  options: HarnessRunOptions<N, O, I>,
): HarnessReport<I> {
  validateHarnessOptions(options);
  return new HarnessRunner(options).run();
}

class HarnessRunner<N, O extends HarnessValue, I extends HarnessValue> {
  readonly #game: Game<N>;
  readonly #goal;
  readonly #random: Xoshiro128;
  readonly #totals: HarnessTotals<I> = createTotals();
  readonly #initialGameMs: number;
  #nextSampleMs = 0;

  constructor(readonly options: HarnessRunOptions<N, O, I>) {
    this.#game = options.scenario.create(options.gameSeed);
    const goal = options.scenario.goals.find((candidate) => candidate.id === options.goalId);
    if (!goal) throw new TypeError(`Unknown harness goal: ${options.goalId}`);
    this.#goal = goal;
    this.#random = new Xoshiro128(deriveRandomState(options.botSeed, ["harness-policy"]));
    this.#initialGameMs = this.#game.getSnapshot().gameTimeMs;
  }

  run(): HarnessReport<I> {
    this.recordState(this.#game.getSnapshot());
    let reached = this.reachedOutcome();
    for (const segment of this.options.schedule) {
      if (reached || this.#totals.workLimited) break;
      reached = this.runSegment(segment.kind, segment.durationMs);
    }
    return this.report(reached);
  }

  private runSegment(
    kind: SessionKind,
    durationMs: number,
  ): HarnessReport<I>["outcome"] | undefined {
    if (kind === "absent") return this.runAbsent(durationMs);
    let remaining = durationMs;
    while (remaining > 0 && !this.#totals.workLimited) {
      const chunk = Math.min(remaining, this.options.decisionCadenceMs);
      if (kind === "active") {
        this.decide(chunk);
        if (this.#totals.workLimited) break;
        this.recordState(this.#game.getSnapshot());
        const reached = this.reachedOutcome();
        if (reached) return reached;
      }
      const before = this.#game.getSnapshot();
      const result = this.#game.advance(chunk);
      if (!result.ok) throw new TypeError(`Harness advance failed: ${result.error.code}`);
      this.addTime(kind, chunk, before, result.value);
      remaining -= chunk;
      this.recordState(result.value);
      const reached = this.reachedOutcome();
      if (reached) return reached;
    }
    return undefined;
  }

  private runAbsent(durationMs: number): HarnessReport<I>["outcome"] | undefined {
    const before = this.#game.getSnapshot();
    const away = this.options.scenario.advanceAway?.(this.#game, durationMs);
    const result = away ?? canonicalAway(this.#game, durationMs);
    if (result.snapshot !== this.#game.getSnapshot())
      throw new TypeError("Away adapter must advance and return the supplied game snapshot");
    this.#totals.real += durationMs;
    this.#totals.absent += durationMs;
    this.#totals.discarded += result.discardedRealMs;
    this.#totals.banked += result.bankedRealMs;
    this.#totals.fidelity.add(result.fidelity);
    this.addDiagnostics(before, result.snapshot);
    this.recordState(result.snapshot);
    return this.reachedOutcome();
  }

  private decide(elapsedMs: number): void {
    if (this.#totals.decisions >= this.options.limits.maximumDecisions) {
      this.#totals.workLimited = true;
      return;
    }
    const snapshot = this.#game.getSnapshot();
    const quotes = this.options.scenario.quote(snapshot);
    validateQuotes(quotes);
    const decision = this.options.policy.decide({
      observation: this.options.scenario.observe(snapshot),
      quotes,
      goalId: this.options.goalId,
      realTimeMs: this.#totals.real,
      decision: this.#totals.decisions,
      random: () => this.#random.uniform(),
    });
    this.#totals.decisions += 1;
    if (decision.kind === "wait") {
      this.recordWait(elapsedMs, quotes, decision);
      return;
    }
    this.executeDecision(snapshot, quotes, decision);
  }

  private executeDecision(
    snapshot: Snapshot<N>,
    quotes: readonly LegalActionQuote<I>[],
    decision: BotDecision,
  ): void {
    this.#totals.attempts += 1;
    const quote = quotes.find((candidate) => candidate.id === decision.actionId);
    if (!quote) {
      this.recordAttempt(snapshot, decision.actionId ?? "", null, "missing-quote");
      return;
    }
    if (quote.revision !== snapshot.revision.toString()) {
      this.addConstraints([
        { kind: "policy", id: "stale-revision", detail: `quote revision ${quote.revision}` },
      ]);
      this.recordAttempt(snapshot, quote.id, quote, "stale-revision");
      return;
    }
    if (!quote.legal) {
      this.addConstraints(quote.constraints);
      this.recordAttempt(snapshot, quote.id, quote, "blocked");
      return;
    }
    const result = this.#game.dispatch(this.options.scenario.command(quote.intent, snapshot));
    if (result.ok) {
      this.addDiagnostics(snapshot, this.#game.getSnapshot());
      this.#totals.successful += 1;
      this.#totals.currentWait = 0;
      this.recordAttempt(snapshot, quote.id, quote, "success");
    } else {
      this.recordAttempt(snapshot, quote.id, quote, result.error.code);
    }
  }

  private recordWait(
    elapsedMs: number,
    quotes: readonly LegalActionQuote<I>[],
    decision: BotDecision,
  ): void {
    this.#totals.waits += 1;
    this.#totals.currentWait += elapsedMs;
    this.#totals.longestWait = Math.max(this.#totals.longestWait, this.#totals.currentWait);
    if (decision.reason)
      this.addConstraints([{ kind: "policy", id: decision.reason, detail: decision.reason }]);
    this.addConstraints(
      quotes.filter((quote) => !quote.legal).flatMap((quote) => quote.constraints),
    );
  }

  private recordAttempt(
    snapshot: Snapshot<N>,
    actionId: string,
    quote: LegalActionQuote<I> | null,
    result: HarnessTraceEntry<I>["result"],
  ): void {
    if (!quote) this.addConstraints([{ kind: "policy", id: "missing-quote", detail: actionId }]);
    const entry: HarnessTraceEntry<I> = {
      realTimeMs: this.#totals.real,
      gameTimeMs: snapshot.gameTimeMs,
      actionId,
      intent: quote?.intent ?? (null as I),
      sourceRevision: snapshot.revision.toString(),
      result,
    };
    if (this.#totals.trace.length < this.options.limits.maximumTraceEntries)
      this.#totals.trace.push(entry);
    else this.#totals.traceTruncated += 1;
  }

  private addTime(
    kind: "active" | "idle-open",
    elapsed: number,
    before: Snapshot<N>,
    after: Snapshot<N>,
  ) {
    this.#totals.real += elapsed;
    if (kind === "active") this.#totals.active += elapsed;
    else this.#totals.idle += elapsed;
    this.addDiagnostics(before, after);
  }

  private addDiagnostics(before: Snapshot<N>, after: Snapshot<N>): void {
    const added = this.options.scenario.diagnostics(before, after);
    this.#totals.diagnostics.overflow += added.overflow;
    this.#totals.diagnostics.resetRecoveries += added.resetRecoveries;
    this.#totals.diagnostics.taskBlocks += added.taskBlocks;
  }

  private addConstraints(values: readonly ConstraintEvidence[]): void {
    for (const value of values) {
      const key = `${value.kind}:${value.id}`;
      this.#totals.constraints[key] = (this.#totals.constraints[key] ?? 0) + 1;
    }
  }

  private recordState(snapshot: Snapshot<N>): void {
    for (const id of this.options.scenario.milestones(snapshot)) {
      this.#totals.milestones[id] ??= {
        realTimeMs: this.#totals.real,
        gameTimeMs: snapshot.gameTimeMs,
        activeTimeMs: this.#totals.active,
      };
    }
    if (this.#totals.real < this.#nextSampleMs) return;
    const sample = {
      realTimeMs: this.#totals.real,
      gameTimeMs: snapshot.gameTimeMs,
      values: this.options.scenario.sample(snapshot),
    };
    if (this.#totals.samples.length < this.options.limits.maximumSamples)
      this.#totals.samples.push(sample);
    else this.#totals.samplesTruncated += 1;
    this.#nextSampleMs = this.#totals.real + this.options.limits.sampleCadenceMs;
  }

  private reachedOutcome(): HarnessReport<I>["outcome"] | undefined {
    return this.#goal.evaluate(this.#game.getSnapshot()).kind === "reached"
      ? {
          kind: "reached",
          atRealMs: this.#totals.real,
          atGameMs: this.#game.getSnapshot().gameTimeMs,
        }
      : undefined;
  }

  private report(reached: HarnessReport<I>["outcome"] | undefined): HarnessReport<I> {
    const snapshot = this.#game.getSnapshot();
    const evaluation = this.#goal.evaluate(snapshot);
    const outcome =
      reached ??
      finalOutcome(evaluation, this.options.scenario.quote(snapshot), this.#totals.workLimited);
    const definition = this.options.scenario.definition;
    if (!definition.numbers) throw new TypeError("Harness definition has no numeric adapter");
    return {
      schema: "e308-pacing-report",
      schemaVersion: 1,
      scenarioId: this.options.scenario.id,
      contentVersion: this.options.scenario.contentVersion,
      contentDigest: this.options.scenario.contentDigest,
      parameters: this.options.scenario.parameters,
      simulationVersion: definition.simulationVersion,
      stepMs: definition.stepMs,
      numericAdapter: definition.numbers.id,
      numericImplementationVersion: definition.numbers.implementationVersion,
      gameSeed: this.options.gameSeed,
      botSeed: this.options.botSeed,
      policy: { id: this.options.policy.id, version: this.options.policy.version },
      goalId: this.options.goalId,
      schedule: this.options.schedule,
      decisionCadenceMs: this.options.decisionCadenceMs,
      limits: this.options.limits,
      outcome,
      timing: {
        realElapsedMs: this.#totals.real,
        gameAdvancedMs: snapshot.gameTimeMs - this.#initialGameMs,
        activePlayerMs: this.#totals.active,
        idleOpenMs: this.#totals.idle,
        absentMs: this.#totals.absent,
        discardedRealMs: this.#totals.discarded,
        bankedRealMs: this.#totals.banked,
        fidelity: [...this.#totals.fidelity],
      },
      actions: {
        attempts: this.#totals.attempts,
        successful: this.#totals.successful,
        decisions: this.#totals.decisions,
        waits: this.#totals.waits,
        longestWaitMs: this.#totals.longestWait,
      },
      constraints: this.#totals.constraints,
      milestones: this.#totals.milestones,
      diagnostics: this.#totals.diagnostics,
      trace: this.#totals.trace,
      traceTruncated: this.#totals.traceTruncated,
      samples: this.#totals.samples,
      samplesTruncated: this.#totals.samplesTruncated,
      replayCommand: this.options.replayCommand,
    };
  }
}

function canonicalAway<N>(game: Game<N>, durationMs: number) {
  const result = game.advance(durationMs);
  if (!result.ok) throw new TypeError(`Harness away advance failed: ${result.error.code}`);
  return {
    snapshot: result.value,
    fidelity: "canonical" as const,
    discardedRealMs: 0,
    bankedRealMs: 0,
  };
}

function finalOutcome<I extends HarnessValue>(
  evaluation: GoalEvaluation,
  quotes: readonly LegalActionQuote<I>[],
  workLimited: boolean,
): HarnessReport<I>["outcome"] {
  if (evaluation.kind === "certified-barrier")
    return { kind: "certified-barrier", certificate: evaluation.certificate };
  if (workLimited) return { kind: "unreached", reason: "work-limit" };
  if (quotes.some((quote) => quote.legal && quote.useful))
    return { kind: "unreached", reason: "policy-stall" };
  if (quotes.length > 0) return { kind: "unreached", reason: "observed-stall" };
  return { kind: "unreached", reason: "schedule-ended" };
}
