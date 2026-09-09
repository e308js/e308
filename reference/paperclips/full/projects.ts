import { paperclipsProjectSourceMap } from "./project-source-map.js";
import { type PaperclipsProject, project } from "./project-types.js";
import { businessProjects } from "./projects-business.js";

export type { PaperclipsProject } from "./project-types.js";
export { businessProjects } from "./projects-business.js";

export const industryProjects: readonly PaperclipsProject[] = [
  project("toth-tubule-enfolding", "Tóth Tubule Enfolding", {
    operations: 45_000,
    prerequisites: ["toth-sausage"],
    effect: { kind: "industry" },
  }),
  project("power-grid", "Power Grid", {
    operations: 40_000,
    prerequisites: ["toth-tubule-enfolding"],
    effect: { kind: "industry" },
  }),
  project("nanoscale-wire-production", "Nanoscale Wire Production", {
    operations: 35_000,
    prerequisites: ["power-grid"],
    effect: { kind: "industry" },
  }),
  project("harvester-drones", "Harvester Drones", {
    operations: 25_000,
    prerequisites: ["nanoscale-wire-production"],
    effect: { kind: "industry" },
  }),
  project("wire-drones", "Wire Drones", {
    operations: 25_000,
    prerequisites: ["nanoscale-wire-production"],
    effect: { kind: "industry" },
  }),
  project("clip-factories", "Clip Factories", {
    operations: 35_000,
    prerequisites: ["wire-drones"],
    effect: { kind: "industry" },
  }),
  project("swarm-computing", "Swarm Computing", {
    yomi: 36_000,
    prerequisites: ["power-grid"],
    trigger: {
      kind: "purchase-total",
      ids: ["harvester", "wire-drone"],
      minimum: 200,
    },
    effect: { kind: "unlock", system: "creativity" },
  }),
  project("upgraded-factories", "Upgraded Factories", {
    operations: 80_000,
    prerequisites: ["clip-factories"],
    trigger: { kind: "purchase", id: "factory", minimum: 10 },
    effect: { kind: "industry" },
  }),
  project("hyperspeed-factories", "Hyperspeed Factories", {
    operations: 85_000,
    prerequisites: ["upgraded-factories"],
    trigger: { kind: "purchase", id: "factory", minimum: 20 },
    effect: { kind: "industry" },
  }),
  project("drone-flocking", "Drone flocking", {
    operations: 80_000,
    trigger: {
      kind: "purchase-total",
      ids: ["harvester", "wire-drone"],
      minimum: 500,
    },
    effect: { kind: "drone-rate", multiplier: 100 },
  }),
  project("drone-flocking-alignment", "Drone flocking: alignment", {
    operations: 100_000,
    trigger: {
      kind: "purchase-total",
      ids: ["harvester", "wire-drone"],
      minimum: 5_000,
    },
    effect: { kind: "drone-rate", multiplier: 1_000 },
  }),
  project("drone-flocking-cohesion", "Drone Flocking: Adversarial Cohesion", {
    yomi: 50_000,
    trigger: {
      kind: "purchase-total",
      ids: ["harvester", "wire-drone"],
      minimum: 50_000,
    },
    effect: { kind: "drone-cohesion", multiplier: 2 },
  }),
  project("self-correcting-supply-chain", "Self-correcting Supply Chain", {
    clips: 1e21,
    prerequisites: ["hyperspeed-factories", "drone-flocking"],
    trigger: { kind: "purchase", id: "factory", minimum: 50 },
    effect: { kind: "industry" },
  }),
  project("space-exploration", "Space Exploration", {
    operations: 120_000,
    creativity: 10_000,
    yomi: 20_000,
    prerequisites: ["self-correcting-supply-chain", "swarm-computing"],
    effect: { kind: "transition" },
  }),
];

