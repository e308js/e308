import type {
  AllocationDefinition,
  Resource,
  Transaction,
} from "../../../packages/core/src/index.js";

type Resources = Readonly<Record<string, Resource<number>>>;

export function updateSpace(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  design: AllocationDefinition<number>,
): void {
  if (!transaction.hasProgress("milestone", "space-phase")) return;
  if (transaction.hasProgress("upgrade", "accept-exile")) return;
  advanceEnding(transaction, seconds, resources);
  if (transaction.get(required(resources, "dismantleStage")) >= 1) return;
  replicate(transaction, seconds, resources, design);
  explore(transaction, seconds, resources, design);
  buildClips(transaction, seconds, resources, design);
  fightDrifters(transaction, seconds, resources, design);
}

function replicate(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  design: AllocationDefinition<number>,
): void {
  const probes = required(resources, "probes");
  const current = transaction.get(probes);
  const replication = transaction.getAllocation(design.id, "replication");
  const hazard = transaction.getAllocation(design.id, "hazard");
  const births = current * replication * 0.008 * seconds;
  const hull = transaction.hasProgress("upgrade", "elliptic-hull-polytopes") ? 0.5 : 1;
  const losses = current * Math.max(0.00001, 0.0003 - hazard * 0.000025) * seconds * hull;
  transaction.add(required(resources, "hazardLosses"), losses);
  transaction.set(probes, Math.min(1e60, Math.max(0, current + births - losses)));
  const drifters = required(resources, "drifters");
  transaction.set(
    drifters,
    Math.min(1e60, transaction.get(drifters) + current * 0.00002 * seconds),
  );
}

function advanceEnding(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
): void {
  if (!transaction.hasProgress("upgrade", "reject-exile")) return;
  const stage = transaction.get(required(resources, "dismantleStage"));
  const increment = seconds * 100;
  if (stage <= 1) transaction.add(required(resources, "endingTimer1"), increment);
  if (stage === 2) transaction.add(required(resources, "endingTimer2"), increment);
  if (stage === 3) transaction.add(required(resources, "endingTimer3"), increment);
  if (stage >= 4 && stage <= 5) transaction.add(required(resources, "endingTimer4"), increment);
  if (stage === 6) transaction.add(required(resources, "endingTimer5"), increment);
  if (stage === 7 && transaction.get(required(resources, "wire")) === 0)
    transaction.add(required(resources, "endingTimer6"), increment);
}

function explore(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  design: AllocationDefinition<number>,
): void {
  const probes = transaction.get(required(resources, "probes"));
  const speed = transaction.getAllocation(design.id, "speed");
  const navigation = transaction.getAllocation(design.id, "navigation");
  const universe = required(resources, "universeMatter");
  const found = Math.min(
    transaction.get(universe),
    probes * Math.max(1, speed) * Math.max(1, navigation) * 2e35 * seconds,
  );
  transaction.add(universe, -found);
  transaction.add(required(resources, "foundMatter"), found);
  transaction.add(required(resources, "exploration"), found / 3e55);
}

function buildClips(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  design: AllocationDefinition<number>,
): void {
  const probes = transaction.get(required(resources, "probes"));
  const harvest = transaction.getAllocation(design.id, "harvester");
  const wire = transaction.getAllocation(design.id, "wire");
  const factory = transaction.getAllocation(design.id, "factory");
  const found = required(resources, "foundMatter");
  const acquired = required(resources, "acquiredMatter");
  const spaceWire = required(resources, "spaceWire");
  const harvested = Math.min(
    transaction.get(found),
    probes * Math.max(1, harvest) * 1e34 * seconds,
  );
  transaction.add(found, -harvested);
  transaction.add(acquired, harvested);
  const extruded = Math.min(transaction.get(acquired), probes * Math.max(1, wire) * 8e33 * seconds);
  transaction.add(acquired, -extruded);
  transaction.add(spaceWire, extruded);
  const made = Math.min(transaction.get(spaceWire), probes * Math.max(1, factory) * 5e33 * seconds);
  transaction.add(spaceWire, -made);
  transaction.add(required(resources, "clips"), made);
  transaction.addProduction(required(resources, "clips").id, made);
}

function fightDrifters(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  design: AllocationDefinition<number>,
): void {
  if (!transaction.hasProgress("upgrade", "combat")) return;
  const combat = transaction.getAllocation(design.id, "combat");
  const drifters = required(resources, "drifters");
  const killed = Math.min(
    transaction.get(drifters),
    transaction.get(required(resources, "probes")) * Math.max(1, combat) * 0.002 * seconds,
  );
  if (killed <= 0) return;
  transaction.add(drifters, -killed);
  transaction.add(required(resources, "honor"), killed * 0.01);
  transaction.add(required(resources, "battles"), 1);
}

function required(resources: Resources, id: string): Resource<number> {
  const resource = resources[id];
  if (!resource) throw new TypeError(`Missing Paperclips resource: ${id}`);
  return resource;
}
