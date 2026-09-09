# Incremental-game library research

Research date: September 8, 2026.

Status: historical research baseline. The implementation that followed is tracked in
[status.md](status.md); present-tense statements about an empty workspace or proposed capabilities
describe the conditions and conclusions of this research pass.

## Recommendation

Build a headless simulation library and an independently usable UX library. The strongest opportunity is to combine reliable time advancement, composable economic rules, and structured explanations of what is happening. Merely removing Vue from a clicker template would not cover the requested games.

Use TypeScript with JavaScript consumption as the working language assumption. The workspace was empty; there is no existing application or language configuration to preserve. This is a research and design pass, not a completed implementation.

## Method and limits

I inspected the supplied live pages, public game scripts, current default-branch source snapshots, framework documentation, and selected competing implementations. Browser inspection covered Antimatter Dimensions at its initial economy and existing progressed interfaces for Paperclips and Kittens. I did not reset those games or play through their campaigns. Later mechanics are source/documentation findings, not claims of hands-on completion.

Repository revisions are pinned in [the source manifest](source-manifest.json). A repository's default branch can differ from its deployed website. Paperclips' exact `?v3` scripts were also downloaded from the supplied site's script references. Competitor comparisons describe inspected capabilities, not production benchmarks, security audits, or proof that undocumented extensions are impossible. This is broad research across the relevant genre and engineering problems, not an exhaustive census of every incremental game.

## What these games ask of an engine

| Game | Main design pressure | Required abstractions | UX pressure |
| --- | --- | --- | --- |
| Universal Paperclips | The economy and player role change across stages | Transactions, limited inputs, power, projects, phase transitions, custom simulations | Reveal and retire whole interfaces without prescribing navigation |
| Antimatter Dimensions | Production chains and multiple reset scales | Huge quantities, generator chains, bulk purchases, modifiers, automation, resets, challenges | Explain multipliers, reset consequences, and fast growth |
| Kittens Game | Resources constrain one another | Storage, recipes, workers, upkeep, calendars, research, reset retention | Explain net production, shortages, capacity barriers, and seasonal risk |

This table is an architectural synthesis of the game sources discussed below.

## Universal Paperclips

