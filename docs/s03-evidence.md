# S03 progression and reference evidence

Status: local gates pass; exact-head CI acceptance is pending.

S03 adds normal, static, and custom prestige policies; scope resets with typed retention; upgrades,
milestones, achievements, win state, scope deactivation, challenges, and fixed-clock automation.
All state changes remain atomic commands over immutable published snapshots. Reset generations reject
queued commands authored against a cleared scope.

## Reference baselines

The Antimatter Dimensions laboratory is pinned to
`IvarK/AntimatterDimensionsSourceCode@5409e320cecef96a917cca1dfb68f1f183e499ca`.
The TMT prestige differential is pinned to
`Acamaeda/The-Modding-Tree@4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621`. Exact inspected-file SHA-256 values and MIT notices
are stored in `reference/ad` and `reference/tmt`. The e308 AD subject imports only public core APIs;
it does not import the bounded upstream runner.

| Case | Local result | Evidence |
| --- | --- | --- |
| AD01 | PASS | Eight tiers, descending 100 ms source updates, purchased/generated separation, tickspeed, and a mid-trace purchase |
| AD02 | PASS | Single, until-ten, full-group max, price boundaries, unlock rules, and buy-ten multiplier |
| AD03 | PASS | Early Dimension Boost/NC10/Galaxy requirements, eligibility failures, reset projections, and repeated failure boundary |
| AD04 | PASS | First Infinity, initial upgrade dependency, retained upgrades, time-played and Infinity-count multipliers |
| AD05 | PASS | NC2/NC3 power traces, NC10 restriction, completion ledger, 600 ms dimension and 4,000 ms reset autobuyers |
| AD06 controlled portion | PASS | Enabled/disabled explicit schedules and `break_eternity` quantities above `1e308`; save/offline integration remains S04 |
| T04 | PASS | Pinned TMT normal gain including gain exponent, direct multiplier, threshold, and softcap |
| T05 | PASS | Pinned TMT static one/max gain and next-cost eligibility |

The timing oracle deliberately sends the same sequence of 100 ms deltas to each AD runner. A single
300 ms AD update propagates the producer chain differently from three 100 ms updates, so those are
distinct source schedules and are not treated as interchangeable.

## Local verification

- `pnpm test:reference`: 11 reference tests pass.
- `pnpm test:coverage`: 128 tests pass; aggregate coverage is 96.85% statements, 90.18% branches,
  100% functions, and 97.97% lines. Every measured file clears
  the 80% per-file thresholds.
- `pnpm typecheck` and `pnpm check:structure` pass.

Browser, durable save, and offline-return evidence is assigned to later slices and is not claimed
here.
