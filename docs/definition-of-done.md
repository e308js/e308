# e308 v1 definition of done

Status: automated release-candidate infrastructure is passing. The full internal emulations,
original-game depth, playtesting, and physical-device checks remain open.

**e308 is done when its public packages demonstrate every required TMT capability, its internal test suite fully emulates Universal Paperclips and Antimatter Dimensions, its three original games are mechanically and visually distinct complete games, and all reproducible correctness, recovery, usability, pacing, and performance gates pass with inspectable evidence.**

## Release gates

| Gate | Passing condition | Required evidence |
| --- | --- | --- |
| D1: TMT parity | Every required leaf in the pinned TMT inventory passes; zero unmapped source entries | [Parity register](tmt-parity.md), executable fixtures, relevant interactive demonstrations, source-to-test mapping |
| D1R: Full internal emulations | Universal Paperclips and Antimatter Dimensions pass the complete internal emulation gate; the Kittens suite remains supplemental coverage | [Full emulation gate](full-emulation-gate.md), complete source inventories, fresh-save traces, normalized state/event comparisons |
| D2: Three games | Wireworks, Cascade, and Hearth meet the game contracts below from new save to designed ending | Playable builds, source, completion traces, beginning/middle/end saves, human walkthrough records |
| D3: Correctness | Independent mathematical/reference checks and invariants pass for each game and core mechanic | Oracle derivations, expected values, property tests, replay comparisons, retained failure seeds |
| D4: Offline and saves | Cap, unlimited entitlement, interruption, migration, RNG, and writer-ownership cases pass | Fault-injection matrix, browser checks, migration fixtures, offline accounting reports |
| D5: Authoring and UX | Games consume public APIs; renderer is optional/replaceable; full actions are accessible | Package-boundary checks, clean-consumer builds, renderer swap, keyboard/touch reviews |
| D6: Harness and pacing | Multiple policies/schedules produce reproducible, truthful reports for all three games | Machine-readable reports, human-readable comparisons, known balance-regression fixtures |
| D7: Performance and portability | Declared workloads meet the frozen release budgets with no concealed fidelity reduction | Benchmark environment and repeated-run results; tested runtime matrix; exact/tolerant comparisons |
| D8: Deliverable packages | Installable release candidates build, document, and exercise all gates from a clean checkout | Package archives, exported type checks, CI run, evidence manifest, review sign-off |

All gates are conjunctive: one failure blocks the v1 completion claim. Theoretical support, private engine edits, “a callback could do it,” screenshots alone, skipped tests, and missing evidence are not passing statuses. A narrower preview release can ship earlier but must be labeled as such.

## D1: What parity means

