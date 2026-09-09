import type { Snapshot } from "../../../packages/core/src/index.js";
import type { ConstraintEvidence } from "../../../packages/core/src/testing/index.js";
import { paperclipsResources } from "./model.js";
import type { PaperclipsProject } from "./projects.js";

export function appendProjectTriggerConstraints(
  snapshot: Snapshot<number>,
  project: PaperclipsProject,
  constraints: ConstraintEvidence[],
): void {
  const trigger = project.trigger;
  if (project.id === "beg-for-more-wire") appendBegConstraint(snapshot, constraints);
  if (project.id === "creativity") {
    const memory = snapshot.allocations.compute?.memory ?? 0;
    if ((snapshot.resources.operations ?? 0) < memory * 1_000) {
      constraints.push({ kind: "other", id: "operations", detail: "memory capacity" });
    }
  }
  if (trigger?.kind === "resource") appendResourceTrigger(snapshot, trigger, constraints);
  if (trigger?.kind === "purchase") {
    const count = snapshot.purchaseCounts[trigger.id] ?? 0;
    if (count < trigger.minimum) appendSourceConstraint(constraints, trigger.id, trigger.minimum);
  }
  if (trigger?.kind === "purchase-total") {
    const total = trigger.ids.reduce((sum, id) => sum + (snapshot.purchaseCounts[id] ?? 0), 0);
    if (total < trigger.minimum)
      appendSourceConstraint(constraints, trigger.ids.join("+"), trigger.minimum);
  }
  const trust = snapshot.resources.trust as number;
  if (project.id === "token-of-goodwill" && (trust < 85 || trust >= 100)) {
    constraints.push({ kind: "other", id: "trust", detail: "source trigger 85–99" });
  }
  if (project.id === "another-token-of-goodwill") {
    if (trust >= 100)
      constraints.push({ kind: "other", id: "trust", detail: "source trigger below 100" });
    if ((snapshot.resources.funds as number) < (snapshot.resources.bribe as number)) {
      constraints.push({
        kind: "insufficient-input",
        id: "funds",
        detail: String(snapshot.resources.bribe),
      });
    }
  }
}

function appendResourceTrigger(
  snapshot: Snapshot<number>,
  trigger: { readonly id: string; readonly minimum: number },
  constraints: ConstraintEvidence[],
): void {
  const value =
    trigger.id === "processors"
      ? (snapshot.allocations.compute?.processors ?? 0)
      : (snapshot.resources[trigger.id] ?? 0);
  if (value < trigger.minimum) appendSourceConstraint(constraints, trigger.id, trigger.minimum);
}

function appendSourceConstraint(
  constraints: ConstraintEvidence[],
  id: string,
  minimum: number,
): void {
  constraints.push({ kind: "other", id, detail: `source trigger ${minimum}` });
}

function appendBegConstraint(snapshot: Snapshot<number>, constraints: ConstraintEvidence[]): void {
  const wireCost = snapshot.resources[paperclipsResources.wireCost.id] as number;
  const blocked =
    (snapshot.resources.bankroll as number) >= wireCost ||
    (snapshot.resources.funds as number) >= wireCost ||
    (snapshot.resources.wire as number) >= 1 ||
    (snapshot.resources[paperclipsResources.unsold.id] as number) >= 1 ||
    (snapshot.resources.trust as number) < -100;
  if (blocked)
    constraints.push({ kind: "other", id: "beg-for-more-wire", detail: "source trigger" });
}
