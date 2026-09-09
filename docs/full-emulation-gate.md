# Full internal emulation gate

Status: **IN PROGRESS**

e308 must complete an internal emulation of Universal Paperclips and the A/B progression of Array Game before
the three original games can satisfy the final game-quality gate. The emulations are test fixtures.
Pages, npm archives, package exports, and public example navigation contain original e308 material.

## Shared passing conditions

Both emulations must meet every condition below from pinned source revisions or content hashes.

1. A source inventory assigns every player-reachable mechanic and content entry an implementation
   ID, an exact-or-tolerant comparison policy, and executable evidence. The inventory has zero
   unclassified entries.
2. A fresh-save legal action trace reaches the declared stopping point. Seeded later-game fixtures may test
   individual boundaries, but they do not replace the fresh-save trace.
3. Normalized golden traces from the pinned implementation and the e308 implementation compare at
   purchases, unlocks, resets, phase changes, challenges, choices, and the ending. Discrete state is
   exact. Numeric tolerances are declared before a trace runs and cannot hide different unlocks or
   decisions.
4. Save/load, deterministic command replay, time partitioning, offline progress, worker execution,
   and interruption/resume preserve the declared state and event order.
5. The headless harness completes the declared progression with at least two materially different policies and
   produces pacing and blocker reports. Required player choices remain legal actions.
6. The internal renderer exposes the controls and state needed to inspect beginning, middle, and end
   fixtures. It is excluded from Pages and release archives.
7. Biome, strict TypeScript, structure limits, package checks, Playwright, performance budgets, and
   per-file 80% coverage pass at the exact commit.

## Universal Paperclips

The baseline is the four v3 scripts pinned in `reference/paperclips/manifest.json`. Completion covers:

- the retail economy, manual and automatic production, wire market, price/demand sales, marketing,
  trust, processors, memory, operations, creativity, quantum chips, investments, and tournaments;
- every project object in source order, including its trigger, dynamic price, cost, repeatability,
  state changes, and mutually exclusive or staged outcomes;
- terrestrial matter harvesting, wire conversion, factories, power generation/storage, swarm gifts,
  boredom, momentum, and automation;
- probe construction and trust allocation, replication, hazards, exploration, resource conversion,
  drift, combat, honor, battle progression, and dynamic threnodies;
- the Emperor sequence, Accept and Reject branches, dismantling sequence, prestige choices, temporal
  reversion, and reinitialization behavior;
- serialization of all canonical economy, project, random, phase, combat, and ending state.

The checked source inventory contains 96 projects. The current campaign harness maps 73 of them and
uses approximate pacing in several mapped effects. The remaining 23 projects, exact effects, and
golden source traces are open work. A campaign-ending bot report alone does not pass this gate.

## Array Game

The baseline is browser version 0.4.2, pinned by the four SHA-256 hashes in
`reference/array/manifest.json`. The stopping point is the v0.1.3 B-era target in the pinned
changelog: 1e10 B and 1e180 A. Completion covers:

- the A and B five-tier generator chains, their purchase curves, count multipliers, and cross-tier
  production;
- all three repeatable A upgrades, the A-boosterator economy, and all eight one-time B upgrades;
- the A→B reset formula and scope, the B multiplier for A, passive B income, and every interaction
  among these systems;
- large-number saves, deterministic 16 ms replay, offline progress, legal-action pacing from a fresh
  save, and a high-frequency performance measurement.

The current fixture pins the live v0.4.2 source and implements the A/B economy, eight B upgrades,
boosterators, persistence, offline progress, worker execution, source-normalized checkpoints,
ranked and seeded random fresh-save strategies, and an internal beginning/middle/endpoint inspector.

## Current evidence

| Work item | Current evidence | Status |
| --- | --- | --- |
| Paperclips source scripts pinned | Four exact SHA-256 hashes | PASS |
| Paperclips project inventory | 96 unique source variables and DOM IDs | PASS |
| Paperclips campaign skeleton | 73 source-mapped projects; three phases; one ending trace | PARTIAL |
| Paperclips exact golden traces | Initial state, retail scheduling, machine and drone curves, production, Trust, marketing, strategy unlocks, Photonic Chips, quantum operations, terrestrial unlocks, flocking tiers, and the first phase transition | PARTIAL |
| Array source scripts pinned | Four exact SHA-256 hashes | PASS |
| Array A/B economy | Generator chains, purchases, eight upgrades, boosterators, first reset | PASS |
| Array A/B completion | Save/offline, source traces, two strategies, B-era target, performance, worker | PASS |
| Antimatter minimum mechanics | AD01–AD06 supplemental suite | PASS |
| Publication isolation | Site and archive rejection checks | PASS |

This gate passes only when every row required by the two game sections has executable evidence and no
open or partial status remains.
