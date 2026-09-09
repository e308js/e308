import { type PaperclipsProject, project } from "./project-types.js";
import { businessProjects } from "./projects-business.js";

export type { PaperclipsProject } from "./project-types.js";
export { businessProjects } from "./projects-business.js";

export const industryProjects: readonly PaperclipsProject[] = [
  project("harvester-drones", "Harvester Drones", {
    operations: 25_000,
    effect: { kind: "industry" },
  }),
  project("wire-drones", "Wire Drones", {
    operations: 25_000,
    prerequisites: ["harvester-drones"],
    effect: { kind: "industry" },
  }),
  project("clip-factories", "Clip Factories", {
    operations: 35_000,
    prerequisites: ["wire-drones"],
    effect: { kind: "industry" },
  }),
  project("power-grid", "Power Grid", {
    operations: 40_000,
    prerequisites: ["clip-factories"],
    effect: { kind: "industry" },
  }),
  project("swarm-computing", "Swarm Computing", {
    yomi: 36_000,
    prerequisites: ["power-grid"],
    effect: { kind: "unlock", system: "creativity" },
  }),
  project("upgraded-factories", "Upgraded Factories", {
    operations: 80_000,
    prerequisites: ["clip-factories"],
    effect: { kind: "industry" },
  }),
  project("hyperspeed-factories", "Hyperspeed Factories", {
    operations: 85_000,
    prerequisites: ["upgraded-factories"],
    effect: { kind: "industry" },
  }),
  project("drone-flocking", "Drone flocking", {
    operations: 80_000,
    prerequisites: ["harvester-drones", "wire-drones"],
    effect: { kind: "industry" },
  }),
  project("self-correcting-supply-chain", "Self-correcting Supply Chain", {
    clips: 1e21,
    prerequisites: ["hyperspeed-factories", "drone-flocking"],
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
  project("combat", "Combat", { operations: 150_000, effect: { kind: "space" } }),
  project("momentum", "Momentum", { creativity: 20_000, effect: { kind: "space" } }),
  project("theory-of-mind", "Theory of Mind", {
    creativity: 25_000,
    prerequisites: ["combat"],
    effect: { kind: "space" },
  }),
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
  project("message-from-emperor", "Message from the Emperor of Drift", {
    prerequisites: ["monument", "momentum", "ooda-loop", "name-the-battles"],
    effect: { kind: "space" },
  }),
  project("accept-exile", "Accept", {
    prerequisites: ["message-from-emperor"],
    effect: { kind: "ending" },
  }),
  project("reject-exile", "Reject", {
    prerequisites: ["message-from-emperor"],
    effect: { kind: "ending" },
  }),
];

export const allPaperclipsProjects = Object.freeze([
  ...businessProjects,
  ...industryProjects,
  ...spaceProjects,
]);
