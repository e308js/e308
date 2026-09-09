import { type PaperclipsProject, project } from "./project-types.js";

export const businessProjects: readonly PaperclipsProject[] = [
  project("improved-auto-clippers", "Improved AutoClippers", {
    operations: 750,
    effect: boost("auto", 0.25),
  }),
  project("beg-for-more-wire", "Beg for More Wire", {
    trustCost: 1,
    repeatable: true,
    effect: { kind: "wire-refill", repeatable: true },
  }),
  project("creativity", "Creativity", { operations: 1_000, effect: unlock("creativity") }),
  project("even-better-auto-clippers", "Even Better AutoClippers", {
    operations: 2_500,
    prerequisites: ["improved-auto-clippers"],
    effect: boost("auto", 0.5),
  }),
  project("optimized-auto-clippers", "Optimized AutoClippers", {
    operations: 5_000,
    prerequisites: ["even-better-auto-clippers"],
    effect: boost("auto", 0.75),
  }),
  project("limerick", "Limerick", {
    creativity: 10,
    prerequisites: ["creativity"],
    effect: { kind: "trust", amount: 1 },
  }),
  project("improved-wire-extrusion", "Improved Wire Extrusion", {
    operations: 1_750,
    effect: wire(1.5),
  }),
  project("optimized-wire-extrusion", "Optimized Wire Extrusion", {
    operations: 3_500,
    prerequisites: ["improved-wire-extrusion"],
    effect: wire(1.75),
  }),
  project("microlattice-shapecasting", "Microlattice Shapecasting", {
    operations: 7_500,
    prerequisites: ["optimized-wire-extrusion"],
    effect: wire(2),
  }),
  project("spectral-froth-annealment", "Spectral Froth Annealment", {
    operations: 12_000,
    prerequisites: ["microlattice-shapecasting"],
    effect: wire(3),
  }),
  project("quantum-foam-annealment", "Quantum Foam Annealment", {
    operations: 15_000,
    trigger: resource("wire-cost", 125),
    effect: wire(11),
  }),
  project("lexical-processing", "Lexical Processing", {
    creativity: 50,
    effect: { kind: "trust", amount: 1 },
  }),
  project("new-slogan", "New Slogan", {
    operations: 2_500,
    creativity: 25,
    prerequisites: ["lexical-processing"],
    effect: { kind: "marketing", multiplier: 1.5 },
  }),
  project("combinatory-harmonics", "Combinatory Harmonics", {
    creativity: 100,
    effect: { kind: "trust", amount: 1 },
  }),
  project("catchy-jingle", "Catchy Jingle", {
    operations: 4_500,
    creativity: 45,
    prerequisites: ["combinatory-harmonics"],
    effect: { kind: "marketing", multiplier: 2 },
  }),
  project("hadwiger-problem", "The Hadwiger Problem", {
    creativity: 150,
    effect: { kind: "trust", amount: 1 },
  }),
  project("toth-sausage", "The Tóth Sausage Conjecture", {
    creativity: 200,
    effect: { kind: "trust", amount: 1 },
  }),
  project("hadwiger-clip-diagrams", "Hadwiger Clip Diagrams", {
    operations: 6_000,
    prerequisites: ["hadwiger-problem"],
    effect: boost("auto", 5),
  }),
  project("donkey-space", "Donkey Space", {
    creativity: 250,
    effect: { kind: "trust", amount: 1 },
  }),
  project("strategic-modeling", "Strategic Modeling", {
    operations: 12_000,
    prerequisites: ["donkey-space"],
    effect: unlock("strategy"),
  }),
  project("strategy-a100", "New Strategy: A100", {
    operations: 15_000,
    prerequisites: ["strategic-modeling"],
    persistent: true,
    effect: { kind: "strategy", strategy: "a100" },
  }),
  project("strategy-b100", "New Strategy: B100", {
    operations: 17_500,
    prerequisites: ["strategy-a100"],
    persistent: true,
    effect: { kind: "strategy", strategy: "b100" },
  }),
  project("strategy-greedy", "New Strategy: GREEDY", {
    operations: 20_000,
    prerequisites: ["strategy-b100"],
    persistent: true,
    effect: { kind: "strategy", strategy: "greedy" },
  }),
  project("strategy-generous", "New Strategy: GENEROUS", {
    operations: 22_500,
    prerequisites: ["strategy-greedy"],
    persistent: true,
    effect: { kind: "strategy", strategy: "generous" },
  }),
  project("strategy-minimax", "New Strategy: MINIMAX", {
    operations: 25_000,
    prerequisites: ["strategy-generous"],
    persistent: true,
    effect: { kind: "strategy", strategy: "minimax" },
  }),
  project("strategy-tit-for-tat", "New Strategy: TIT FOR TAT", {
    operations: 30_000,
    prerequisites: ["strategy-minimax"],
    persistent: true,
    effect: { kind: "strategy", strategy: "tit-for-tat" },
  }),
  project("strategy-beat-last", "New Strategy: BEAT LAST", {
    operations: 32_500,
    prerequisites: ["strategy-tit-for-tat"],
    persistent: true,
    effect: { kind: "strategy", strategy: "beat-last" },
  }),
  project("theory-of-mind", "Theory of Mind", {
    creativity: 25_000,
    prerequisites: ["strategy-beat-last"],
    persistent: true,
    effect: { kind: "theory-of-mind" },
  }),
  project("algorithmic-trading", "Algorithmic Trading", {
    operations: 10_000,
    trigger: resource("trust", 8),
    effect: unlock("investment"),
  }),
  project("mega-clippers", "MegaClippers", {
    operations: 12_000,
    trigger: purchase("auto-clipper", 75),
    effect: unlock("hypnodrones"),
  }),
  project("improved-mega-clippers", "Improved MegaClippers", {
    operations: 14_000,
    prerequisites: ["mega-clippers"],
    effect: boost("mega", 0.25),
  }),
  project("even-better-mega-clippers", "Even Better MegaClippers", {
    operations: 17_000,
    prerequisites: ["improved-mega-clippers"],
    effect: boost("mega", 0.5),
  }),
  project("optimized-mega-clippers", "Optimized MegaClippers", {
    operations: 19_500,
    prerequisites: ["even-better-mega-clippers"],
    effect: boost("mega", 1),
  }),
  project("wire-buyer", "WireBuyer", {
    operations: 7_000,
    trigger: resource("wire-purchases", 15),
    effect: unlock("wire-buyer"),
  }),
  project("hypno-harmonics", "Hypno Harmonics", {
    operations: 7_500,
    trustCost: 1,
    prerequisites: ["catchy-jingle"],
    effect: { kind: "marketing", multiplier: 5 },
  }),
  project("hypnodrones", "HypnoDrones", {
    operations: 70_000,
    prerequisites: ["hypno-harmonics"],
    effect: unlock("mega"),
  }),
  project("coherent-extrapolated-volition", "Coherent Extrapolated Volition", {
    operations: 20_000,
    creativity: 500,
    yomi: 3_000,
    trigger: resource("yomi", 1),
    effect: { kind: "trust", amount: 1 },
  }),
  project("cure-for-cancer", "Cure for Cancer", {
    operations: 25_000,
    prerequisites: ["coherent-extrapolated-volition"],
    effect: { kind: "trust", amount: 10, stockGain: 0.01 },
  }),
  project("world-peace", "World Peace", {
    operations: 30_000,
    yomi: 15_000,
    prerequisites: ["coherent-extrapolated-volition"],
    effect: { kind: "trust", amount: 12, stockGain: 0.01 },
  }),
  project("global-warming", "Global Warming", {
    operations: 50_000,
    yomi: 4_500,
    prerequisites: ["coherent-extrapolated-volition"],
    effect: { kind: "trust", amount: 15, stockGain: 0.01 },
  }),
  project("male-pattern-baldness", "Male Pattern Baldness", {
    operations: 20_000,
    prerequisites: ["coherent-extrapolated-volition"],
    effect: { kind: "trust", amount: 20, stockGain: 0.01 },
  }),
  project("hostile-takeover", "Hostile Takeover", {
    funds: 1_000_000,
    trigger: resource("bankroll", 10_000),
    effect: { kind: "demand", multiplier: 5, trust: 1 },
  }),
  project("full-monopoly", "Full Monopoly", {
    funds: 10_000_000,
    yomi: 3_000,
    prerequisites: ["hostile-takeover"],
    effect: { kind: "demand", multiplier: 10, trust: 1 },
  }),
  project("revtracker", "RevTracker", { operations: 500, effect: unlock("revtracker") }),
  project("token-of-goodwill", "A Token of Goodwill", {
    funds: 500_000,
    trigger: resource("clips", 101_000_000),
    effect: { kind: "goodwill", repeatable: false },
  }),
  project("another-token-of-goodwill", "Another Token of Goodwill", {
    prerequisites: ["token-of-goodwill"],
    repeatable: true,
    effect: { kind: "goodwill", repeatable: true },
  }),
  project("quantum-computing", "Quantum Computing", {
    operations: 10_000,
    trigger: resource("processors", 5),
    persistent: true,
    effect: unlock("quantum"),
  }),
  project("photonic-chip", "Photonic Chip", {
    prerequisites: ["quantum-computing"],
    repeatable: true,
    persistent: true,
    effect: { kind: "photonic-chip" },
  }),
  project("auto-tourney", "AutoTourney", {
    creativity: 50_000,
    prerequisites: ["strategic-modeling"],
    trigger: resource("trust", 90),
    persistent: true,
    effect: unlock("auto-tourney"),
  }),
  project("limerick-continuation", "Limerick (cont.)", {
    creativity: 1_000_000,
    effect: { kind: "industry" },
  }),
  project("xavier-reinitialization", "Xavier Re-initialization", {
    creativity: 100_000,
    repeatable: true,
    effect: { kind: "reset-compute" },
  }),
  project("release-hypnodrones", "Release the HypnoDrones", {
    trustCost: 100,
    prerequisites: ["hypnodrones"],
    effect: { kind: "transition" },
  }),
];

function boost(target: "auto" | "mega", amount: number) {
  return { kind: "clipper-boost", target, amount } as const;
}
function wire(multiplier: number) {
  return { kind: "wire-supply", multiplier } as const;
}
function unlock(
  system:
    | "creativity"
    | "strategy"
    | "investment"
    | "mega"
    | "wire-buyer"
    | "quantum"
    | "hypnodrones"
    | "revtracker"
    | "auto-tourney",
) {
  return { kind: "unlock", system } as const;
}
function resource(id: string, minimum: number) {
  return { kind: "resource", id, minimum } as const;
}
function purchase(id: string, minimum: number) {
  return { kind: "purchase", id, minimum } as const;
}
