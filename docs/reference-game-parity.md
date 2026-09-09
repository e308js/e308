# Reference-game parity gates

Status: automated bounded-parity suite **PASS**; independent source-review sign-off pending. The
[reference evidence manifest](evidence/reference-games.json) maps all 15 required cases—AD01–AD06,
KG01–KG06, and PC01–PC03—to pinned source manifests, executable comparisons, declared numerical
policies, and interactive evidence. All 15 cases pass with zero failed or not-run cases.

The reference games are the user's original research subjects: Universal Paperclips, Antimatter Dimensions, and Kittens Game. Antimatter Dimensions and Kittens Game have mandatory bounded mechanics-parity suites. Paperclips has a mandatory source-to-showcase mapping and independent correctness scenarios. This is not a claim that e308 must clone their entire campaigns, content, branding, or pixels.

Test-only clones or ports are permitted for these laboratories. They may reproduce the pinned mechanics directly; preserve source attribution and keep the oracle independent of the e308 implementation. Cloning for a test does not expand a bounded parity claim into full-game equivalence.

## Pinned sources

| Reference | Frozen baseline | Role |
| --- | --- | --- |
| Antimatter Dimensions | `IvarK/AntimatterDimensionsSourceCode` at `5409e320cecef96a917cca1dfb68f1f183e499ca` | Required producer/purchase/reset/challenge/automation parity |
| Kittens Game | `nuclear-unicorn/kittensgame` at `781e379f79f1e7512d168849cba21ed111502644` | Required resources/allocation/calendar/crafting/redshift parity |
| Universal Paperclips | Exact `main.js?v3`, `projects.js?v3`, `globals.js?v3`, `combat.js?v3` source hashes in the manifest | Required business/industry/phase mapping into Wireworks |

Use [source-manifest.json](source-manifest.json) to identify inspected files. The reference fixture bundle must additionally pin all transitive source dependencies it needs. Live websites can change and are not the acceptance oracle. Paperclips has no repository commit in this baseline; source content hashes, capture date, and archived fixture input identify it. Preserve source/license attribution for any reference harness material used.

## AD: Antimatter Dimensions mandatory slices

The public e308 packages must express these slices through ordinary game definitions or documented custom extensions. The acceptance laboratory uses the pinned game's formulas and rules, not Cascade's different balance parameters.

| ID | Slice | Required comparisons |
| --- | --- | --- |
| AD01 | Eight Antimatter Dimension tiers | Purchased versus generated quantity, tier-to-tier production, first-tier antimatter gain, update ordering, tickspeed effect; no-purchase traces and a purchase midway through a trace |
| AD02 | Dimension purchasing | Single purchase, until-ten, buy-ten multiplier, bulk/max behavior, changing prices and unlock requirements; below/at/above cost boundaries |
| AD03 | Dimension Boost and Galaxy resets | Eligibility, resulting dimensions and multipliers, exact cleared/retained fields, and repeated reset behavior |
| AD04 | First Infinity progression | Infinity eligibility/reward and the selected initial Infinity upgrades, persistence of their effects through lower resets, and normal/reset runs |
| AD05 | Challenges and automation | At least two source-defined Normal Challenges with materially different rule changes; one dimension autobuyer and one reset autobuyer with their actual eligibility, cadence and priority |
| AD06 | Large-number and return-time behavior | Quantities above native finite range in source-valid states; numeric save round-trip; controlled offline tick traces with automation enabled and disabled |

Before implementing a slice, freeze its exact selected upgrade/challenge IDs, starting save projection, prerequisite state, allowed actions, source formulas, and stop horizon. Choices must cover the behaviors in the table and may not be swapped for easier cases after a failure. A source-driven completed state may seed a later slice, but it must be reachable under the reference rules or have an explicitly verified valid-state construction. This permission applies to reference laboratories; full showcase completion still starts from a new save.

The source timing model is part of the comparison. Supply identical explicit deltas and action schedules to both runners. If AD's update ordering differs from the default e308 flow order, the laboratory must express that through a public extension with declared semantics. It may not alter core for an AD-specific ID, silently adjust expected values, or replace source formulas with a convenient approximation.

For AD06, separate reproducing a selected source offline tick schedule from validating e308's canonical offline policy. The former is the parity test; the latter belongs to D4. Choosing a smaller AD tick count can change outcomes and must be matched as an explicit reference parameter. The suite does not claim identical results between AD's coarse catch-up and e308's different canonical schedule.

Primary references: [dimension mechanics](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/dimensions/antimatter-dimension.js), [game loop/offline processing](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/game.js), [autobuyers](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/autobuyers/autobuyers.js), [in-game help](https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/5409e320cecef96a917cca1dfb68f1f183e499ca/src/core/secret-formula/h2p.js). Additional reset/challenge definitions must be pinned when the fixtures are frozen.

## KG: Kittens Game mandatory slices

