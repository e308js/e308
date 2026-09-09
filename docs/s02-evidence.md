# S02 economic primitives evidence

Status: **ACCEPTED**. Implementation commit `17181ca6507c4374a805340d58775b8710c9ff2d`
passed [GitHub Actions run 34280350593](https://github.com/e308js/e308/actions/runs/34280350593).

S02 implements inspectable constant, proportional, allocation, and product rates plus a custom rate
escape hatch; fixed-step flows with deterministic reservation; instant recipes; capacities and three
overflow policies; allocation budgets; gross resource production counters; modifier stages and
breakdowns; numeric-backed buyables with sell/respec; geometric cumulative pricing; and segmented
milestone pricing.

The public API and packed-package example distinguish numeric-backed ownership counts from bounded
safe-integer recipe executions. All economic writes use the same transaction and structured failure
path as authored commands.

| Requirement | Evidence |
| --- | --- |
| Rational flow, shared inputs, priorities, delayed chains, capacity and custom rates | `tests/core/flows.test.ts` |
| Atomic bounded recipes and capacity/input failures | `tests/core/recipes.test.ts` |
| Buy/max/sell/respec and huge numeric-backed counts | `tests/core/buyables.test.ts` |
| Geometric and segmented threshold arithmetic | `tests/core/curves.test.ts` |
| Allocation budgets and allocation-backed production | `tests/core/allocations.test.ts` |
| Stable modifier stages and contribution breakdown | `tests/core/modifiers.test.ts` |
| Runtime ownership, rollback and immutable counter state | `tests/core/definition.test.ts`, `tests/core/state.test.ts` |
| Wireworks, Cascade and Hearth headless traces | `tests/scenarios/kernels.test.ts` |

At S02 acceptance, applicable TMT groups had partial executable coverage: T02 large quantities and counters; T03
dynamic costs/effects through typed rates and modifiers; T10 atomic custom-currency transactions;
T11 rebuyables and buy-max; T12 sell-all/respec; and T32 fixed-step custom production. These group
results were deliberately left **NOT RUN** until the pinned TMT differential fixtures were introduced
in their assigned later slices. The completed automated leaf register is recorded in
[s11-evidence.md](s11-evidence.md). S02 itself proves the engine surface and independent economic
oracles; it does not independently claim complete TMT parity.

Local acceptance on September 8, 2026: 100 tests across 15 files; aggregate statements 97.09%,
branches 92.60%, functions 100%, lines 97.54%; zero per-file threshold, size, function-size,
duplication, or core dependency violations. The accepted CI job also built both ESM packages,
installed their archives into clean JavaScript and
strict TypeScript consumers, and uploaded the package and coverage artifacts. No coverage, structure,
or dependency exceptions were used.
