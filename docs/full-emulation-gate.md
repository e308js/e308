# Full internal emulation gate

Status: **IN PROGRESS**

e308 must complete internal emulations of Universal Paperclips and Antimatter Dimensions before
the three original games can satisfy the final game-quality gate. The emulations are test fixtures.
Pages, npm archives, package exports, and public example navigation contain original e308 material.

## Shared passing conditions

Both emulations must meet every condition below from pinned source revisions or content hashes.

1. A source inventory assigns every player-reachable mechanic and content entry an implementation
   ID, an exact-or-tolerant comparison policy, and executable evidence. The inventory has zero
   unclassified entries.
2. A fresh-save legal action trace reaches the authored ending. Seeded later-game fixtures may test
   individual boundaries, but they do not replace the fresh-save trace.
3. Normalized golden traces from the pinned implementation and the e308 implementation compare at
   purchases, unlocks, resets, phase changes, challenges, choices, and the ending. Discrete state is
   exact. Numeric tolerances are declared before a trace runs and cannot hide different unlocks or
   decisions.
4. Save/load, deterministic command replay, time partitioning, offline progress, worker execution,
   and interruption/resume preserve the declared state and event order.
5. The headless harness completes the campaign with at least two materially different policies and
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

The checked source inventory contains 96 projects. The current campaign harness maps 36 of them and
uses approximate pacing in several mapped effects. The remaining 60 projects, exact effects, and
golden source traces are open work. A campaign-ending bot report alone does not pass this gate.

## Antimatter Dimensions

The baseline begins at commit `5409e320cecef96a917cca1dfb68f1f183e499ca`. The full source
dependency inventory must be frozen before this gate can pass. Completion covers the player-reachable
campaign through the pinned ending, including:

- Antimatter, Infinity, Time, and Reality Dimensions with their purchases, production order,
  multipliers, unlocks, and autobuyers;
- Dimension Boosts, Galaxies, Sacrifice, Infinity, Eternity, Dilation, Reality, and their exact reset
  scopes and retained progression;
- Normal, Infinity, Eternity, and Dilation challenges with their completion rules and rewards;
- Infinity upgrades, Eternity milestones/upgrades, Time Studies, Eternity Challenges, Time Dilation,
  Reality upgrades, glyphs, perks, black holes, and the Automator;
- all Celestial campaigns and mechanics through Pelle and the terminal game state;
- large-number state, deterministic discrete outcomes, saves, offline processing, and automation at
  every progression era.

Cosmetic themes, news messages, platform achievements, and secret-only content are recorded in the
source inventory with a non-gameplay disposition. Their exclusion cannot remove a production rule,
unlock, choice, reward, or state field used by the campaign.

The existing AD01–AD06 suite is a passing minimum-mechanics checkpoint. A full source inventory,
later progression eras, a fresh-save completion trace, and end-to-end golden comparisons remain open.

## Current evidence

| Work item | Current evidence | Status |
| --- | --- | --- |
| Paperclips source scripts pinned | Four exact SHA-256 hashes | PASS |
| Paperclips project inventory | 96 unique source variables and DOM IDs | PASS |
| Paperclips campaign skeleton | 36 source-mapped projects; three phases; one ending trace | PARTIAL |
| Paperclips exact golden traces | Initial state, retail actions, machine curves, and early production projects | PARTIAL |
| Antimatter minimum mechanics | AD01–AD06 | PASS |
| Antimatter full source inventory | Complete reachable-content ledger | OPEN |
| Antimatter full campaign | Fresh-save trace through the pinned ending | OPEN |
| Publication isolation | Site and archive rejection checks | PASS |

This gate passes only when every row required by the two game sections has executable evidence and no
open or partial status remains.
