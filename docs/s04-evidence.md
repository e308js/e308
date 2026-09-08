# S04 evidence: durable saves and recoverable offline progress

S04 adds a concrete, versioned save envelope and a recoverable catch-up protocol to the headless
core. Implementation commit `4c2a9e7b39660236fba1c5768b5151b73bec6434` passed
[GitHub Actions run 34291320021](https://github.com/e308js/e308/actions/runs/34291320021).

## Delivered contracts

- `@e308/core/persistence` encodes numeric values through the selected backend, validates exact
  definition inventories, and restores clocks, remainders, RNG streams, scope generations,
  purchases, allocations, production totals, progression, automation schedules, and pending work.
- The v1 envelope has a published JSON Schema and a committed non-null interrupted-session fixture.
  Runtime validation rejects corrupt checksums, excess size, future schemas, codec mismatches,
  unknown definitions, invalid clocks/accounting, and undeclared content changes.
- Schema migrations and pending-session simulation transitions are sequential and ledgered by stable
  IDs. A rules update after a partially committed chunk retains its frozen entitlement and records
  both simulation-version segments.
- Offline entitlement, work budget, fidelity, and resource capacity remain independent. Fixed,
  dynamic, disabled, and unlimited policies support explicit discard or bank handling. The absence
  cap is applied once before resumable bounded chunks.
- Canonical catch-up uses ordinary fixed steps and enabled automation. A game-authored
  `custom-reward` transaction supports deliberately different models such as Kittens Game redshift,
  and labels the report accordingly.
- Progression events use durable monotonic sequence numbers and their exact game-time boundary.
  Session-scoped event IDs and an explicit acknowledgement cursor define retry-safe delivery.
- `TransactionalSaveStore` uses compare-and-swap revisions. Its memory adapter injects failures
  before and after atomic commit and retains the preceding valid save as a backup.

## Local validation

The full local gate covers save round trips, malformed envelopes, migration failures, interrupted
updates, 30-hour/eight-hour accounting, cancellation and explicit discard, retry after every storage
commit boundary, deterministic RNG rollback, public subpath types, package archive consumption, and
AD06 save/offline schedules with automation enabled and disabled. Browser storage ownership, hidden
tabs, and worker cancellation remain assigned to S07.

The implementation-head suite passed 158 tests with 95.87% statements, 88.8% branches, 100%
functions, and 97.35% lines. Every production file passed the 80% thresholds for all four metrics.
