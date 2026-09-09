# S05 evidence: timed economies and Kittens mechanics

S05 adds deterministic paid tasks, calendars, and markets to the headless core. Implementation
commit `e1bf2d89353c46f4dd18834d5d931680a5378e3f` passed
[GitHub Actions run 34295772673](https://github.com/e308js/e308/actions/runs/34295772673).

## Delivered contracts

- `@e308/core/tasks` supports fixed-duration and current-rate work, enqueue-time payment, exact
  escrow and output snapshots, bounded queues, deterministic completion, blocked or explicitly
  discarded overflow, durable refunds, and reset retention.
- `@e308/core/calendar` advances aligned, authored phases and records exact boundary and cycle
  times in a deterministic ledger.
- `@e308/core/markets` provides revision-bound fixed and marginal quotes, explicit fee rounding,
  atomic stock/payment/volume updates, and structured failures for stale or invalid trades.
- Resource capacities may depend on state. Initial state, advancement, recipes, tasks, markets,
  restores, and resets all validate those dynamic limits.
- Save envelopes and their JSON Schema include exact task queues, claims, calendar ledgers, and
  market volumes, grouped under their reset scopes.
- Public ESM subpaths, emitted declarations, and packed-package consumers cover all three timed
  economy modules.

## Reference evidence

The independently authored Kittens subject and oracle pass bounded cases KG01–KG06 against source
commit `781e379f79f1e7512d168849cba21ed111502644`: early settlement ledgers and capacities, worker
allocation and shortages, a deterministic seasonal year, storage/crafting/research, redshift
rounding and caps, save/load research effects, and reset retention. The original WET PAWS license is
retained; no game implementation code is imported by the e308 subject.

Paperclips cases PC01–PC03 map manufacturing versus demand-limited sales, matter/wire/power
allocation and conservation, and a once-only project phase transition to the Wireworks kernel.
These suites establish the named arithmetic and state-transition cases, not complete-game or
interactive parity. Browser rendering and interactive reference laboratories remain assigned to
S06 and S10.

## Validation

The implementation-head suite passed 190 tests with 95.95% statements, 89.11% branches, 98.91%
functions, and 97.61% lines. Every production file passed the 80% thresholds for all four metrics.
Strict TypeScript, Biome with warnings rejected, structural limits, package builds, and archive
consumer checks passed locally and in the exact-head CI run.
