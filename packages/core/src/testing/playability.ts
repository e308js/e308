import type { HarnessTotals, MutablePressureMetric } from "./run-state.js";
import type {
  HarnessReport,
  HarnessValue,
  LegalActionQuote,
  PlayabilityFinding,
  PlayabilityPressure,
  PlayabilityThresholds,
  PressureMetric,
} from "./types.js";

type ReliefState = "actionable" | "saving" | "passive" | "none";

export function accumulatePressures<I extends HarnessValue>(
  totals: HarnessTotals<I>,
  pressures: readonly PlayabilityPressure[],
  quotes: readonly LegalActionQuote<I>[],
  elapsedMs: number,
): void {
  const seenIds = new Set<string>();
  const activeIds = new Set<string>();
  for (const metric of Object.values(totals.pressures)) metric.currentlyActive = false;
  for (const pressure of pressures) {
    validatePressure(pressure);
    if (seenIds.has(pressure.id)) throw new TypeError(`Duplicate pressure id: ${pressure.id}`);
    seenIds.add(pressure.id);
    if (!pressure.active) continue;
    activeIds.add(pressure.id);
    const metric = totals.pressures[pressure.id] ?? createMetric(pressure);
    if (metric.kind !== pressure.kind)
      throw new TypeError(`Pressure kind changed for ${pressure.id}`);
    totals.pressures[pressure.id] = metric;
    metric.currentlyActive = true;
    addElapsed(metric, reliefState(pressure, quotes), elapsedMs, passiveEstimate(pressure));
  }
  for (const [id, metric] of Object.entries(totals.pressures))
    if (!activeIds.has(id)) metric.currentNoReliefMs = 0;
}

export function pressureReport(
  pressures: Readonly<Record<string, MutablePressureMetric>>,
): Readonly<Record<string, PressureMetric>> {
  return Object.fromEntries(
    Object.entries(pressures).map(([id, { currentNoReliefMs: _, ...metric }]) => [id, metric]),
  );
}

export function assessPlayability<I extends HarnessValue>(
  report: HarnessReport<I>,
  thresholds: PlayabilityThresholds,
): readonly PlayabilityFinding[] {
  const findings: PlayabilityFinding[] = [];
  const maximumResetBurst = thresholds.maximumResetTransitionsAtSameGameTime;
  if (
    maximumResetBurst !== undefined &&
    report.playability.progression.maximumResetTransitionsAtSameGameTime > maximumResetBurst
  ) {
    findings.push({
      code: "compressed-reset-chain",
      severity: "p1",
      pressureId: null,
      detail: `${report.playability.progression.maximumResetTransitionsAtSameGameTime} reset transitions were available without advancing game time.`,
    });
  }
  const pressures = Object.entries(report.playability.pressures);
  const deadlockPressure = pressures.find(
    ([, metric]) =>
      metric.observedMs > thresholds.maximumNoReliefMs &&
      metric.currentlyActive &&
      metric.noReliefMs === metric.observedMs,
  );
  if (report.outcome.kind === "unreached" && deadlockPressure)
    findings.push({
      code: "goal-deadlock",
      severity: "p0",
      pressureId: deadlockPressure?.[0] ?? null,
      detail: "The goal is pending and no useful legal action or passive route is observable.",
    });
  for (const [id, metric] of pressures) {
    if (metric.longestNoReliefMs <= thresholds.maximumNoReliefMs) continue;
    if (id === deadlockPressure?.[0]) continue;
    findings.push({
      code: "sustained-no-relief",
      severity: "p1",
      pressureId: id,
      detail: metric.detail,
    });
  }
  return findings;
}

function createMetric(pressure: PlayabilityPressure): MutablePressureMetric {
  return {
    kind: pressure.kind,
    detail: pressure.detail,
    currentlyActive: true,
    observedMs: 0,
    actionableMs: 0,
    savingMs: 0,
    passiveMs: 0,
    noReliefMs: 0,
    currentNoReliefMs: 0,
    longestNoReliefMs: 0,
    maximumPassiveEstimateMs: 0,
  };
}

function addElapsed(
  metric: MutablePressureMetric,
  state: ReliefState,
  elapsedMs: number,
  estimateMs: number,
): void {
  metric.observedMs += elapsedMs;
  metric.maximumPassiveEstimateMs = Math.max(metric.maximumPassiveEstimateMs, estimateMs);
  if (state === "actionable") metric.actionableMs += elapsedMs;
  if (state === "saving") metric.savingMs += elapsedMs;
  if (state === "passive") metric.passiveMs += elapsedMs;
  if (state === "none") {
    metric.noReliefMs += elapsedMs;
    metric.currentNoReliefMs += elapsedMs;
    metric.longestNoReliefMs = Math.max(metric.longestNoReliefMs, metric.currentNoReliefMs);
  } else metric.currentNoReliefMs = 0;
}

function reliefState<I extends HarnessValue>(
  pressure: PlayabilityPressure,
  quotes: readonly LegalActionQuote<I>[],
): ReliefState {
  const actions = pressure.relief
    .filter((relief) => relief.kind === "action")
    .map((relief) => quotes.find((quote) => quote.id === relief.actionId))
    .filter((quote) => quote?.useful);
  if (actions.some((quote) => quote?.legal)) return "actionable";
  const investments = pressure.relief
    .filter((relief) => relief.kind === "investment")
    .map((relief) => quotes.find((quote) => quote.id === relief.actionId));
  if (investments.some((quote) => quote?.useful)) return "saving";
  if (pressure.relief.some((relief) => relief.kind === "passive" && relief.estimatedMs >= 0))
    return "passive";
  return "none";
}

function passiveEstimate(pressure: PlayabilityPressure): number {
  return Math.max(
    0,
    ...pressure.relief
      .filter((relief) => relief.kind === "passive" || relief.kind === "investment")
      .map((relief) => relief.estimatedMs),
  );
}

function validatePressure(pressure: PlayabilityPressure): void {
  if (pressure.id.trim() === "" || pressure.detail.trim() === "")
    throw new TypeError("Playability pressure id and detail must be non-empty");
  for (const relief of pressure.relief) {
    if (relief.kind === "action") {
      if (relief.actionId.trim() === "")
        throw new TypeError("Pressure action id must be non-empty");
      continue;
    }
    if (!Number.isFinite(relief.estimatedMs) || relief.estimatedMs < 0)
      throw new TypeError("Pressure relief estimate must be finite and non-negative");
    if (relief.kind === "investment" && relief.actionId.trim() === "")
      throw new TypeError("Pressure investment action id must be non-empty");
  }
}