The laboratory must reproduce the selected source coefficients, allocation effects, capacity and update policies. Hearth's original recipes and survival balance are separate fixtures.

| ID | Slice | Required comparisons |
| --- | --- | --- |
| KG01 | Early settlement resource ledger | Catnip, wood, minerals, science; gross production, consumption, net changes and capacity; source-valid buildings and assigned jobs |
| KG02 | Worker allocation and upkeep | Farmer/woodcutter/miner/scholar assignments, valid total workers, reassignment, food consumption and a shortage boundary; compare source consequences |
| KG03 | Calendar and seasons | One complete source calendar year, each seasonal boundary, and selected rate modifiers; deterministic handling or controlled source RNG for weather/events |
| KG04 | Storage, construction and crafting | A barn capacity increase, hut construction, catnip refinement, and one researched workshop recipe; payment, rounding, prerequisites, caps, and multi-resource constraints |
| KG05 | Redshift policy | The initial and progressed time caps; exact threshold/rounding behavior from source; subsystem fast-forward ordering and capacity enforcement; negative-catnip special treatment |
| KG06 | Progression/save continuity | Selected research unlocks and effects survive save/load; a source-defined reset retaining a selected progression reward while clearing settlement state |

Freeze selected building levels, workshop recipe/research IDs, reset reward, active modifiers, RNG inputs, and starting state projections before implementation. Include no-income, input-starved, capacity-full, and season-crossing cases. A population/production rule omitted from the fixture must be disabled identically in both runners or accounted for in the expected state; it cannot be stubbed out on only one side.

KG05 deliberately exercises an alternate game-authored offline policy. Reproducing it proves that e308 can express a reference game's chosen rules even when those differ from foreground stepping. e308's own cap accounting and crash safety still apply around that policy. Passing KG05 does not establish exact foreground equivalence for redshift, and the report must not say that it does.

Primary references: [resources and fast-forward](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/resources.js), [time/redshift](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/time.js), [calendar](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/calendar.js), [buildings](https://github.com/nuclear-unicorn/kittensgame/blob/781e379f79f1e7512d168849cba21ed111502644/js/buildings.js). Village/workshop/reset dependency files must be pinned before their fixtures are frozen.

## PC: Paperclips coverage retained

| ID | Mandatory Wireworks scenario | Evidence |
| --- | --- | --- |
| PC01 | Manufacturing adds inventory, not immediate money; demand/price affects sales | Map the relevant source mechanics to distinct production and market actions; independent stock/payment ledger checks |
| PC02 | Industrial production is constrained by matter/wire and power allocations | Map the reference inputs/outputs and constraint roles; demonstrate shortages and output conservation |
| PC03 | A project changes the available economy and interface | Map a source phase transition to Wireworks' original transition; verify prerequisites, once-only effects, new/retired controls, and offline event readability |

These are structural/mechanical coverage requirements, not exact Paperclips formula parity. Wireworks can use its own names, coefficients and story. Label the evidence accordingly. The inspected browser version did not establish a general closed-game catch-up mechanism; Wireworks' offline behavior is an e308 correctness requirement, not an asserted Paperclips match. [Reference entry point](https://www.decisionproblem.com/paperclips/index2.html), [main script](https://www.decisionproblem.com/paperclips/main.js?v3), [projects](https://www.decisionproblem.com/paperclips/projects.js?v3).

## Shared acceptance protocol

1. Freeze a scenario manifest with source commit/hash, exact definitions used, initial state, deltas, action sequence, seed/draw inputs, prerequisites, assertions and comparison policy.
2. Produce a normalized reference trace from the original implementation. Normalize representation and IDs only; do not normalize away meaningful state differences or missing events.
3. Run an independently authored e308 definition through installed package archives. It may not call the reference implementation for its results.
4. Compare after each significant boundary/action, not just the final balance. Numeric tolerances are predeclared for that backend/runtime; purchases, unlocks, reset retention and completion counts must agree exactly.
5. Cross-check selected reference outputs using independently derived small arithmetic cases. A mismatch can identify an upstream bug; investigate and document it rather than copying or silently correcting it. Any required observable divergence remains an explicit failed parity case unless the scope/claim is formally revised.
6. Demonstrate each slice interactively using a public renderer or a supplied custom view, including save/load and blockers. No requirement to reproduce the original appearance.
7. Preserve fixtures, traces, versions, failures and results in the same evidence bundle as TMT and the showcase games.

All six AD slices, six KG slices and three PC mappings are required. Their source fixtures are frozen
in `reference/*/manifest.json`; source integrity and the 15-case evidence mapping are executable
tests. The automated comparisons pass. Independent review must still verify that the pinned
selections faithfully cover the stated source behavior before D1R is accepted.

The release claim must name the scope: **TMT capability parity, Antimatter Dimensions/Kittens Game parity for the specified slices, and three complete original e308 games.** Full-game AD/Kittens parity is not implied by passing bounded slices.
