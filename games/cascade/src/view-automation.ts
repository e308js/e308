import { type EternityQuantity, eternityNumbers, type Snapshot } from "@e308/core";
import type { ActionBlocker, ViewNode } from "@e308/ux";
import { cascadeKit } from "./economy.js";
import type { CascadeIntent } from "./runtime.js";

const q = cascadeKit.q;

export function automationPanel(
  snapshot: Snapshot<EternityQuantity>,
): ViewNode<CascadeIntent, EternityQuantity>[] {
  return [
    automationAction(snapshot, "dimension", "Tier 1 autobuyer", 1, 5),
    automationAction(snapshot, "collapse", "Auto-collapse", 2, 30),
  ];
}

function automationAction(
  snapshot: Snapshot<EternityQuantity>,
  id: "dimension" | "collapse",
  label: string,
  requiredInfinity: number,
  cadenceSeconds: number,
): ViewNode<CascadeIntent, EternityQuantity> {
  const key = id === "dimension" ? "buy-tier-one" : "auto-collapse";
  const enabled = snapshot.progression.automation[key]?.enabled ?? false;
  const infinity = snapshot.resources["infinity-points"] as EternityQuantity;
  const drought =
    id === "dimension" && snapshot.progression.activeChallenges.includes("automation-drought");
  const available = eternityNumbers.cmp(infinity, q(requiredInfinity)) >= 0 && !drought;
  const blockers: ActionBlocker<EternityQuantity>[] = [];
  if (!available && !enabled) {
    if (drought) blockers.push({ kind: "disabled", actionId: key, reasonKey: "challenge-rule" });
    else
      blockers.push({
        kind: "insufficient",
        resourceId: "infinity-points",
        required: q(requiredInfinity),
        available: infinity,
      });
  }
  return {
    kind: "action",
    id: `automation-${id}`,
    action: {
      id: `automation-${id}`,
      label: `${enabled ? "Disable" : "Enable"} ${label}`,
      description: [
        {
          kind: "text",
          value:
            id === "dimension"
              ? `Buys one Tier 1 generator every ${cadenceSeconds} seconds when affordable.`
              : `Collapses every ${cadenceSeconds} seconds when the full reset requirement is met.`,
        },
      ],
      enabled: enabled || available,
      intent: { type: "automation", id, enabled: !enabled },
      blockers,
    },
  };
}
