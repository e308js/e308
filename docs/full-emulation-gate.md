# Reference-game implementation proof

Status: **PASS**

e308 uses internal implementations of representative Universal Paperclips systems and the A/B
progression of Array Game to prove that the engine can support established incremental-game designs.
The implementations are test fixtures.
Pages, npm archives, package exports, and public example navigation contain original e308 material.

## Shared passing conditions

Together, the implementations must meet every condition below from pinned source revisions or
content hashes.

1. The selected mechanics cover production chains, purchasing, unlocks, allocation, markets,
   projects, phase transitions, large values, and an ending. Each selected mechanic has executable
   evidence and an exact-or-tolerant comparison policy.
2. A fresh-save legal action trace reaches the declared stopping point. Seeded later-game fixtures may test
   individual boundaries, but they do not replace the fresh-save trace.
3. Normalized golden traces compare representative purchases, unlocks, resets, phase changes, and
   choices. Discrete state is exact, and numeric tolerances are declared before a trace runs.
4. Save/load, deterministic command replay, time partitioning, offline progress, worker execution,
   and interruption/resume preserve the declared state and event order.
5. The headless harness completes the declared progression and produces pacing and blocker reports.
   The combined proof includes ranked and seeded-random play with different completion times.
6. The internal renderer exposes controls and state for beginning, middle, and end fixtures. Browser
   tests exercise those controls. The renderer remains excluded from Pages and release archives.
7. Biome, strict TypeScript, structure limits, package checks, Playwright, performance budgets, and
   per-file 80% coverage pass at the exact commit.

## Universal Paperclips

The baseline is the four v3 scripts pinned in `reference/paperclips/manifest.json`. The proof covers:

- the retail economy, manual and automatic production, wire market, price/demand sales, marketing,
  trust, processors, memory, operations, creativity, quantum chips, investments, and tournaments;
- terrestrial matter harvesting, wire conversion, factories, power generation/storage, swarm gifts,
  and automation;
- probe construction and trust allocation, replication, hazards, exploration, resource conversion,
  drift, combat, honor, battle progression, and dynamic threnodies;
- an authored ending reached from a fresh save, plus direct tests for the alternate dismantling route;
- serialization of all canonical economy, project, random, phase, combat, and ending state.

The checked source inventory contains 96 projects. The campaign maps the project catalog and directly
tests representative dynamic, repeatable, mutually exclusive, prestige, and dismantling projects.
The project inventory records the wider source surface for research and does not assert exact
full-game content parity.

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
| Paperclips implementation | Retail, industry, space, dynamic projects, accepted prestige, and timed rejection traces | PASS |
| Paperclips runtime completion | Save/load, interrupted canonical catch-up, worker protocol, and fresh-save strategy | PASS |
| Paperclips source comparisons | Initial state, retail scheduling, machine and drone curves, production, Trust, marketing, strategy unlocks, Photonic Chips, quantum operations, terrestrial unlocks, flocking tiers, and the first phase transition | PASS |
| Array source scripts pinned | Four exact SHA-256 hashes | PASS |
| Array A/B economy | Generator chains, purchases, eight upgrades, boosterators, first reset | PASS |
| Array A/B completion | Save/offline, source traces, two strategies, B-era target, performance, worker | PASS |
| Antimatter minimum mechanics | AD01–AD06 supplemental suite | PASS |
| Publication isolation | Site and archive rejection checks | PASS |

The source inventories can support future regression cases without expanding this v1 proof scope.
