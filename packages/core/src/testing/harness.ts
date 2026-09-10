import { deriveRandomState, Xoshiro128 } from "../random/xoshiro.js";
import type { Game, Snapshot } from "../state/types.js";
import { accumulatePressures } from "./playability.js";
import { buildHarnessReport } from "./report-builder.js";
import { createTotals, type HarnessTotals } from "./run-state.js";
import type {
  BotDecision,
  ConstraintEvidence,
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
        this.decideBurst(chunk);
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

  private decideBurst(elapsedMs: number): void {
    const maximum =
      this.options.maximumImmediateActions ?? (this.options.actionSpace === "complete" ? 64 : 1);
    for (let action = 0; action < maximum && !this.#totals.workLimited; action += 1) {
      if (!this.decide(elapsedMs)) return;
    }
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

  private decide(elapsedMs: number): boolean {
    if (this.#totals.decisions >= this.options.limits.maximumDecisions) {
      this.#totals.workLimited = true;
      return false;
    }
    const snapshot = this.#game.getSnapshot();
    const quotes = this.quotes(snapshot);
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
      return false;
    }
    return this.executeDecision(snapshot, quotes, decision);
  }

  private executeDecision(
    snapshot: Snapshot<N>,
    quotes: readonly LegalActionQuote<I>[],
    decision: BotDecision,
  ): boolean {
    this.#totals.attempts += 1;
    const quote = quotes.find((candidate) => candidate.id === decision.actionId);
    if (!quote) {
      this.recordAttempt(snapshot, decision.actionId ?? "", null, "missing-quote");
      return false;
    }
    if (quote.revision !== snapshot.revision.toString()) {
      this.addConstraints([
        { kind: "policy", id: "stale-revision", detail: `quote revision ${quote.revision}` },
      ]);
      this.recordAttempt(snapshot, quote.id, quote, "stale-revision");
      return false;
    }
    if (!quote.legal) {
      this.addConstraints(quote.constraints);
      this.recordAttempt(snapshot, quote.id, quote, "blocked");
      return false;
    }
    const command = this.options.scenario.command(quote.intent, snapshot);
    const result = this.#game.dispatch(command);
    if (result.ok) {
      const after = this.#game.getSnapshot();
      this.addDiagnostics(snapshot, after);
      this.recordResetTransition(snapshot, after, quote);
      this.#totals.successful += 1;
      this.#totals.currentWait = 0;
      this.recordAttempt(snapshot, quote.id, quote, "success");
      this.recordState(after);
      return this.#goal.evaluate(after).kind !== "reached";
    } else {
      this.recordAttempt(snapshot, quote.id, quote, result.error.code);
      return false;
    }
  }

  private recordResetTransition(
    before: Snapshot<N>,
    after: Snapshot<N>,
    quote: LegalActionQuote<I>,
  ): void {
    if (!quote.effects?.includes("progression-reset")) return;
    const scopeIds = new Set([
      ...Object.keys(before.scopeGenerations),
      ...Object.keys(after.scopeGenerations),
    ]);
    const reset = [...scopeIds].some(
      (id) => (after.scopeGenerations[id] ?? 0) > (before.scopeGenerations[id] ?? 0),
    );
    if (!reset) return;
    this.#totals.resetTransitions += 1;
    if (this.#totals.lastResetGameMs === after.gameTimeMs) this.#totals.currentResetBurst += 1;
    else this.#totals.currentResetBurst = 1;
    this.#totals.lastResetGameMs = after.gameTimeMs;
    this.#totals.maximumResetBurst = Math.max(
      this.#totals.maximumResetBurst,
      this.#totals.currentResetBurst,
    );
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
    if (this.options.scenario.pressures) {
      const pressures = this.options.scenario.pressures(before);
      const quotes = this.quotes(before);
      validateQuotes(quotes);
      accumulatePressures(this.#totals, pressures, quotes, elapsed);
    }
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

  private quotes(snapshot: Snapshot<N>): readonly LegalActionQuote<I>[] {
    if (this.options.actionSpace === "complete") {
      const quoteAll = this.options.scenario.quoteAll;
      if (!quoteAll) throw new TypeError("Complete action-space runs require scenario.quoteAll");
      return quoteAll(snapshot);
    }
    return this.options.scenario.quote(snapshot);
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
    if (this.options.scenario.pressures)
      accumulatePressures(
        this.#totals,
        this.options.scenario.pressures(snapshot),
        this.quotes(snapshot),
        0,
      );
    return buildHarnessReport({
      run: this.options,
      totals: this.#totals,
      snapshot,
      initialGameMs: this.#initialGameMs,
      reached,
      evaluation: this.#goal.evaluate(snapshot),
      quotes: this.quotes(snapshot),
    });
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
