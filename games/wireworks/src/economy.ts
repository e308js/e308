import { geometricCurve } from "@e308/core";
import { wireworksAllocation, wireworksKit, wireworksResources, wireworksScopes } from "./model.js";

export const wireworksBuyables = {
  extruder: wireworksKit.buyable("bench-extruder", {
    scope: wireworksScopes.economy,
    currency: wireworksResources.cash,
    curve: geometricCurve(wireworksKit.numbers, { base: 25, ratio: 1.45 }),
    initialCount: 1,
    refundRate: 0,
  }),
  assembler: wireworksKit.buyable("clip-assembler", {
    scope: wireworksScopes.economy,
    currency: wireworksResources.cash,
    curve: geometricCurve(wireworksKit.numbers, { base: 40, ratio: 1.5 }),
    initialCount: 1,
    refundRate: 0,
  }),
} as const;

export const supplyBatch = wireworksKit.recipe("matter-shipment", {
  scope: wireworksScopes.economy,
  consumes: [[wireworksResources.cash, 10]],
  produces: [[wireworksResources.matter, 200]],
});

export const wireworksMarkets = {
  volume: salesMarket("volume-sales", 2, 20),
  standard: salesMarket("standard-sales", 5, 10),
  premium: salesMarket("premium-sales", 12, 5),
} as const;

const efficiency = wireworksKit.rates.proportional(wireworksResources.efficiency, 1);
export const wireworksFlows = [
  wireworksKit.flow("bench-wire", {
    scope: wireworksScopes.economy,
    priority: 10,
    rate: wireworksKit.rates.product(
      wireworksKit.rates.purchased(wireworksBuyables.extruder, 1),
      efficiency,
    ),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.wire, 3]],
  }),
  wireworksKit.flow("bench-clips", {
    scope: wireworksScopes.economy,
    priority: 20,
    rate: wireworksKit.rates.product(
      wireworksKit.rates.purchased(wireworksBuyables.assembler, 0.75),
      efficiency,
    ),
    consumes: [[wireworksResources.wire, 2]],
    produces: [[wireworksResources.clips, 4]],
  }),
  wireworksKit.flow("powered-wire", {
    scope: wireworksScopes.industry,
    priority: 30,
    rate: wireworksKit.rates.product(
      wireworksKit.rates.allocated(wireworksAllocation, "extrusion", 3),
      efficiency,
    ),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.wire, 5]],
  }),
  wireworksKit.flow("powered-clips", {
    scope: wireworksScopes.industry,
    priority: 40,
    rate: wireworksKit.rates.product(
      wireworksKit.rates.allocated(wireworksAllocation, "assembly", 2),
      efficiency,
    ),
    consumes: [[wireworksResources.wire, 2]],
    produces: [[wireworksResources.clips, 6]],
  }),
  wireworksKit.flow("drone-mining", {
    scope: wireworksScopes.autonomy,
    priority: 5,
    rate: wireworksKit.rates.proportional(wireworksResources.drones, 5),
    produces: [[wireworksResources.matter, 1]],
  }),
  wireworksKit.flow("drone-replication", {
    scope: wireworksScopes.autonomy,
    priority: 10,
    rate: wireworksKit.rates.proportional(wireworksResources.drones, 0.012),
    consumes: [[wireworksResources.matter, 30]],
    produces: [[wireworksResources.drones, 1]],
  }),
  wireworksKit.flow("drone-assembly", {
    scope: wireworksScopes.autonomy,
    priority: 50,
    rate: wireworksKit.rates.proportional(wireworksResources.drones, 0.4),
    consumes: [[wireworksResources.matter, 1]],
    produces: [[wireworksResources.clips, 8]],
  }),
  wireworksKit.flow("demand-recovery", {
    scope: wireworksScopes.economy,
    priority: 60,
    rate: wireworksKit.rates.sum(
      wireworksKit.rates.constant(0.2),
      wireworksKit.rates.proportional(wireworksResources.reach, 0.03),
    ),
    produces: [[wireworksResources.demand, 1]],
  }),
] as const;

function salesMarket(id: string, sell: number, maximumQuantity: number) {
  return wireworksKit.market(id, {
    scope: wireworksScopes.economy,
    inventory: wireworksResources.clips,
    currency: wireworksResources.cash,
    price: { kind: "fixed", buy: sell + 2, sell },
    feeRate: 0,
    feeRounding: "none",
    maximumQuantity,
  });
}
