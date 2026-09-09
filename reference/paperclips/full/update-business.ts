import type {
  AllocationDefinition,
  BuyableDefinition,
  Resource,
  Transaction,
} from "../../../packages/core/src/index.js";

type BusinessResources = Readonly<Record<string, Resource<number>>>;
type BusinessBuyables = Readonly<Record<string, BuyableDefinition<number>>>;

export function updateBusiness(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
  buyables: BusinessBuyables,
  compute: AllocationDefinition<number>,
): void {
  if (!transaction.hasProgress("milestone", "industry-phase")) {
    maintainWire(transaction, resources);
    produceClips(transaction, seconds, resources, buyables);
    sellInventory(transaction, seconds, resources);
  }
  runCompute(transaction, seconds, resources, compute);
  runInvestments(transaction, seconds, resources);
  awardTrust(transaction, resources);
}

function maintainWire(transaction: Transaction<number>, resources: BusinessResources): void {
  if (!transaction.hasProgress("upgrade", "wire-buyer")) return;
  const wire = required(resources, "wire");
  const supply = required(resources, "wireSupply");
  const funds = required(resources, "funds");
  const cost = required(resources, "wireCost");
  if (transaction.get(wire) >= transaction.get(supply) / 2) return;
  if (transaction.get(funds) < transaction.get(cost)) return;
  transaction.add(funds, -transaction.get(cost));
  transaction.add(wire, transaction.get(supply));
}

function produceClips(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
  buyables: BusinessBuyables,
): void {
  const auto = transaction.getPurchase(requiredBuyable(buyables, "autoClipper").id);
  const mega = transaction.getPurchase(requiredBuyable(buyables, "megaClipper").id);
  const boost = clipperBoost(transaction);
  const possible = (auto + mega * 500) * boost * seconds;
  const produced = Math.min(transaction.get(required(resources, "wire")), possible);
  if (produced <= 0) return;
  transaction.add(required(resources, "wire"), -produced);
  transaction.add(required(resources, "clips"), produced);
  transaction.add(required(resources, "unsold"), produced);
  transaction.addProduction(required(resources, "clips").id, produced);
}

function sellInventory(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
): void {
  const price = transaction.get(required(resources, "price"));
  const marketing = transaction.get(required(resources, "marketingLevel"));
  const baseDemand = transaction.get(required(resources, "demand"));
  const demanded = Math.max(0, baseDemand * marketing ** 1.1 * (0.25 / price) ** 1.15 * seconds);
  const sold = Math.min(transaction.get(required(resources, "unsold")), demanded);
  if (sold <= 0) return;
  transaction.add(required(resources, "unsold"), -sold);
  transaction.add(required(resources, "funds"), sold * price);
}

function runCompute(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
  compute: AllocationDefinition<number>,
): void {
  const processors = transaction.getAllocation(compute.id, "processors");
  const memory = transaction.getAllocation(compute.id, "memory");
  const capacity =
    memory * (transaction.hasProgress("upgrade", "quantum-computing") ? 10_000 : 1_000);
  const current = transaction.get(required(resources, "operations"));
  const next = Math.min(capacity, current + processors * 10 * seconds);
  transaction.set(required(resources, "operations"), next);
  if (transaction.hasProgress("upgrade", "creativity") && next >= capacity) {
    transaction.add(
      required(resources, "creativity"),
      Math.sqrt(Math.max(1, processors)) * seconds,
    );
  }
}

function runInvestments(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
): void {
  if (!transaction.hasProgress("upgrade", "algorithmic-trading")) return;
  const bankroll = transaction.get(required(resources, "bankroll"));
  if (bankroll <= 0) return;
  const level = transaction.get(required(resources, "investmentLevel"));
  const noise = transaction.random(["investment-market"]).uniform() - 0.48;
  transaction.set(
    required(resources, "bankroll"),
    Math.max(0, bankroll * (1 + (0.0002 + noise * 0.0005) * (1 + level) * seconds)),
  );
}

function awardTrust(transaction: Transaction<number>, resources: BusinessResources): void {
  const clips = transaction.get(required(resources, "clips"));
  const earned = 2 + trustThresholdsReached(clips);
  if (earned > transaction.get(required(resources, "trust"))) {
    transaction.set(required(resources, "trust"), earned);
  }
}

function trustThresholdsReached(clips: number): number {
  let previous = 2_000;
  let threshold = 3_000;
  let reached = 0;
  while (clips >= threshold && reached < 100) {
    reached += 1;
    const next = previous + threshold;
    previous = threshold;
    threshold = next;
  }
  return reached;
}

function clipperBoost(transaction: Transaction<number>): number {
  let boost = 1;
  if (transaction.hasProgress("upgrade", "improved-auto-clippers")) boost += 0.25;
  if (transaction.hasProgress("upgrade", "even-better-auto-clippers")) boost += 0.5;
  if (transaction.hasProgress("upgrade", "optimized-auto-clippers")) boost += 0.75;
  return boost;
}

function required(resources: BusinessResources, id: string): Resource<number> {
  const resource = resources[id];
  if (!resource) throw new TypeError(`Missing Paperclips resource: ${id}`);
  return resource;
}

function requiredBuyable(buyables: BusinessBuyables, id: string): BuyableDefinition<number> {
  const buyable = buyables[id];
  if (!buyable) throw new TypeError(`Missing Paperclips buyable: ${id}`);
  return buyable;
}
