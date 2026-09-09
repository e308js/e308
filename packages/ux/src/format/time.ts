import type { EtaView } from "../view/models.js";

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0)
    throw new RangeError("duration must be finite and nonnegative");
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${rounded(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${rounded(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${rounded(hours)}h`;
  return `${rounded(hours / 24)}d`;
}

export function formatEta(eta: EtaView): string {
  switch (eta.kind) {
    case "finite":
      return `${formatDuration(eta.ms)} ${eta.clock}`;
    case "blocked":
      return typeof eta.reason === "string" ? eta.reason : eta.reason.key;
    case "capacity-unreachable":
      return `unreachable (${eta.proofScope})`;
    case "unknown":
      return "unknown";
  }
}

function rounded(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}
