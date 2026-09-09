import type { BuyableDefinition, Resource, Transaction } from "../../../packages/core/src/index.js";

type Resources = Readonly<Record<string, Resource<number>>>;
type Buyables = Readonly<Record<string, BuyableDefinition<number>>>;

export function updateIndustry(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  buyables: Buyables,
): void {
  if (!transaction.hasProgress("milestone", "industry-phase")) return;
  if (transaction.hasProgress("milestone", "space-phase")) return;
  updatePower(transaction, seconds, resources, buyables);
  convertMatter(transaction, seconds, resources, buyables);
  grantSwarmGifts(transaction, seconds, resources, buyables);
}

function updatePower(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  buyables: Buyables,
): void {
  const farms = count(transaction, buyables, "solarFarm");
  const batteries = count(transaction, buyables, "battery");
  const generated = farms * 5e12 * seconds;
  const capacity = Math.max(0, batteries * 1e16);
  transaction.set(
    required(resources, "storedPower"),
    Math.min(capacity, transaction.get(required(resources, "storedPower")) + generated),
  );
}

function convertMatter(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  buyables: Buyables,
): void {
  const harvesters = count(transaction, buyables, "harvester");
  const wireDrones = count(transaction, buyables, "wireDrone");
  const factories = count(transaction, buyables, "factory");
  const requiredPower = (harvesters + wireDrones + factories * 200) * 1e9 * seconds;
  const power = required(resources, "storedPower");
  const availablePower = transaction.get(power);
  const throttle = requiredPower <= 0 ? 0 : Math.min(1, availablePower / requiredPower);
  if (throttle <= 0) return;
  transaction.add(power, -requiredPower * throttle);
  harvest(transaction, seconds * throttle, resources, harvesters);
  extrude(transaction, seconds * throttle, resources, wireDrones);
  manufacture(transaction, seconds * throttle, resources, factories);
}

function harvest(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  harvesters: number,
): void {
  const source = required(resources, "availableMatter");
  const amount = Math.min(
    transaction.get(source),
    harvesters * droneMultiplier(transaction, resources, harvesters) * 2e20 * seconds,
  );
  transaction.add(source, -amount);
  transaction.add(required(resources, "acquiredMatter"), amount);
}

function extrude(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  drones: number,
): void {
  const source = required(resources, "acquiredMatter");
  const amount = Math.min(
    transaction.get(source),
    drones * droneMultiplier(transaction, resources, drones) * 1.5e20 * seconds,
  );
  transaction.add(source, -amount);
  transaction.add(required(resources, "processedMatter"), amount);
}

function manufacture(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  factories: number,
): void {
  const source = required(resources, "processedMatter");
  const boost = transaction.hasProgress("upgrade", "hyperspeed-factories")
    ? 1_000
    : transaction.hasProgress("upgrade", "upgraded-factories")
      ? 100
      : 1;
  const amount = Math.min(transaction.get(source), factories * boost * 1e20 * seconds);
  transaction.add(source, -amount);
  transaction.add(required(resources, "clips"), amount);
  transaction.addProduction(required(resources, "clips").id, amount);
}

function grantSwarmGifts(
  transaction: Transaction<number>,
  seconds: number,
  resources: Resources,
  buyables: Buyables,
): void {
  if (!transaction.hasProgress("upgrade", "swarm-computing")) return;
  const drones =
    count(transaction, buyables, "harvester") + count(transaction, buyables, "wireDrone");
  if (drones <= 0) return;
  const gifts = drones * seconds * 0.0005;
  transaction.add(required(resources, "swarmGifts"), gifts);
  transaction.add(required(resources, "creativity"), gifts * 50);
  transaction.add(required(resources, "yomi"), gifts * 20);
}

function droneMultiplier(
  transaction: Transaction<number>,
  resources: Resources,
  count: number,
): number {
  const rate = transaction.get(required(resources, "droneRateMultiplier"));
  const cohesion = transaction.get(required(resources, "droneBoost"));
  return rate * (cohesion > 1 ? cohesion * Math.floor(count) : 1);
}

function count(transaction: Transaction<number>, buyables: Buyables, id: string): number {
  const buyable = buyables[id];
  if (!buyable) throw new TypeError(`Missing Paperclips buyable: ${id}`);
  return transaction.getPurchase(buyable.id);
}

function required(resources: Resources, id: string): Resource<number> {
  const resource = resources[id];
  if (!resource) throw new TypeError(`Missing Paperclips resource: ${id}`);
  return resource;
}
