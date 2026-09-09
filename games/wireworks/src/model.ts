import { createGameKit, nativeNumbers } from "@e308/core";

export const wireworksKit = createGameKit({ numbers: nativeNumbers });
export const wireworksScopes = {
  economy: wireworksKit.scope("economy"),
  workshop: wireworksKit.scope("workshop"),
  industry: wireworksKit.scope("industry"),
  autonomy: wireworksKit.scope("autonomy"),
} as const;

const storage = wireworksKit.resource("storage", {
  scope: wireworksScopes.economy,
  initial: 0,
  capacity: 20,
});

export const wireworksResources = {
  cash: wireworksKit.resource("cash", { scope: wireworksScopes.economy, initial: 20 }),
  matter: wireworksKit.resource("matter", {
    scope: wireworksScopes.economy,
    initial: 240,
    capacityFor: (get) => 500 + get(storage) * 1_000,
  }),
  wire: wireworksKit.resource("wire", {
    scope: wireworksScopes.economy,
    initial: 10,
    capacityFor: (get) => 500 + get(storage) * 500,
  }),
  clips: wireworksKit.resource("clips", {
    scope: wireworksScopes.economy,
    initial: 0,
    capacityFor: (get) => 500 + get(storage) * 500,
  }),
  power: wireworksKit.resource("power", {
    scope: wireworksScopes.economy,
    initial: 2,
    capacity: 20,
  }),
  demand: wireworksKit.resource("demand", {
    scope: wireworksScopes.economy,
    initial: 80,
    capacity: 100,
  }),
  reach: wireworksKit.resource("reach", {
    scope: wireworksScopes.economy,
    initial: 0,
    capacity: 100,
  }),
  efficiency: wireworksKit.resource("efficiency", {
    scope: wireworksScopes.economy,
    initial: 1,
    capacity: 10,
  }),
  storage,
  drones: wireworksKit.resource("drones", {
    scope: wireworksScopes.economy,
    initial: 0,
    capacity: 10_000,
  }),
  probes: wireworksKit.resource("probes", {
    scope: wireworksScopes.economy,
    initial: 0,
    capacity: 3,
  }),
} as const;

export const wireworksAllocation = wireworksKit.allocation("grid", {
  scope: wireworksScopes.industry,
  budget: wireworksResources.power,
  targets: ["extrusion", "assembly"],
  initial: { extrusion: 1, assembly: 1 },
});
