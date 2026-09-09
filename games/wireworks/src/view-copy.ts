import type { Snapshot } from "@e308/core";

const projectCopy: Readonly<Record<string, string>> = {
  "bench-tools": "Raises every workshop machine to 1.25× efficiency.",
  storefront: "Adds 3 market reach, increasing demand recovery.",
  "demand-survey": "Adds 5 market reach and prepares the powered workshop.",
  "powered-extrusion": "Opens the power grid, adds 2 power, and expands storage.",
  "battery-bank": "Adds 3 power for the extrusion and assembly lines.",
  "assembler-line": "Adds 0.75× efficiency and expands storage.",
  "price-model": "Adds 7 market reach and opens an engineering doctrine choice.",
  "durable-drive": "Expands storage by three levels and adds 0.5× efficiency.",
  "throughput-drive": "Adds 4 power and 1× efficiency.",
  "autonomous-control": "Seeds one self-replicating drone and expands storage.",
  "drone-swarm": "Adds four drones to accelerate autonomous growth.",
  "orbital-contract": "Requires 10 drones and launches the first orbital relay.",
  "launch-array": "Requires 50 drones and launches two more orbital relays.",
  "final-expansion": "Requires 200 drones and completes the three-relay network.",
};

export function projectDescription(id: string): string {
  return projectCopy[id] ?? "Wireworks engineering project";
}

export function wireworksGoal(snapshot: Snapshot<number>): string {
  const upgrades = snapshot.progression.upgrades;
  if (snapshot.progression.won) return "Network complete: three orbital relays are online.";
  if (!upgrades["powered-extrusion"])
    return "Goal: grow workshop sales and unlock powered extrusion.";
  if (!upgrades["autonomous-control"])
    return "Goal: balance grid power, develop pricing, and seed autonomous control.";
  const drones = snapshot.resources.drones ?? 0;
  const probes = snapshot.resources.probes ?? 0;
  return `Goal: grow the drone network to 200 and launch three relays. Current: ${Math.floor(drones)} drones, ${probes} relays.`;
}

export function marketDescription(band: "volume" | "standard" | "premium"): string {
  if (band === "volume")
    return "Builds 1 market reach. Reach restores demand faster for future sales.";
  if (band === "standard") return "Adds 0.25 market reach with balanced inventory turnover.";
  return "Earns the most cash per clip and consumes the largest share of demand.";
}
