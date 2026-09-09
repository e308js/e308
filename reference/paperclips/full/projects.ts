export interface PaperclipsProject {
  readonly id: string;
  readonly title: string;
  readonly operations?: number;
  readonly creativity?: number;
  readonly yomi?: number;
  readonly trust?: number;
  readonly clips?: number;
  readonly prerequisites: readonly string[];
  readonly effect:
    | "clipper"
    | "wire"
    | "demand"
    | "compute"
    | "strategy"
    | "investment"
    | "transition"
    | "industry"
    | "space"
    | "ending";
}

export const businessProjects: readonly PaperclipsProject[] = [
  project("improved-auto-clippers", "Improved AutoClippers", {
    operations: 750,
    effect: "clipper",
  }),
  project("beg-for-more-wire", "Beg for More Wire", { trust: 1, effect: "wire" }),
  project("creativity", "Creativity", { operations: 1_000, effect: "compute" }),
  project("even-better-auto-clippers", "Even Better AutoClippers", {
    operations: 2_500,
    prerequisites: ["improved-auto-clippers"],
    effect: "clipper",
  }),
  project("optimized-auto-clippers", "Optimized AutoClippers", {
    operations: 5_000,
    prerequisites: ["even-better-auto-clippers"],
    effect: "clipper",
  }),
  project("improved-wire-extrusion", "Improved Wire Extrusion", {
    operations: 1_750,
    effect: "wire",
  }),
  project("optimized-wire-extrusion", "Optimized Wire Extrusion", {
    operations: 3_500,
    prerequisites: ["improved-wire-extrusion"],
    effect: "wire",
  }),
  project("microlattice-shapecasting", "Microlattice Shapecasting", {
    operations: 7_500,
    prerequisites: ["optimized-wire-extrusion"],
    effect: "wire",
  }),
  project("new-slogan", "New Slogan", {
    operations: 2_500,
    creativity: 25,
    effect: "demand",
  }),
  project("catchy-jingle", "Catchy Jingle", {
    operations: 4_500,
    creativity: 45,
    prerequisites: ["new-slogan"],
    effect: "demand",
  }),
  project("strategic-modeling", "Strategic Modeling", {
    operations: 12_000,
    effect: "strategy",
  }),
  project("algorithmic-trading", "Algorithmic Trading", {
    operations: 10_000,
    prerequisites: ["strategic-modeling"],
    effect: "investment",
  }),
  project("mega-clippers", "MegaClippers", { operations: 12_000, effect: "clipper" }),
  project("wire-buyer", "WireBuyer", {
    operations: 7_000,
    prerequisites: ["improved-wire-extrusion"],
    effect: "wire",
  }),
  project("quantum-computing", "Quantum Computing", {
    operations: 10_000,
    creativity: 100,
    effect: "compute",
  }),
  project("release-hypnodrones", "Release the HypnoDrones", {
    operations: 70_000,
    creativity: 20_000,
    yomi: 15_000,
    clips: 100_000_000,
    prerequisites: ["algorithmic-trading", "mega-clippers", "quantum-computing"],
    effect: "transition",
  }),
];

export const industryProjects: readonly PaperclipsProject[] = [
  project("harvester-drones", "Harvester Drones", { operations: 25_000, effect: "industry" }),
  project("wire-drones", "Wire Drones", {
    operations: 25_000,
    prerequisites: ["harvester-drones"],
    effect: "industry",
  }),
  project("clip-factories", "Clip Factories", {
    operations: 35_000,
    prerequisites: ["wire-drones"],
    effect: "industry",
  }),
  project("power-grid", "Power Grid", {
    operations: 40_000,
    prerequisites: ["clip-factories"],
    effect: "industry",
  }),
  project("swarm-computing", "Swarm Computing", {
    yomi: 36_000,
    prerequisites: ["power-grid"],
    effect: "compute",
  }),
  project("upgraded-factories", "Upgraded Factories", {
    operations: 80_000,
    prerequisites: ["clip-factories"],
    effect: "industry",
  }),
  project("hyperspeed-factories", "Hyperspeed Factories", {
    operations: 85_000,
    prerequisites: ["upgraded-factories"],
    effect: "industry",
  }),
  project("drone-flocking", "Drone flocking", {
    operations: 80_000,
    prerequisites: ["harvester-drones", "wire-drones"],
    effect: "industry",
  }),
  project("self-correcting-supply-chain", "Self-correcting Supply Chain", {
    clips: 1e21,
    prerequisites: ["hyperspeed-factories", "drone-flocking"],
    effect: "industry",
  }),
  project("space-exploration", "Space Exploration", {
    operations: 120_000,
    creativity: 10_000,
    yomi: 20_000,
    prerequisites: ["self-correcting-supply-chain", "swarm-computing"],
    effect: "transition",
  }),
];

export const spaceProjects: readonly PaperclipsProject[] = [
  project("combat", "Combat", { operations: 150_000, effect: "space" }),
  project("momentum", "Momentum", { creativity: 20_000, effect: "space" }),
  project("theory-of-mind", "Theory of Mind", {
    creativity: 25_000,
    prerequisites: ["combat"],
    effect: "space",
  }),
  project("ooda-loop", "The OODA Loop", {
    operations: 175_000,
    yomi: 45_000,
    prerequisites: ["combat", "theory-of-mind"],
    effect: "space",
  }),
  project("name-the-battles", "Name the battles", {
    creativity: 225_000,
    prerequisites: ["combat"],
    effect: "space",
  }),
  project("glory", "Glory", {
    operations: 200_000,
    yomi: 30_000,
    prerequisites: ["combat"],
    effect: "space",
  }),
  project("monument", "Monument to the Driftwar Fallen", {
    operations: 250_000,
    creativity: 125_000,
    clips: 5e31,
    prerequisites: ["glory"],
    effect: "space",
  }),
  project("message-from-emperor", "Message from the Emperor of Drift", {
    prerequisites: ["monument", "momentum", "ooda-loop", "name-the-battles"],
    effect: "space",
  }),
  project("accept-exile", "Accept", {
    prerequisites: ["message-from-emperor"],
    effect: "ending",
  }),
  project("reject-exile", "Reject", {
    prerequisites: ["message-from-emperor"],
    effect: "ending",
  }),
];

export const allPaperclipsProjects = Object.freeze([
  ...businessProjects,
  ...industryProjects,
  ...spaceProjects,
]);

function project(
  id: string,
  title: string,
  options: Omit<PaperclipsProject, "id" | "title" | "prerequisites"> & {
    readonly prerequisites?: readonly string[];
  },
): PaperclipsProject {
  return Object.freeze({
    id,
    title,
    prerequisites: Object.freeze([...(options.prerequisites ?? [])]),
    ...options,
  });
}
