# S09 evidence: validated advancement and bounded performance work

S09 adds an opt-in advancement driver that accelerates only recurrences it can prove safe for the
current definition and snapshot. Implementation head
`53aadbeafe7d2cdfee5181a0b8fe99f82dc9fe5b` passed
[GitHub Actions run 34308069739](https://github.com/e308js/e308/actions/runs/34308069739).

## Delivered contracts

- `@e308/core/optimize` exposes canonical, exact, and explicitly approximate modes. Exact is the
  default; approximate capabilities require a stable identity and declared error bounds.
- The built-in affine capability checks the numeric adapter, step size, rates, inputs, capacities,
  dynamic progression, event boundaries, and safe-integer intermediates before it performs matrix
  exponentiation. Any failed precondition returns to canonical fixed steps.
- Automation boundaries run canonically between bulk segments. Property and boundary tests compare
  resources, production totals, progression, time remainders, and random state with ordinary
  simulation.
- Games expose their immutable definition identity, and the optimizer rejects a mismatched game and
  definition before advancing either one.
- Custom capabilities declare dependencies and fidelity. Planner errors and rejected plans become
  diagnostics, while an event-bound wrapper lets game code reserve authored boundaries for canonical
  execution.
- Work and bulk-batch limits return exact pending duration. `AdvanceBacklog` retains that duration
  and rejects unsafe additions without losing queued time.
- The injected-clock profiler records cold/warm distributions, throughput, fidelity, step counts,
  longest game-time batch, and pending work. CI emits JSON and Markdown with runtime and commit
  metadata under `artifacts/performance/`.

## Correctness and workload evidence

Fast-check generates safe constant recurrences and compares optimized snapshots with independent
canonical runs. Additional tests cover delayed producer chains, proportional products, allocation,
remainders, automation mutations, event-bounded custom capabilities, RNG preservation, rejected and
throwing planners, declared approximation, overflow, backlog behavior, and every built-in fallback
condition.

The local Ryzen 9 8945HS diagnostic completed Cascade's 30-day affine workload in one validated bulk
batch. Wireworks and Hearth intentionally remained canonical because their constraints are outside
the proof set; their 30-day calls stopped at the 200,000-work bound and retained 2,392,000,000 ms as
pending. Their 8-hour warm p95 calls were 23.888 ms and 21.530 ms respectively. These measurements
demonstrate bounded, lossless fallback and identify work for release tuning; they are diagnostics,
not release performance claims. The D7 reference-machine procedure remains assigned to S11.

## Validation

The accepted local suite passed 281 Vitest tests and four Playwright tests. Aggregate coverage was
95.69% statements, 88.77% branches, 98.15% functions, and 97.46% lines; every executable production
file passed 80% for all four metrics. Strict TypeScript, Biome with warnings rejected, file/function/
duplication/import-boundary checks, builds, package consumers, pacing and performance report
generation, reference suites, and browser tests passed. The normal sandbox denied Playwright's
local loopback bind, so the same browser command was rerun unchanged with loopback permission and
passed; GitHub Actions then passed the complete quality command on the exact implementation head.
