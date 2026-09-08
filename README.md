# e308

**e308** is the library name. npm packages use the user-owned `@e308` organization; `e308js` is the planned GitHub organization name.

Research and proposed design for a TypeScript library for incremental games, with offline progress and a separate, optional UX library.

The intended fit is games with the variety of Universal Paperclips, Antimatter Dimensions, and Kittens Game. Developers own their game rules, interface framework, layout, and visual identity.

The proposed scope has four parts: deterministic simulation (ticks, big numbers, offline progress, saves); composable mechanics (producers, buyables, prestige layers, challenges, allocations, markets); a headless bot-player and pacing-report harness; and an optional, replaceable renderer backed by the separate UX library.

The repository now contains the implementation workspace and its governing research/design documents. `@e308/core` has its deterministic foundation under active development; no package has been published to npm yet. See [implementation status](docs/status.md) for exact commits and CI evidence.

- [Definition of done](docs/definition-of-done.md): the v1 release gate and required evidence; all implementation results remain NOT RUN.
- [TMT parity register](docs/tmt-parity.md): pinned feature coverage, source reconciliation, and acceptance rules.
- [Reference-game parity](docs/reference-game-parity.md): required Antimatter Dimensions and Kittens Game slices, plus Paperclips-to-Wireworks mapping.
- [Game and ecosystem research](docs/research.md): source-backed findings, genre coverage, TMT and alternatives.
- [Library design](docs/design.md): package boundaries, authoring model, simulation, persistence, and UX contracts.
- [Resolved design contracts](docs/contracts.md): production semantics, resets/challenges, balance tools, bot comparisons, content modules, update policy, renderer integration, and determinism/performance boundaries.
- [Interface decisions and review disposition](docs/interfaces.md): numeric adapter, typed rates, snapshots, failures, PRNG/save format, and deferred interface/tooling gates.
- [Offline progress specification](docs/offline.md): developer policies, exactness, elapsed-time accounting, and recovery.
- [Implementation and validation plan](docs/implementation-plan.md): twelve substantial AI-sized slices and the test, commit, push, and CI workflow.
- [Implementation status](docs/status.md): accepted slice SHAs, CI runs, and active work.
- [Slice specifications](docs/implementation-slices.md): deliverables, acceptance tests, and evidence for each capability.
- [Quality gates](docs/quality-gates.md): 80% coverage floors, Biome, file sizes, DRY, and consumer DX.
- [Source manifest](docs/source-manifest.json): pinned repository revisions and inspected public source hashes.

Research date: September 8, 2026. See the research document for scope and limitations.
