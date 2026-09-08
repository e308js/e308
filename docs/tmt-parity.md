# TMT capability parity register

Status: required coverage specification. All implementation results are **NOT RUN**. This register sets the D1 scope in [definition-of-done.md](definition-of-done.md); it does not claim existing parity.

Baseline: Acamaeda/The-Modding-Tree, commit `4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621`. Sources below are relative to its [pinned docs directory](https://github.com/Acamaeda/The-Modding-Tree/tree/4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621/docs). Public source was inspected for this register. File hashes are tracked in [source-manifest.json](source-manifest.json).

## Required capability groups

Each group must be split into atomic source-property/helper cases in the release evidence inventory. A group passes only if every required leaf passes. Every behavioral case includes initial state, action/time input, expected state/events or visible behavior, boundaries, and evidence location. A broad group row is not a test.

| ID | Capability and required variants | Expected e308 surface | Source |
| --- | --- | --- | --- |
| T01 | Game identity, starting points/state, custom global and per-layer saved data, version metadata | Game/module definitions, scopes, codecs | `main-mod-info.md`, `basic-layer-breakdown.md` |
| T02 | Huge quantities, formatting, comparisons, serialization, best/total/reset-time counters | Numeric adapter, counter ledger, UX formatting | `!general-info.md`, `layer-features.md` |
| T03 | Constant and dynamic requirements, costs, effects, visibility, descriptions and styles | Typed formulas/callbacks and projected views | `!general-info.md`, `layer-features.md`, component pages |
| T04 | Normal prestige: threshold, exponent, gain multipliers/exponents, direct multiplier, soft cap | Supplied normal-prestige recipe | `layer-features.md`, `js/game.js` |
| T05 | Static prestige: increasing requirements, round-up cost, buy-one/max, multipliers/exponents and direct gain effects | Supplied static-prestige recipe | `layer-features.md`, `js/game.js` |
| T06 | Custom and no-prestige layers; custom gain/next-threshold/eligibility functions | Custom reset recipe; ordinary scope | `layer-features.md` |
| T07 | Higher/equal/side-layer reset behavior, selective retention, reset-nothing, pre-prestige side effects | Explicit scope/reset manifests with a demonstrated equivalent configuration | `layer-features.md`, `js/game.js` |
| T08 | Passive prestige gain, automatic prestige, automatic upgrades, custom post-production automation | Flows and scheduled validated actions | `layer-features.md` |
| T09 | Unlock-order-dependent progression and deactivated layers/effects/actions | Persistent flags, eligibility and modifier policies | `layer-features.md` |
| T10 | One-time upgrades: custom currencies, affordability/payment, effects and purchase hooks | Purchases and atomic custom transactions | `upgrades.md` |
| T11 | Rebuyables: arbitrary cost/effect functions, amount get/set/add, purchase limits and buy-max | Buyables, count-domain capability, public actions | `buyables.md` |
| T12 | Sell-one/all and respec: refunds, visibility, confirmations, custom effects | Sell/respec recipes and previews | `buyables.md` |
| T13 | Milestones: thresholds, completion hooks, automation toggles, display policy | Milestones and persistent automation settings | `milestones.md` |
| T14 | Achievements: goals, visibility, effects, completion hooks, state-dependent tooltips | Achievement ledger and projected views | `achievements.md` |
| T15 | Challenges: entry/exit, custom goals, rewards, completion count/limit, bulk completion | Challenge lifecycle and tier rewards | `challenges.md` |
| T16 | Challenge `countsAs` relationships and queries; combined restrictions; maxed/completed queries | Explicit challenge membership/compatibility recipe | `challenges.md` |
| T17 | Clickables: saved arbitrary state, eligibility, click/hold effects, master action | Custom action/state and input binding | `clickables.md` |
| T18 | Stateful grids: per-cell initial data, dynamic displayed rows/columns, click/hold/effects, hidden cells | Collection state and optional grid view | `grids.md` |
| T19 | Prestige/layer/upgrade/buyable/clickable trees with branch style, node position, images, ghost nodes | Optional explicitly positioned tree view; game-owned reset rules | `trees-and-tree-customization.md`, `custom-tab-layouts.md`, `layer-features.md` |
| T20 | Non-layer clickable nodes, side nodes, display-row independent of reset order | Optional node components and explicit composition | `trees-and-tree-customization.md`, `layer-features.md` |
| T21 | Tabs/microtabs, unlocking, embedded layers, proxies, independent navigation/back action | Game-owned keyed view composition and navigation recipes | `subtabs-and-microtabs.md`, `custom-tab-layouts.md`, `layer-features.md` |
| T22 | Custom game/tab layouts, rows/columns/spacing, single-component rendering, inserted sections | DOM composition and overridable controls | `custom-tab-layouts.md`, `trees-and-tree-customization.md` |
| T23 | Dynamic rich text, images, headings, separators, descriptions, arbitrary custom rendered content | Safe description nodes plus game-owned custom render slot | `custom-tab-layouts.md` |
| T24 | Text input, slider, dropdown, toggles connected to saved game settings/actions | Validated input bindings | `custom-tab-layouts.md` |
| T25 | Horizontal/vertical bars, all fill directions, progress text, instant/animated update and custom styles | Optional progress control | `bars.md` |
| T26 | Collapsible infoboxes, dynamic titles/bodies, visibility and styling | Optional disclosure control | `infoboxes.md` |
| T27 | Layer/component styles, images, backgrounds, marks, notification/prestige highlights, tooltips and custom colors | Game-owned styling/metadata; supplied state projections | Component pages, `layer-features.md`, `other.md` |
| T28 | Achievement/milestone popups and suppression controls | Optional notification/event presenter | `layer-features.md` |
| T29 | Scoped hotkeys, modifiers, unlock conditions, descriptions | Keyboard binding and command registry | `layer-features.md` |
| T30 | Particle emission, lifetime/fades, position/size, velocity/gravity/rotation, images/text and clearing | Optional UX effects recipe with no simulation ownership | `particles.md` |
| T31 | Interactive particles, click/hover/leave callbacks and layer-exit removal | Input bindings dispatching validated game commands; ephemeral view lifecycle | `particles.md` |
| T32 | Game loop/custom update, conditional base production and extensible game state | Headless simulation and registered custom mechanics | `main-mod-info.md`, `layer-features.md` |
| T33 | Offline enablement, cap, elapsed-time processing, and configurable step policy | Offline entitlement/work policy with explicit semantic differences | `main-mod-info.md`, `js/mod.js`, `js/game.js`, `js/utils/save.js` |
| T34 | Save/load, autosave, import/export, reset/wipe, old-save fixes and options | Host persistence, recovery, migration and save controls | `main-mod-info.md`, `js/utils/save.js`, `js/utils/options.js` |
| T35 | Endgame detection, win screen and continued play | Ending state/event and game-owned presentation | `main-mod-info.md`, `js/game.js` |
| T36 | Cached derived effects, helper queries and custom feature extension without unwanted effect execution | Read-only selectors/derived values, actions separate from evaluation | `other.md`, `main-mod-info.md`, component helper lists |
| T37 | Clear project setup, runnable example and framework/library upgrade workflow | Clean consumer recipe, package upgrades and migration guide | All three `tutorials/*.md` pages |

Paths beginning `js/` refer to the repository root, not the docs directory. Source code wins when documentation conflicts with behavior; retain both citations and name the discrepancy. For example, the documentation's `maxTickLength` units must be reconciled with the actual loop before creating an expected-value fixture.

## Leaf inventory and coverage closure

The release audit must enumerate every documented property, helper, component variant, and behavior in these files, including nested lists and descriptive prose:

`!general-info.md`, `achievements.md`, `bars.md`, `basic-layer-breakdown.md`, `buyables.md`, `challenges.md`, `clickables.md`, `custom-tab-layouts.md`, `grids.md`, `infoboxes.md`, `layer-features.md`, `main-mod-info.md`, `milestones.md`, `other.md`, `particles.md`, `subtabs-and-microtabs.md`, `trees-and-tree-customization.md`, `upgrades.md`, `tutorials/getting-started.md`, `tutorials/making-a-mod.md`, `tutorials/updating-tmt.md`.

Runtime pass: reconcile save/options/loop behavior and default values against the pinned source. A regex extraction is a draft inventory only; nested options and behavioral prose require review. Every source entry receives a group ID and one of: required capability, duplicate/alias of another entry, documented implementation mechanism, or source discrepancy requiring investigation. The last disposition must be resolved before D1 passes.

Each required leaf record contains:

- Stable ID such as `T15.bulk-completion` and exact source file/line/commit.
- Observable requirement and variants, including defaults and below/at/above-threshold conditions.
- Public e308 API/recipe/component implementing it.
- Unit/reference fixture and cross-feature interaction fixture IDs.
- Interactive demonstration ID when player-facing.
- Expected and actual result, runtime/backend, numerical comparison policy, artifact hashes.
- Status `NOT RUN`, `FAIL`, or `PASS`, and reviewer/date.

The coverage denominator is required **leaves**, never the 37 group headings. Report required/passed/failed/not-run counts and separately report aliases and implementation mechanisms. No required leaf gets an “N/A” merely because e308 has not built it. The inventory audit itself is a tracked D1 requirement and remains unfinished until reviewed; this documentation pass establishes the rules and group mapping, not an executed compatibility suite.

## How to establish parity

Construct a dedicated original feature-gallery fixture covering features that do not naturally fit the three games. It is an acceptance artifact, not a fourth showcase game. Each feature must be usable through public packages or a shipped, documented recipe. “Write arbitrary JavaScript” is not enough unless the actual extension example, tests, and interaction behavior exist.

For matching mathematical rules, run small equivalent definitions through the pinned TMT reference and e308 using controlled starting state, supplied deltas, and action order. Compare normalized currencies, counts, unlocks, challenge membership, reward events, and reset retention. The TMT runner stays in the test/reference boundary; none of the three games or distributed engine packages may import it.

Reference fixtures may isolate TMT pure routines or control a browser fixture as needed, documenting any stubs. Stubs must not implement the behavior being verified. Record formulas/expected values independently as well: blindly reproducing an upstream bug is not correctness evidence.

Use at least one below/at/above-boundary case for every thresholded feature, plus relevant multi-currency/custom-callback variants. For numerical comparisons, use the same backend/version where feasible and freeze tolerance policy before runs. Exact discrete outcomes are required. TMT's large offline deltas are not the canonical e308 model: compare matched-time fixtures where equivalent and use independent policy-accounting tests where intentionally different.

Required cross-feature scenarios include prestige retaining an upgrade and respec refund ledger; static prestige plus buy-max; a challenge that counts as two others and completes multiple tiers; a milestone enabling auto-upgrades during offline progress; a deactivated scope blocking effects/actions; a resizable grid across save migration; and an interactive collectible dispatching a once-only reward while changing tabs. Isolated component tests do not substitute for these interactions.

## Explicitly different implementation choices

| TMT detail | e308 obligation |
| --- | --- |
| Vue globals/reactivity and temp exclusions | Equivalent state/query/action behavior through safe APIs; no Vue compatibility requirement |
| Row-implied resets | Demonstrate equivalent behavior with explicit scope manifests; UI placement stays independent |
| Inline HTML/string layouts | Reproduce intended presentation and custom-content capability through description nodes/custom render slots; no requirement to accept untrusted HTML in core |
| Large tick catch-up and time clamping | Preserve explicit entitlement and pending-time accounting; document timing differences instead of copying lost-time behavior |
| Browser-only particles | Supply optional visual effects plus validated command handling; core must not depend on animation frames |
| Default tree appearance/theme | Supply optional tree/node/branch capability and style overrides, with no mandatory shell or pixel matching |
| Legacy/deprecated spelling | Map to the modern observable capability; automatic source/save conversion is outside v1 parity |

These are implementation differences, not waivers of capabilities. Selling/respec, tree views, grids, particles, and bulk challenges remain required.

## Newly exposed release requirements

The earlier plan intentionally deferred graph layout and enormous purchase-count support. This parity target refines that scope: an explicitly positioned optional tree view is required (automatic graph layout remains deferred), and a numeric-backed buyable amount/count domain is required for TMT-scale cases. Native bounded integers remain appropriate for executable batch iteration and queue indices, but cannot be the only representation for prestige/buyable totals. Large-count cumulative pricing, max-buy, serialization and precision boundaries need dedicated adapter-backed fixtures. No coercion to a safe integer merely to fit the current sketch API.

Interactive particles also require a declared policy separating ephemeral visuals from durable collectible state. Tab changes and rerenders cannot duplicate claims. Completing this feature may use a shipped UX recipe instead of expanding the simulation's built-in vocabulary.

These requirements are part of v1's gate even if the initial implementation slice omits them. Update public interface sketches before implementing the affected feature, and preserve the small-core architecture by making visual capabilities optional imports.