Freeze TMT at commit `4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621` (the inspected 2.7 baseline), its 21 Markdown documentation files, and relevant runtime code. [Pinned upstream](https://github.com/Acamaeda/The-Modding-Tree/tree/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621). Expanding to a newer TMT version is a separately versioned scope change.

Parity means equivalent author/player capabilities through e308's public primitives, supplied recipes, extensions, and optional UX components. It does not mean source compatibility with TMT mods, importing existing TMT saves, using Vue, matching pixels, or reproducing undocumented bugs. Every difference in observable timing or rounding is named in the register; it cannot be hidden behind “equivalent.”

Each documentation feature/property/helper is mapped to one or more atomic acceptance cases. Deprecated aliases may map to the same modern capability; exact legacy spelling is unnecessary. Implementation-only mechanisms such as `Vue.set` and the temp-function exclusion list receive a reasoned internal-mechanism disposition, not an invented feature test. Gameplay and visual capabilities cannot be excluded merely because they are inconvenient. A required exclusion would block an unqualified parity claim.

The [parity register](tmt-parity.md) defines the required capability groups, leaf-inventory rules, and evidence. Its source reconciliation is mandatory before D1 can pass; the group table alone is not a complete property-by-property audit.

## D2: Three different complete games

The original research references are part of the acceptance baseline. [D1R](full-emulation-gate.md)
requires full internal emulations of Universal Paperclips and Antimatter Dimensions. The Kittens Game
suite remains an additional complex-economy reference. Reference fixtures stay outside npm packages
and the public site. Paperclips' stock/sales separation, constrained industry, and phase transitions
also remain mapped into Wireworks as design lineage.

These are original, finite demonstration games inspired by three different economic structures. Small prototypes remain useful during implementation but cannot satisfy D2. Each release game has a new-player beginning, meaningful choices, multiple progression stages, a visible ending, instructions, save/export/import, offline reporting, and usable desktop/touch interfaces. All economic rules and content ship in the inspected game source.

| Game | Minimum finished content | Distinctive play and presentation | Completion criterion |
| --- | --- | --- | --- |
| **Wireworks** | Three eras: workshop sales, powered industry, autonomous expansion; at least 12 meaningful projects; a demand/price market; input and power constraints; a story choice | Player balances price, stock, investment, and power, then changes production priorities. Narrative control panels appear/retire with eras | Complete the final expansion project through a legal command trace; ending and all required story events remain readable |
| **Cascade** | Eight producer tiers; normal and static prestige plus a higher reset scope; buy-ten milestones; six challenges including a compatible combination and multi-completion; respec; automation; quantities above `1e308` | Player chooses upgrades, reset timing, challenge order, and automation policy. Dense mathematical tables, breakdowns, and optional progression tree | Complete the final challenge/research goal after exercising all reset levels; final reward grants once |
| **Hearth** | At least eight resources, four worker jobs, four seasons, ten recipes/research unlocks, paid tasks, storage pressure, scarcity consequences, a recovery route | Player balances food, labor, crafting, reserves, and seasonal risk. Settlement/workforce view and calendar, with no mandatory prestige loop | Survive a complete seasonal cycle, recover from a designed shortage, and complete the final settlement objective |

Counts are coverage floors, not permission to pad with identical upgrades. Each game must have at least two consequential strategy/allocation choices whose differing effects appear in reports. The three must differ in dominant production model, decision structure, and interface composition. Reusing primitives is expected; changing labels on the same progression loop fails this gate.

Every game needs a known winning script from a new save with no debug grants, save editing, or direct state mutation. Accelerated headless clock advancement is allowed and recorded; changing production multipliers to force completion is not. A reviewer, who may be the implementer, must complete or review a recorded full legal playthrough and directly exercise the significant UI choices. Pacing targets and maximum simulated completion horizons are frozen with each game's content spec before acceptance runs, with later changes versioned.

Each game must build as an independent consumer of package archives using only public exports. No imports from engine source/private paths, game-ID conditionals inside core, renderer-driven economic updates, or copied bespoke save/offline loops. At least one game's novel mechanic uses a documented custom extension and runs headlessly. Any necessary engine change must become a general public capability and rerun all gates.

## D3: Evidence for correctness

“Prove correctness” here means satisfy explicit invariants and independently derived expected behavior over the declared contracts and test domain. It is not a claim of formal proof for all possible game programs.

Each game must have all four evidence classes:

1. **Independent oracle:** small hand-derived or independently implemented reference scenarios, without importing the engine's arithmetic/production/purchase helper being tested. Use exact integers/rationals where possible. Record derivations and reference limitations.
2. **Invariant properties:** conservation, nonnegative stocks, capacity/overflow rules, atomic spending, scoped retention, once-only rewards, and paid task output. Run seeded property tests; retain minimized failures.
3. **Canonical replay:** identical commands/seed and elapsed time across one-shot/chunked advancement, save/load boundaries, main thread/worker, and different render rates. Compare economic state and ordered domain events, excluding diagnostic wall-clock fields.
4. **Independent behavior comparison:** TMT fixtures where semantics match, and declared game-specific reference fixtures where e308 intentionally differs. A copy of e308's code in a reference file is not an independent oracle.

Minimum game oracles: Wireworks multi-resource stock/payment/market transactions and input-limited power production; Cascade a closed-form discrete chain, segmented purchase costs, large-number ordering, and reset/challenge reward calculation; Hearth worker allocation, seasonal food ledger, recipe escrow/refund, and capacity effects. Pure stepping versus fast-forward comparisons are additional evidence, not sufficient independent evidence: both paths could share a bug.

For every optimized path, compare canonical state and discrete outcomes against the specified reference at beginning/middle/end saves and around thresholds. Changed floating-point rounding classifies a path as approximate. If an approximate path is offered, predeclare error bounds for quantities and permitted outcomes per fixture, label reports, and fail unexpected branch/reset differences. Never redefine tolerances after observing a failure without recording a specification change.

## D4: Offline and recovery matrix

For all three games, run beginning/middle/end checkpoints through absences of 0, 1 minute, 1 hour, 8 hours, 1 day, and 30 days under disabled, fixed-cap, dynamic-cap, and unlimited-entitlement policies. Compare to a reference using the **same** policy. Shortage protection or custom rewards intentionally differ from foreground replay and need their own oracle.

Exercise crashes before/after session creation, each chunk commit, migration/compensation, and session completion. Reload must neither duplicate committed rewards nor lose eligible pending time. Check fractional work, random streams, queued actions, resets, required choices, and reports. Vary chunk budgets without varying entitlement.

The boundary suite additionally covers backward clocks, invalid timestamps, storage failure, corruption, future versions, numeric-codec changes, rules updates midway through catch-up, two tabs racing for ownership, hidden-tab throttling, and device sleep recovery. Automated clock injection and real browser/device checks are labeled separately. A very long unsupported replay may pause with preserved pending work, but the bounded small-game workloads required by D7 must complete within their release budgets.

## D5–D6: Authoring, renderer, and harness

Render one unchanged game/save through two substantially different interfaces, replace one supplied control, and add a custom mechanic view. Mount/dispose repeatedly without duplicate commands or leaked subscriptions. Render UX against a non-core source. All major controls expose costs, blockers, focus/keyboard behavior, and touch-accessible explanations; undiscovered content must not leak through the view model.

For each game run an ordered winning policy, seeded random-legal play, a simple ranked/greedy policy,
and a game-authored goal policy under active, intermittent, and long-absence schedules. The
active-player bot stops while away. Use explicit seed lists for stochastic content and report
unreached goals alongside success distributions. Include a poor policy and a mechanically certified
barrier so reports distinguish strategy failure from impossibility.

Every published example has an authored final goal reachable through ordinary controls and a clear
progression path to that goal. Its known-winning policy reaches the goal across the acceptance seed
set. Random-legal play has a lower success rate within the fixed horizon or a slower conditional
median completion time. Record the lowest-complexity winning strategy found, a representative winning
strategy, and the fastest known strategy with their tree hashes, reachable branch counts, action
counts, and completion distributions. Claims of minimum complexity require bounded exhaustive proof.

A parameter sweep and two content-version baselines must detect a known changed bottleneck/milestone time. Reports contain versions, seeds, schedule, fidelity, elapsed/game/active time, actions, waits, overflow, reset recovery, and causal diagnostic evidence. A replay command or equivalent documented invocation reproduces each artifact.

## D7–D8: Performance and delivery

Freeze a reference hardware/runtime specification before acceptance measurement. Use the workload matrix in [contracts.md](contracts.md#8-determinism-and-performance-boundaries). For the small-game eight-hour catch-up target, perform at least ten measured runs per beginning/middle/end fixture and report cold/warm results separately; p95 elapsed catch-up must be at most two seconds on that declared reference system. Use enabled actual game automation. Canonical or numerically identical validated shortcuts must meet this gate; an approximate mode cannot silently substitute. Measure large-gap completion times and retain the 30-day results even where no two-second promise is made.

Browser runs must have no avoidable library-originated main-thread task longer than 50 ms in the representative fixtures, with an 8 ms cooperative chunk target. Publish exceptions for user-authored synchronous rules; the supplied examples cannot use that exception to pass. Record memory, throughput, response latency, long tasks, and event/report bounds. If targets prove unsuitable, revise the release contract explicitly before rerunning; do not mark a failing run as done.

Every implementation slice must be tested locally, committed, pushed, and green on all required CI checks for its current head SHA. The [quality gates](quality-gates.md) require at least 80% lines, statements, functions, and branches per package and executable source file, including unimported source; nonmutating Biome lint/format checks; enforced file/function budgets; dependency and duplication checks; and public-consumer DX fixtures. The [implementation plan](implementation-plan.md) and [slice specifications](implementation-slices.md) define the delivery sequence.

CI covers clean package consumption, strict types, forbidden dependencies, Node smoke tests, unit/property/reference checks, save fixtures, and browser integration. Test native and chosen large-number adapters. Exact replay is scoped to each supported runtime configuration; cross-engine numeric tolerances and exact discrete-outcome checks follow [interfaces.md](interfaces.md#determinism-boundary).

An evidence manifest ties every gate and parity leaf to package/content hashes, environment, fixtures,
command, expected/actual result, and artifact location. No required entry may be missing, skipped, or
marked future. The implementer may complete every review and playtest record. Newly discovered
unsupported required features reopen the affected gate; fixes affecting shared behavior invalidate
and rerun relevant evidence.

Publishing to npm or creating remote repositories is not required to prove done: installable package archives and reproducible local/CI evidence suffice. The final claim must read “e308 v1 meets this pinned feature and game contract,” with its evidence bundle, not “supports any incremental game.”
