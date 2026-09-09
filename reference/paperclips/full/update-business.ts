import type {
  AllocationDefinition,
  BuyableDefinition,
  Resource,
  Transaction,
} from "../../../packages/core/src/index.js";
import { advanceAutomaticTick } from "./automatic-production.js";
import { advanceRetailTick } from "./retail.js";

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
    runRetailSchedule(transaction, seconds, resources, buyables);
  }
  runCompute(transaction, seconds, resources, compute);
  runInvestments(transaction, seconds, resources);
  awardTrust(transaction, seconds, resources);
}

function runRetailSchedule(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
  buyables: BusinessBuyables,
): void {
  const ticks = Math.round(seconds / 0.1);
  for (let index = 0; index < ticks; index += 1) {
    runMainTicks(transaction, 0.1, resources, buyables);
    runRetailTick(transaction, resources);
  }
}

function runMainTicks(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
  buyables: BusinessBuyables,
): void {
  const ticks = Math.round(seconds / 0.01);
  const clips = required(resources, "clips");
  const initialClips = transaction.get(clips);
  let state = {
    clips: initialClips,
    funds: transaction.get(required(resources, "funds")),
    unsoldClips: transaction.get(required(resources, "unsold")),
    wire: transaction.get(required(resources, "wire")),
    wireBasePrice: transaction.get(required(resources, "wireBasePrice")),
    wirePriceTimer: transaction.get(required(resources, "wirePriceTimer")),
  };
  const config = automaticConfig(transaction, resources, buyables);
  for (let index = 0; index < ticks; index += 1) {
    state = advanceAutomaticTick(state, config);
  }
  transaction.set(clips, state.clips);
  transaction.set(required(resources, "funds"), state.funds);
  transaction.set(required(resources, "unsold"), state.unsoldClips);
  transaction.set(required(resources, "wire"), state.wire);
  transaction.set(required(resources, "wireBasePrice"), state.wireBasePrice);
  transaction.set(required(resources, "wirePriceTimer"), state.wirePriceTimer);
  transaction.addProduction(clips.id, state.clips - initialClips);
  updateDemand(transaction, resources);
}

function automaticConfig(
  transaction: Transaction<number>,
  resources: BusinessResources,
  buyables: BusinessBuyables,
) {
  const auto = transaction.getPurchase(requiredBuyable(buyables, "autoClipper").id);
  const mega = transaction.getPurchase(requiredBuyable(buyables, "megaClipper").id);
  return {
    autoPerTick: transaction.get(required(resources, "autoClipperBoost")) * (auto / 100),
    megaPerTick: mega * 5 * transaction.get(required(resources, "megaClipperBoost")),
    wireBuyer: transaction.hasProgress("upgrade", "wire-buyer"),
    wireCost: transaction.get(required(resources, "wireCost")),
    wireSupply: transaction.get(required(resources, "wireSupply")),
  };
}

function updateDemand(transaction: Transaction<number>, resources: BusinessResources): void {
  const marketing = 1.1 ** (transaction.get(required(resources, "marketingLevel")) - 1);
  const base =
    (0.8 / transaction.get(required(resources, "price"))) *
    marketing *
    transaction.get(required(resources, "marketingEffectiveness")) *
    transaction.get(required(resources, "demandBoost"));
  const prestige = transaction.get(required(resources, "universePrestige"));
  transaction.set(required(resources, "demand"), base + (base / 10) * prestige);
}

function runRetailTick(transaction: Transaction<number>, resources: BusinessResources): void {
  const random = transaction.random(["retail"]);
  const state = advanceRetailTick(readRetailState(transaction, resources), {
    wire: random.uniform(),
    sale: random.uniform(),
  });
  transaction.set(required(resources, "funds"), state.funds);
  transaction.set(required(resources, "unsold"), state.unsoldClips);
  transaction.set(required(resources, "wireBasePrice"), state.wireBasePrice);
  transaction.set(required(resources, "wireCost"), state.wireCost);
  transaction.set(required(resources, "wirePriceCounter"), state.wirePriceCounter);
  transaction.set(required(resources, "wirePriceTimer"), state.wirePriceTimer);
}

function readRetailState(transaction: Transaction<number>, resources: BusinessResources) {
  return {
    demand: transaction.get(required(resources, "demand")),
    funds: transaction.get(required(resources, "funds")),
    margin: transaction.get(required(resources, "price")),
    unsoldClips: transaction.get(required(resources, "unsold")),
    wireBasePrice: transaction.get(required(resources, "wireBasePrice")),
    wireCost: transaction.get(required(resources, "wireCost")),
    wirePriceCounter: transaction.get(required(resources, "wirePriceCounter")),
    wirePriceTimer: transaction.get(required(resources, "wirePriceTimer")),
  };
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

function awardTrust(
  transaction: Transaction<number>,
  seconds: number,
  resources: BusinessResources,
): void {
  const clips = transaction.get(required(resources, "clips"));
  const nextTrust = required(resources, "nextTrust");
  const previous = required(resources, "trustFibonacciPrevious");
  const current = required(resources, "trustFibonacciCurrent");
  let threshold = transaction.get(nextTrust);
  let fibPrevious = transaction.get(previous);
  let fibCurrent = transaction.get(current);
  const tickLimit = Math.round(seconds / 0.01);
  let awarded = 0;
  while (clips >= threshold && awarded < tickLimit) {
    awarded += 1;
    const next = fibPrevious + fibCurrent;
    threshold = next * 1_000;
    fibPrevious = fibCurrent;
    fibCurrent = next;
  }
  if (awarded === 0) return;
  transaction.add(required(resources, "trust"), awarded);
  transaction.set(
    required(resources, "computeCapacity"),
    Math.max(
      transaction.get(required(resources, "computeCapacity")),
      transaction.get(required(resources, "trust")),
    ),
  );
  transaction.set(nextTrust, threshold);
  transaction.set(previous, fibPrevious);
  transaction.set(current, fibCurrent);
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
