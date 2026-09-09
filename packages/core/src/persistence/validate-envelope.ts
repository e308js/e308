import { resolveModules } from "../model/modules.js";
import type {
  CatchupSession,
  OfflineProgressEvent,
  OfflineReport,
  ResolvedEntitlement,
  SaveEnvelope,
} from "./types.js";
import { validateTimedShape } from "./validate-timed.js";

const fidelities = new Set(["canonical", "validated-bulk", "approximate", "custom-reward"]);
const stopReasons = new Set(["choice", "cancelled", "error", "budget-exceeded"]);
const eventKinds = new Set(["upgrade", "milestone", "achievement", "challenge-reward", "win"]);
const envelopeFields = [
  "format",
  "formatVersion",
  "gameId",
  "stateSchemaVersion",
  "content",
  "simulation",
  "revision",
  "state",
  "clock",
  "rng",
  "catchup",
  "migrationLedger",
  "lastDeliveredEvent",
  "checksum",
] as const;
const simulationFields = [
  "version",
  "stepMs",
  "scheduleVersion",
  "numericAdapter",
  "numericImplementationVersion",
  "numericCodec",
] as const;
const scopeFields = [
  "generation",
  "resources",
  "purchaseCounts",
  "allocations",
  "automation",
  "upgrades",
  "milestones",
  "achievements",
  "activeChallenges",
  "challengeCompletions",
  "tasks",
  "calendars",
  "markets",
] as const;

export function validateEnvelope(envelope: SaveEnvelope): void {
  validateEnvelopeShape(envelope);
  if (!nonempty(envelope.gameId) || !positive(envelope.stateSchemaVersion))
    throw new TypeError("Invalid save identity");
  if (!nonempty(envelope.content.version) || !nonempty(envelope.content.digest))
    throw new TypeError("Invalid save content metadata");
  resolveModules(envelope.content.modules);
  const simulation = envelope.simulation;
  if (
    !positive(simulation.version) ||
    !positive(simulation.stepMs) ||
    !positive(simulation.scheduleVersion) ||
    !nonempty(simulation.numericAdapter) ||
    !nonempty(simulation.numericImplementationVersion) ||
    !nonempty(simulation.numericCodec.id) ||
    !positive(simulation.numericCodec.version)
  ) {
    throw new TypeError("Invalid save simulation metadata");
  }
  validateEntitlement(envelope.clock.entitlement);
  if (envelope.catchup) validateSession(envelope.catchup);
}

function validateEnvelopeShape(envelope: SaveEnvelope): void {
  exact(envelope, envelopeFields, "save envelope");
  exact(envelope.content, ["version", "digest", "modules"], "content metadata");
  for (const module of envelope.content.modules) {
    exact(module, ["id", "version", "requires"], "content module");
    for (const requirement of module.requires ?? [])
      exact(requirement, ["id", "range"], "module requirement");
  }
  exact(envelope.simulation, simulationFields, "simulation metadata");
  exact(envelope.simulation.numericCodec, ["id", "version"], "numeric codec");
  exact(envelope.clock, ["wallAnchorMs", "gameTimeMs", "remainderMs", "entitlement"], "clock");
  exact(
    envelope.state,
    ["scopes", "productionTotals", "rewardLedger", "won", "progressionEvents"],
    "state",
  );
  for (const scope of Object.values(envelope.state.scopes)) {
    exact(scope, scopeFields, "scope state");
    validateTimedShape(scope);
    for (const automation of Object.values(scope.automation))
      exact(automation, ["enabled", "nextRunMs"], "automation state");
  }
  exact(envelope.rng, ["algorithm", "derivation", "rootSeed", "streams"], "random state");
  for (const stream of envelope.rng.streams)
    exact(stream, ["path", "words", "draws"], "random stream");
  if (
    !duration(envelope.clock.wallAnchorMs) ||
    !duration(envelope.clock.gameTimeMs) ||
    !duration(envelope.clock.remainderMs)
  ) {
    throw new TypeError("Invalid save clock");
  }
}

