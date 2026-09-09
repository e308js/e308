# S05 timed-economy interface decisions

These types are frozen before S05 implementation. They extend the immutable snapshot and scoped
definition model established in S01–S04; they do not add game-specific branches to core.

## Timed tasks

A task definition owns fixed input and output resource entries and one work policy:

```ts
type TaskWork =
  | { kind: "fixed-duration"; durationMs: number }
  | { kind: "current-rate"; work: number; rate: (state: TaskContext<N>) => number };

interface TaskDefinition<N> {
  id: string;
  scope: Scope;
  inputs: readonly (readonly [Resource<N>, N])[];
  outputs: readonly (readonly [Resource<N>, N])[];
  work: TaskWork;
  delivery: "block" | "discard-overflow";
  cancellation: { refund: "full" } | { refund: "none" } | { refund: "fraction"; ratio: N };
  queueLimit: number;
}
```

Enqueueing atomically deducts the inputs and stores their exact escrow and output quantities on the
entry. Starting moves that already-paid entry into active state. Fixed-duration entries persist
remaining milliseconds. Current-rate entries persist remaining work and read their rate once at
each fixed-step boundary. A completion blocked by output capacity stays active at zero remaining
work; cancellation refunds remain explicit claim records until delivered. No retry rerolls or pays
twice. Queue, active, completed, and refund records use monotonic decimal sequence IDs in saves.

Reset manifests can retain named task definitions. Clearing a scope otherwise discards its queue,
active escrow, completed outputs, and refunds without applying ordinary cancellation refunds.

## Calendars

A calendar is a scoped ordered list of nonempty phases. Each phase has an ID and a positive duration
that is an exact multiple of the game's fixed step. Snapshot state stores phase index, elapsed time in
the phase, completed cycle count, and a monotonic boundary ledger. Production for a step reads the
phase at the start of that step; task completions and phase transitions occur at the endpoint.

The transaction exposes the current phase through a typed calendar handle. Effects remain ordinary
game-authored rates/modifiers, so the calendar does not own or hide resource math. Multiple boundary
crossings are ordered by definition ID. Random weather and events use named game RNG streams and are
separate rules; the Kittens parity year disables them identically in both runners.

## Markets

A market binds an inventory resource to a payment resource and declares fixed or marginal prices,
an optional fee, and a bounded maximum quote size. A quote contains market ID, side, quantity, gross,
fee, net payment/proceeds, resulting inventory, cumulative side volume, and source revision.

Marginal price callbacks receive the persistent side volume plus the unit offset. Batch totals sum
each marginal price in the selected numeric backend. Fee rounding is explicit (`none`, `floor`, or
`ceil`). Execution rejects stale quotes and rechecks stock and payment inside one transaction before
committing both resources and volume. Market production and sales remain separate operations.

## Persistence and extension boundary

Task state, calendar cursors/boundaries, and market volumes are grouped by owner scope in the save
envelope. Exact inventories and numeric codecs are validated on restore. Removing or renaming a
definition requires a migration. The S04 `custom-reward` catch-up callback is the Kittens redshift
extension point; it may update these primitives through transactions, but its report remains labeled
as custom reward rather than canonical replay.
