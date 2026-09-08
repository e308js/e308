import type { ExcessTimePolicy, ResolvedEntitlement } from "../persistence/types.js";
import type { Snapshot } from "../state/types.js";

export interface OfflinePolicy<N> {
  readonly policyVersion: string;
  readonly enabled: boolean | ((snapshot: Snapshot<N>) => boolean);
  readonly cap:
    | { readonly kind: "unlimited" }
    | { readonly kind: "duration"; readonly milliseconds: number }
    | { readonly kind: "dynamic"; readonly resolve: (snapshot: Snapshot<N>) => number | null };
  readonly excess: ExcessTimePolicy;
}

export function resolveEntitlement<N>(
  policy: OfflinePolicy<N>,
  snapshot: Snapshot<N>,
): ResolvedEntitlement {
  if (!policy.policyVersion) throw new TypeError("Offline policy version is required");
  const enabled = typeof policy.enabled === "function" ? policy.enabled(snapshot) : policy.enabled;
  const capMs = resolveCap(policy, snapshot);
  if (capMs !== null && (!Number.isSafeInteger(capMs) || capMs < 0))
    throw new TypeError("Offline cap must be null or a nonnegative safe integer");
  return Object.freeze({
    policyVersion: policy.policyVersion,
    enabled,
    capMs,
    excess: policy.excess,
  });
}

function resolveCap<N>(policy: OfflinePolicy<N>, snapshot: Snapshot<N>): number | null {
  if (policy.cap.kind === "unlimited") return null;
  if (policy.cap.kind === "duration") return policy.cap.milliseconds;
  return policy.cap.resolve(snapshot);
}