function validateSession(session: CatchupSession): void {
  exact(
    session,
    [
      "sessionId",
      "startWallMs",
      "endWallMs",
      "entitlement",
      "eligibleRealMs",
      "processedRealMs",
      "pendingRealMs",
      "discardedRealMs",
      "bankedRealMs",
      "segments",
      "report",
      "deliveryCursor",
    ],
    "catch-up session",
  );
  if (!nonempty(session.sessionId) || !integerString(session.deliveryCursor))
    throw new TypeError("Invalid catch-up identity");
  validateEntitlement(session.entitlement);
  const durations = [
    session.startWallMs,
    session.endWallMs,
    session.eligibleRealMs,
    session.processedRealMs,
    session.pendingRealMs,
    session.discardedRealMs,
    session.bankedRealMs,
  ];
  if (durations.some((value) => !duration(value))) throw new TypeError("Invalid catch-up duration");
  if (session.endWallMs < session.startWallMs)
    throw new TypeError("Catch-up wall interval is invalid");
  if (session.processedRealMs + session.pendingRealMs !== session.eligibleRealMs)
    throw new TypeError("Catch-up accounting invariant failed");
  const elapsed = session.endWallMs - session.startWallMs;
  if (session.eligibleRealMs + session.discardedRealMs + session.bankedRealMs !== elapsed)
    throw new TypeError("Catch-up elapsed-time accounting failed");
  const segmentTotal = session.segments.reduce((sum, segment) => {
    exact(segment, ["simulationVersion", "processedRealMs"], "catch-up segment");
    if (!positive(segment.simulationVersion) || !positive(segment.processedRealMs))
      throw new TypeError("Invalid catch-up segment");
    return sum + segment.processedRealMs;
  }, 0);
  if (segmentTotal !== session.processedRealMs)
    throw new TypeError("Catch-up segment accounting failed");
  validateReport(session.report, session);
}

function validateReport(report: OfflineReport, session: CatchupSession): void {
  exact(
    report,
    [
      "sessionId",
      "elapsedRealMs",
      "eligibleRealMs",
      "processedRealMs",
      "pendingRealMs",
      "discardedRealMs",
      "bankedRealMs",
      "advancedGameMs",
      "fidelity",
      "resources",
      "progression",
      "stopReason",
    ],
    "catch-up report",
  );
  if (
    report.sessionId !== session.sessionId ||
    report.elapsedRealMs !== session.endWallMs - session.startWallMs ||
    report.eligibleRealMs !== session.eligibleRealMs ||
    report.processedRealMs !== session.processedRealMs ||
    report.pendingRealMs !== session.pendingRealMs ||
    report.discardedRealMs !== session.discardedRealMs ||
    report.bankedRealMs !== session.bankedRealMs ||
    !duration(report.advancedGameMs) ||
    !fidelities.has(report.fidelity) ||
    (report.stopReason !== undefined && !stopReasons.has(report.stopReason))
  ) {
    throw new TypeError("Catch-up report does not match its session");
  }
  const resourceIds = new Set<string>();
  for (const resource of report.resources) {
    exact(resource, ["id", "before", "after", "produced"], "resource report");
    if (
      !nonempty(resource.id) ||
      resourceIds.has(resource.id) ||
      typeof resource.before !== "string" ||
      typeof resource.after !== "string" ||
      (resource.produced !== undefined && typeof resource.produced !== "string")
    ) {
      throw new TypeError("Invalid catch-up resource report");
    }
    resourceIds.add(resource.id);
  }
  validateEvents(report.progression);
}

function validateEvents(events: readonly OfflineProgressEvent[]): void {
  if (!Array.isArray(events)) throw new TypeError("Invalid catch-up progression report");
  const ids = new Set<string>();
  for (const event of events) {
    exact(event, ["eventId", "kind", "id", "atGameMs"], "progression event");
    if (
      !nonempty(event.eventId) ||
      ids.has(event.eventId) ||
      !eventKinds.has(event.kind) ||
      !nonempty(event.id) ||
      !duration(event.atGameMs)
    ) {
      throw new TypeError("Invalid catch-up progression report");
    }
    ids.add(event.eventId);
  }
}

function validateEntitlement(entitlement: ResolvedEntitlement): void {
  exact(entitlement, ["policyVersion", "enabled", "capMs", "excess"], "offline entitlement");
  if (
    !nonempty(entitlement.policyVersion) ||
    typeof entitlement.enabled !== "boolean" ||
    (entitlement.capMs !== null && !duration(entitlement.capMs)) ||
    (entitlement.excess !== "discard" && entitlement.excess !== "bank")
  ) {
    throw new TypeError("Invalid offline entitlement");
  }
}

function exact(value: object, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new TypeError(`Unexpected ${label} field: ${unexpected}`);
}

function duration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function positive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonempty(value: string): boolean {
  return typeof value === "string" && value.length > 0;
}

function integerString(value: string): boolean {
  return typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value);
}
