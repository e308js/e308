import { createGameKit, geometricCurve, nativeNumbers } from "../../../packages/core/src/index.js";
import { autoClipperCurve, megaClipperCurve } from "./purchase-curves.js";
import { updateBusiness } from "./update-business.js";
import { updateIndustry } from "./update-industry.js";
import { updateSpace } from "./update-space.js";

export const paperclipsKit = createGameKit({ numbers: nativeNumbers });
const business = paperclipsKit.scope("business");
const permanent = paperclipsKit.scope("permanent");
const industry = paperclipsKit.scope("industry");
const space = paperclipsKit.scope("space");

export const paperclipsResources = {
  clips: paperclipsKit.resource("clips", { scope: permanent, initial: 0 }),
  unsold: paperclipsKit.resource("unsold-clips", { scope: business, initial: 0 }),
  funds: paperclipsKit.resource("funds", { scope: business, initial: 0 }),
  wire: paperclipsKit.resource("wire", { scope: business, initial: 1_000 }),
  wireSupply: paperclipsKit.resource("wire-supply", { scope: permanent, initial: 1_000 }),
  wireCost: paperclipsKit.resource("wire-cost", { scope: permanent, initial: 20 }),
  wireBasePrice: paperclipsKit.resource("wire-base-price", { scope: permanent, initial: 20 }),
  wirePriceCounter: paperclipsKit.resource("wire-price-counter", { scope: permanent, initial: 0 }),
  wirePriceTimer: paperclipsKit.resource("wire-price-timer", { scope: permanent, initial: 0 }),
  price: paperclipsKit.resource("clip-price", { scope: business, initial: 0.25 }),
  demand: paperclipsKit.resource("demand", { scope: business, initial: 5 }),
  demandBoost: paperclipsKit.resource("demand-boost", { scope: permanent, initial: 1 }),
  marketingEffectiveness: paperclipsKit.resource("marketing-effectiveness", {
    scope: permanent,
    initial: 1,
  }),
  universePrestige: paperclipsKit.resource("universe-prestige", { scope: permanent, initial: 0 }),
  marketingLevel: paperclipsKit.resource("marketing-level", { scope: business, initial: 1 }),
  trust: paperclipsKit.resource("trust", { scope: permanent, initial: 2 }),
  operations: paperclipsKit.resource("operations", { scope: permanent, initial: 0 }),
  creativity: paperclipsKit.resource("creativity", { scope: permanent, initial: 0 }),
  yomi: paperclipsKit.resource("yomi", { scope: permanent, initial: 0 }),
  bankroll: paperclipsKit.resource("bankroll", { scope: permanent, initial: 0 }),
  investmentLevel: paperclipsKit.resource("investment-level", { scope: permanent, initial: 0 }),
  tournaments: paperclipsKit.resource("tournaments", { scope: permanent, initial: 0 }),
  manualClips: paperclipsKit.resource("manual-clips", { scope: permanent, initial: 0 }),
  availableMatter: paperclipsKit.resource("available-matter", { scope: industry, initial: 6e27 }),
  acquiredMatter: paperclipsKit.resource("acquired-matter", { scope: industry, initial: 0 }),
  processedMatter: paperclipsKit.resource("processed-matter", { scope: industry, initial: 0 }),
  storedPower: paperclipsKit.resource("stored-power", { scope: industry, initial: 0 }),
  swarmGifts: paperclipsKit.resource("swarm-gifts", { scope: permanent, initial: 0 }),
  probeTrust: paperclipsKit.resource("probe-trust", { scope: space, initial: 0 }),
  probes: paperclipsKit.resource("probes", { scope: space, initial: 0 }),
  universeMatter: paperclipsKit.resource("universe-matter", { scope: space, initial: 3e55 }),
  foundMatter: paperclipsKit.resource("found-matter", { scope: space, initial: 0 }),
  spaceWire: paperclipsKit.resource("space-wire", { scope: space, initial: 0 }),
  exploration: paperclipsKit.resource("exploration", { scope: space, initial: 0 }),
  drifters: paperclipsKit.resource("drifters", { scope: space, initial: 0 }),
  honor: paperclipsKit.resource("honor", { scope: permanent, initial: 0 }),
  glory: paperclipsKit.resource("glory", { scope: permanent, initial: 0 }),
  battles: paperclipsKit.resource("battles", { scope: permanent, initial: 0 }),
} as const;

export const computeAllocation = paperclipsKit.allocation("compute", {
  scope: permanent,
  budget: paperclipsResources.trust,
  targets: ["processors", "memory"],
  initial: { processors: 1, memory: 1 },
});

export const probeAllocation = paperclipsKit.allocation("probe-design", {
  scope: space,
  budget: paperclipsResources.probeTrust,
  targets: [
    "speed",
    "navigation",
    "replication",
    "hazard",
    "factory",
    "harvester",
    "wire",
    "combat",
  ],
});

const curve = (base: number, ratio: number) => geometricCurve(nativeNumbers, { base, ratio });

export const paperclipsBuyables = {
  autoClipper: paperclipsKit.buyable("auto-clipper", {
    scope: business,
    currency: paperclipsResources.funds,
    curve: autoClipperCurve,
  }),
  megaClipper: paperclipsKit.buyable("mega-clipper", {
    scope: business,
    currency: paperclipsResources.funds,
    curve: megaClipperCurve,
  }),
  marketing: paperclipsKit.buyable("marketing", {
    scope: business,
    currency: paperclipsResources.funds,
    curve: curve(100, 2),
  }),
  harvester: paperclipsKit.buyable("harvester", {
    scope: industry,
    currency: paperclipsResources.clips,
    curve: curve(1e6, 1.15),
  }),
  wireDrone: paperclipsKit.buyable("wire-drone", {
    scope: industry,
    currency: paperclipsResources.clips,
    curve: curve(1e6, 1.15),
  }),
  factory: paperclipsKit.buyable("factory", {
    scope: industry,
    currency: paperclipsResources.clips,
    curve: curve(1e8, 1.2),
  }),
  solarFarm: paperclipsKit.buyable("solar-farm", {
    scope: industry,
    currency: paperclipsResources.clips,
    curve: curve(1e7, 1.2),
  }),
  battery: paperclipsKit.buyable("battery", {
    scope: industry,
    currency: paperclipsResources.clips,
    curve: curve(1e6, 1.2),
  }),
} as const;

const businessUpdate = paperclipsKit.steppedRule("business-update", {
  scope: business,
  priority: 10,
  update: (transaction, seconds) =>
    updateBusiness(
      transaction,
      seconds,
      paperclipsResources,
      paperclipsBuyables,
      computeAllocation,
    ),
});

const industryUpdate = paperclipsKit.steppedRule("industry-update", {
  scope: industry,
  priority: 20,
  update: (transaction, seconds) =>
    updateIndustry(transaction, seconds, paperclipsResources, paperclipsBuyables),
});

const spaceUpdate = paperclipsKit.steppedRule("space-update", {
  scope: space,
  priority: 30,
  update: (transaction, seconds) =>
    updateSpace(transaction, seconds, paperclipsResources, probeAllocation),
});

export const paperclipsDefinition = paperclipsKit.defineGame({
  id: "paperclips-full-reference",
  simulationVersion: 2,
  stepMs: 1_000,
  rootSeed: "7061706572636c697073",
  resources: Object.values(paperclipsResources),
  buyables: Object.values(paperclipsBuyables),
  allocations: [computeAllocation, probeAllocation],
  steppedRules: [businessUpdate, industryUpdate, spaceUpdate],
  win: (state) => state.hasUpgrade("accept-exile") || state.hasUpgrade("reject-exile"),
});