The business economy distinguishes manufactured clips, unsold inventory, money, wire, demand, and pricing. Production does not immediately become spendable currency. Later manufacturing introduces matter harvesting, wire processing, factories, and power. The final space economy includes probes and competing allocations. These are different economic structures inside one game. The inspected source uses a frequent main loop and separate slower behavior, with simulation and DOM updates interleaved. [Live game](https://www.decisionproblem.com/paperclips/index2.html), [main script](https://www.decisionproblem.com/paperclips/main.js?v3).

Projects combine prerequisites, costs, one-time effects, and changes to the available game systems. Some transitions replace much of the player's interface and economy. This supports treating projects and phase changes as domain actions, rather than treating every upgrade as a permanent multiplier on one producer. Strategic modeling and probe combat also demonstrate why custom game logic must remain possible. [Project definitions](https://www.decisionproblem.com/paperclips/projects.js?v3), [combat implementation](https://www.decisionproblem.com/paperclips/combat.js?v3).

I found saving/loading but no general elapsed-wall-time catch-up mechanism in the inspected entry point and its game scripts. That conclusion applies to these web scripts, not every mobile version or derivative. Paperclips is therefore a mechanics reference for the proposed offline system, not evidence that it already implements the desired system. [Main script, including save/load and interval loops](https://www.decisionproblem.com/paperclips/main.js?v3).

**Design deductions:** separate stock, production totals, and sales; support input-limited conversion; allow explicit transition effects; keep presentation away from production functions. A story checkpoint needs an offline policy: record the event and continue, hold a choice, or pause selected systems. The library must not auto-purchase a project just because it becomes affordable.

## Antimatter Dimensions

Dimensions produce the tier below them, with the first producing antimatter. Purchased quantities and generated quantities have distinct uses. Purchases interact with cost scaling and buy-ten milestones. Nested progression includes Dimension Boosts, Galaxies, Infinity, Eternity, and Reality, alongside challenges and automation. Reset effects cannot be modeled adequately as one global “prestige multiplier.” [Dimension implementation](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/dimensions/antimatter-dimension.js), [in-game help definitions](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/secret-formula/h2p.js).

The offline path reuses the game loop with a bounded tick count and larger time steps. It includes special handling for time-speed mechanics and passive rewards. Its progress interface lets the player reduce remaining simulation work; the “SKIP” behavior still simulates the remainder using a small number of ticks. This is an explicit fidelity/performance tradeoff. [Simulation implementation](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/game.js#L895).

The help documents why coarse ticks can reduce effective autobuyer frequency and why fewer offline ticks can change results. Storage limits the tick count to at most one million and also limits how short offline ticks can be. A tick budget is not itself an elapsed-time reward cap. The help's one-day-per-tick statement should not be generalized without qualification: the inspected main loop's wall-clock clamp is on the branch without an explicitly passed delta. [Help](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/secret-formula/h2p.js#L126), [tick limits](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/storage/storage.js#L83), [clock handling](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/game.js#L437).

**Design deductions:** preserve fixed simulation semantics when work is batched; schedule automation by game time; distinguish real time from accelerated time; serialize huge numbers explicitly; make reset retention and modifier order inspectable. An offline summary should report resets, unlocks, and milestones as well as resource differences.

## Kittens Game

Kittens combines capped stocks with production, consumption, crafting, buildings, jobs, research, calendar effects, and longer-term progression. Capacity is itself an upgrade gate: a player may produce a resource but never accumulate enough to pay a price. The resource panel visibly separates amount, capacity, and rate, while management features occupy progressively available tabs. [Live game](https://kittensgame.com/web/), [building definitions](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/buildings.js), [calendar](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/calendar.js).

Its offline mechanism, redshift, calls fast-forward implementations across several subsystems. The source caps the elapsed production window at 10 kitten years initially, or 40 when the calendar reaches year 1000 or the player has paragon. At 400 days/year and two real seconds/day, those correspond to approximately 2h13m20s and 8h53m20s. The source rounds elapsed time into days and requires at least three days of offset. The wiki describes a three-second threshold; that wording does not precisely match this code, so use the source for implementation comparisons. [Redshift implementation](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/time.js#L191), [wiki description](https://wiki.kittensgame.com/s/en/game-tabs/time).

The resource fast-forward path deliberately treats negative catnip production differently, temporarily relaxes capacity checks while subsystems run, and enforces limits afterward. These are game-specific offline rules, not a general replay of every foreground tick. [Resource fast-forward](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/resources.js#L843).

**Design deductions:** make offline policy customizable without disguising it as exact replay; distinguish gross production, consumption, and net production; handle shared inputs and constraints deterministically; represent calendars as mechanics. Explain “storage too small” separately from “wait longer.” Avoid copying a game's special-case starvation policy into the generic engine.

## The wider genre

“Incremental” describes progression; “idle” describes what can proceed without input; “clicker” describes one possible interaction. Treat these as overlapping design dimensions. Repeated clicking should not be required by the library.

| Pattern | References | Implication |
| --- | --- | --- |
| Buy producers that generate a common currency | Cookie Clicker, AdVenture Capitalist | Geometric costs, bulk buys, milestones, active bonuses |
| Producers create other producers | Antimatter Dimensions, Derivative Clicker | Chain integration and distinct purchased/generated amounts |
| Resource management and survival | Kittens Game | Conversion constraints, capacity, workers, upkeep |
| An interface unfolds into new activities | Paperclips, A Dark Room | Discovery, phase changes, custom subsystem support |
| Repeated resets unlock a larger progression space | AD, prestige-tree games | Explicit reset scopes, permanent state, challenges |
| Timed skills and inventory production | Melvor Idle | Action durations, recipes, inventory, completion boundaries |

Kongregate's developer-authored series analyzes geometric purchasing, generator chains, and prestige balancing. It is useful mathematical background rather than an engine architecture prescription. [Part I](https://blog.kongregate.com/the-math-of-idle-games-part-i), [Part II](https://blog.kongregate.com/the-math-of-idle-games-part-ii/), [Part III](https://blog.kongregate.com/the-math-of-idle-games-part-iii/).

A Dark Room provides an open-source reference for expansion beyond the initial minimalist interaction. Melvor's first-party wiki describes continuing the selected activity while away and presenting a return summary. Neither requires assuming that every incremental game has the same economy or idle policy. [A Dark Room](https://github.com/doublespeakgames/adarkroom), [Melvor beginner guide](https://wiki.melvoridle.com/index.php?title=Beginners_Guide).

The useful common ground is resources, actions, processes, unlocks, modifiers, and time. Combat AI, exploration maps, story writing, and an all-purpose factory/logistics solver should remain extensions. Otherwise the first release will become an unfinished general game engine.

## TMT: what to retain and what to change

The Modding Tree makes it quick to define prestige layers, upgrades, buyables, challenges, and milestones. Its fork-and-edit workflow and working examples reduce setup friction. Those are meaningful authoring strengths. [Repository](https://github.com/Acamaeda/The-Modding-Tree), [getting started](https://github.com/Acamaeda/The-Modding-Tree/blob/master/docs/tutorials/getting-started.md).

The UI is more customizable than “only a tree”: custom tab formats support rows, columns, built-in components, styles, and HTML. However, customization operates within TMT's component and layer model. That is different from importing game rules into an independently authored interface. [Custom layouts](https://github.com/Acamaeda/The-Modding-Tree/blob/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621/docs/custom-tab-layouts.md).

The stronger coupling is in runtime code: resets and challenges use `Vue.set`; the tick loop reads the DOM and updates tabs/canvas alongside mechanics. Offline time is banked and drained into larger deltas, with a configurable hourly limit. `maxTickLength` can clamp a delta after time has already been removed from that bank, so lowering it requires care. This is a source-derived risk, not a benchmark of all TMT games. [Game loop and reset code](https://github.com/Acamaeda/The-Modding-Tree/blob/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621/js/game.js), [save loading](https://github.com/Acamaeda/The-Modding-Tree/blob/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621/js/utils/save.js), [configuration](https://github.com/Acamaeda/The-Modding-Tree/blob/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621/js/mod.js).

Retain readable definitions, common mechanics, and immediate examples. Replace global singleton state, renderer-dependent mutation, implicit row-based reset assumptions, and layout embedded in game definitions with explicit contracts.

## Alternatives and adjacent tools

| Project | Verified value | Fit and limitation for this project |
| --- | --- | --- |
| [Profectus](https://github.com/profectus-engine/Profectus) | TypeScript, resources, conversion helpers, composable features | Worth studying for authoring; resource types extend Vue refs and the game loop imports Vue, so it does not meet the independence requirement |
| [clicker-engine / @fidget/idle-engine](https://github.com/blixxurd/clicker-engine) | Framework-independent TypeScript, registries, events, persistence, resource capacities, UI subscriptions | Closest inspected baseline; offline application delegates one large delta to production math using ordinary numbers |
| [incremental-core](https://github.com/mikelovesrobots/incremental-core) | Separates definitions from player state; generator, upgrade, and prestige helpers | Useful small authoring reference; README leaves loop and basic JSON persistence to the consumer; not evidence of a comprehensive offline scheduler |
| [igt-library](https://github.com/123ishaTest/igt-library) and [igt-vue](https://github.com/123ishaTest/igt-vue) | A reusable helper library exists separately from a Vue template | Do not dismiss it as simply a Vue engine; package metadata for the library has no Vue dependency. Inspected at README/manifest depth only |
| [Continuum Engine](https://github.com/carribus/continuum-engine) | Declarative model, currencies and progression concepts | Earlier model-oriented reference; inspected revision dates to 2019, not a maintenance guarantee |
| [Idle Game Maker](https://orteil.dashnet.org/igm/main.html) | Low-friction text-file game creation | Useful onboarding comparison; a interpreted game-making format differs from a composable TypeScript library |
| [Tickwork](https://tickwork.dev/) | Explicit headless Rust/WASM engine and separate egui shell | Architectural parallel; language and shared-shell choices differ. Website claims inspected, implementation not audited |

Profectus' resource implementation contains Vue's `Ref`, `computed`, and `watch`; its time loop drains offline time into larger deltas before clamping. [Resource code](https://github.com/profectus-engine/Profectus/blob/d69197d5c7225a0bb58b5a4d5f8e19c1c04a61ea/src/features/resources/resource.ts), [loop](https://github.com/profectus-engine/Profectus/blob/d69197d5c7225a0bb58b5a4d5f8e19c1c04a61ea/src/game/gameLoop.ts).

The inspected clicker-engine offline function floors the absence to seconds and calls `TickService.tick` once. That service integrates fixed production rates, applies caps, and floors item outputs for the supplied delta. It is a useful baseline for straightforward producers, but the inspected path does not establish equivalence for a chain of evolving generators or event-driven automation. Per-call item rounding also motivates persistent fractional remainders in this design. [Offline function](https://github.com/blixxurd/clicker-engine/blob/feeafc157f04aab56b2bbab86390b02ae2e11863/src/core/persistence/index.ts#L214), [tick service](https://github.com/blixxurd/clicker-engine/blob/feeafc157f04aab56b2bbab86390b02ae2e11863/src/service/TickService.ts).

**Build-versus-adopt decision:** a new small core is justified if consistent time accounting and heterogeneous economies are the product. Existing libraries already cover basic generators and framework independence. The implementation should prove its additional value with the three example economies before growing its API surface.

## Numbers and formatting

| Choice | Appropriate use | Tradeoff |
| --- | --- | --- |
| JavaScript `number` | Time, bounded indices, modest economies | Finite range and precision; cannot represent AD-scale currencies indefinitely |
| [break_infinity.js](https://github.com/Patashu/break_infinity.js) | Very large exponential quantities | Prioritizes speed/range over exact arithmetic |
| [break_eternity.js](https://github.com/Patashu/break_eternity.js) | Layered exponentials and more extreme growth | Greater representational range; still approximate and requires compatible operations/formatters |
| [decimal.js](https://github.com/MikeMcl/decimal.js) | Explicit precision requirements | Different performance/precision tradeoff; benchmark against the actual economy |
| JavaScript `bigint` | Exact integer counters where useful | No fractional production; not a general replacement for large incremental quantities |

Use an established numeric library, with a constrained adapter contract and one chosen backend per game's economic domain. Do not build a new big-number format. Prototype with `break_eternity.js` as the broad-range adapter; keep a native-number adapter for simple games and tests. Benchmark before making either the universal default. Do not imply that switching adapters preserves all numerical behavior.

The separate [Antimatter Dimensions notations library](https://github.com/antimatter-dimensions/notations) shows that formatting is reusable independently of a game's layout. Verify backend compatibility before adopting it. Economy comparisons must always use underlying values, never formatted strings.

## Browser realities

Hidden tabs can have timers throttled and animation frames stopped. Therefore callbacks are opportunities to advance the simulation, not the definition of elapsed time. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

Use a monotonic clock for active-session timing, a persisted wall-clock anchor for return timing, and explicit reconciliation across suspension. Browser/platform behavior during sleep varies; do not add both clock deltas for the same interval. [Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now).

Multiple tabs need a single-writer policy; Web Locks supplies an applicable origin-scoped coordination primitive. Storage is fallible and may be evicted, so export, backups, and visible save failures belong in the supported workflow. [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

“Progress while closed” and “launch without a network” are separate features. Catch-up reconstructs elapsed progress on return. A service worker can support cached app assets, but is not an indefinitely running background game process. [Offline web applications](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## Research conclusions

1. Make time advancement a public, testable contract.
2. Separate elapsed-time entitlement, work budget, numerical approximation, and resource capacity.
3. Use the same rule and action implementations in active play, automation, and offline processing.
4. Let declared processes expose enough structure to optimize safely; custom callbacks get an explicit stepped fallback.
5. Produce explanations alongside calculations so UX never reimplements the economy.
6. Validate the library against three distinct small games and two unrelated interfaces before stabilizing its API.

The detailed proposal is in [design.md](design.md), with policy and recovery semantics in [offline.md](offline.md).