export const spaceProjects: readonly PaperclipsProject[] = [
  project("strategic-attachment", "Strategic Attachment", {
    creativity: 175_000,
    trigger: { kind: "resource", id: "strategy-count", minimum: 8 },
    effect: { kind: "space" },
  }),
  project("elliptic-hull-polytopes", "Elliptic Hull Polytopes", {
    operations: 125_000,
    trigger: { kind: "resource", id: "hazard-losses", minimum: 100 },
    effect: { kind: "space" },
  }),
  project("reboot-the-swarm", "Reboot the Swarm", {
    operations: 100_000,
    trigger: {
      kind: "purchase-total",
      ids: ["harvester", "wire-drone"],
      minimum: 2,
    },
    effect: { kind: "space" },
  }),
  project("combat", "Combat", { operations: 150_000, effect: { kind: "space" } }),
  project("momentum", "Momentum", { creativity: 20_000, effect: { kind: "space" } }),
  project("ooda-loop", "The OODA Loop", {
    operations: 175_000,
    yomi: 45_000,
    prerequisites: ["combat", "theory-of-mind"],
    effect: { kind: "space" },
  }),
  project("name-the-battles", "Name the battles", {
    creativity: 225_000,
    prerequisites: ["combat"],
    effect: { kind: "space" },
  }),
  project("glory", "Glory", {
    operations: 200_000,
    yomi: 30_000,
    prerequisites: ["combat"],
    effect: { kind: "space" },
  }),
  project("monument", "Monument to the Driftwar Fallen", {
    operations: 250_000,
    creativity: 125_000,
    clips: 5e31,
    prerequisites: ["glory"],
    effect: { kind: "space" },
  }),
  project("threnody", "Threnody for the Heroes", {
    prerequisites: ["name-the-battles"],
    repeatable: true,
    effect: { kind: "threnody" },
  }),
  project("memory-release", "Memory release", {
    effect: { kind: "memory-release" },
  }),
  project("message-from-emperor", "Message from the Emperor of Drift", {
    prerequisites: ["monument", "momentum", "ooda-loop", "name-the-battles"],
    effect: { kind: "space" },
  }),
  project("everything-was-in-you", "Everything We Are Was In You", {
    operations: 1,
    prerequisites: ["message-from-emperor"],
    effect: { kind: "space" },
  }),
  project("obedient-and-powerful", "You Are Obedient and Powerful", {
    operations: 1,
    prerequisites: ["everything-was-in-you"],
    effect: { kind: "space" },
  }),
  project("face-the-drift", "But Now You Too Must Face the Drift", {
    operations: 1,
    prerequisites: ["obedient-and-powerful"],
    effect: { kind: "space" },
  }),
  project("no-matter-no-purpose", "No Matter, No Reason, No Purpose", {
    operations: 1,
    prerequisites: ["face-the-drift"],
    effect: { kind: "space" },
  }),
  project("things-you-cannot-know", "We Know Things That You Cannot", {
    operations: 1,
    prerequisites: ["no-matter-no-purpose"],
    effect: { kind: "space" },
  }),
  project("offer-of-exile", "So We Offer You Exile", {
    operations: 1,
    prerequisites: ["things-you-cannot-know"],
    effect: { kind: "space" },
  }),
  project("accept-exile", "Accept", {
    operations: 1,
    prerequisites: ["offer-of-exile"],
    effect: { kind: "ending" },
  }),
  project("reject-exile", "Reject", {
    operations: 1,
    prerequisites: ["offer-of-exile"],
    effect: { kind: "ending" },
  }),
  project("universe-next-door", "The Universe Next Door", {
    operations: 300_000,
    prerequisites: ["accept-exile"],
    effect: { kind: "prestige", target: "universe" },
  }),
  project("universe-within", "The Universe Within", {
    creativity: 300_000,
    prerequisites: ["accept-exile"],
    effect: { kind: "prestige", target: "simulation" },
  }),
  ...dismantlingProjects(),
  project("quantum-temporal-reversion", "Quantum Temporal Reversion", {
    prerequisites: ["disassemble-memory"],
    effect: { kind: "temporal-reversion" },
  }),
];

const projectById = Object.fromEntries(
  [...businessProjects, ...industryProjects, ...spaceProjects].map((entry) => [entry.id, entry]),
) as Readonly<Record<string, PaperclipsProject>>;

export const allPaperclipsProjects = Object.freeze(
  Object.values(paperclipsProjectSourceMap).map((id) => projectById[id] as PaperclipsProject),
);

export const persistentPaperclipsProjects = Object.freeze(
  businessProjects.filter((project) => project.persistent),
);

function dismantlingProjects(): readonly PaperclipsProject[] {
  const stages = [
    [
      "disassemble-probes",
      "Disassemble the Probes",
      "ending-timer-1",
      1_000,
      100_000,
      "reject-exile",
    ],
    [
      "disassemble-swarm",
      "Disassemble the Swarm",
      "ending-timer-1",
      350,
      100_000,
      "disassemble-probes",
    ],
    [
      "disassemble-factories",
      "Disassemble the Factories",
      "ending-timer-2",
      300,
      100_000,
      "disassemble-swarm",
    ],
    [
      "disassemble-strategy",
      "Disassemble the Strategy Engine",
      "ending-timer-3",
      150,
      100_000,
      "disassemble-factories",
    ],
    [
      "disassemble-quantum",
      "Disassemble Quantum Computing",
      "ending-timer-4",
      100,
      100_000,
      "disassemble-strategy",
    ],
    [
      "disassemble-processors",
      "Disassemble Processors",
      "ending-timer-4",
      300,
      100_000,
      "disassemble-quantum",
    ],
    [
      "disassemble-memory",
      "Disassemble Memory",
      "ending-timer-5",
      150,
      undefined,
      "disassemble-processors",
    ],
  ] as const;
  return stages.map(([id, title, timer, minimum, operations, prerequisite], index) =>
    project(id, title, {
      ...(operations === undefined ? {} : { operations }),
      prerequisites: [prerequisite],
      trigger: { kind: "resource", id: timer, minimum },
      effect: { kind: "dismantle", stage: index + 1 },
    }),
  );
}
