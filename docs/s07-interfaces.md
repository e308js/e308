# S07 browser and worker contracts

Status: frozen before runtime implementation.

## Browser lifecycle

`BrowserClock` exposes separate wall and monotonic clocks. The active loop advances only from
monotonic deltas. A persisted checkpoint records the current wall clock. After reload, visibility
recovery, or suspension, the host computes offline time only from that checkpoint wall anchor. It
never adds the monotonic and wall deltas for the same interval. A wall clock earlier than the saved
anchor produces a clock-anomaly event and zero elapsed time.

`BrowserHost` owns a game only while its ownership port reports `primary`. A `secondary` host may
load and observe snapshots, but cannot tick, dispatch, autosave, import, or wipe. It receives
revision announcements and reloads committed saves. `requestOwnership()` is the explicit handoff
operation. Web Locks provide exclusive ownership where available. Without Web Locks, tabs begin as
optimistic writers; revision broadcasts demote peers and compare-and-swap conflicts fence a race,
so a stale tab cannot overwrite a committed save.

Lifecycle transitions are explicit inputs (`visible`, `hidden`, `pagehide`, `pageshow`). Hiding or
pagehide first reconciles active monotonic time, then saves and stops the active timer. Showing or
pageshow reloads the durable checkpoint, applies offline catch-up in bounded chunks, resets the
monotonic anchor, and restarts the timer. Autosave is a scheduler concern and never supplies
simulation time.

The host publishes typed events for ownership, saves, conflicts, storage failures, clock anomalies,
imports, and catch-up completion. Import validates through the game save codec before replacing the
live game. Export returns the exact validated envelope JSON. Reset atomically replaces the slot with
the supplied initial checkpoint rather than leaving a missing-save window. All durable writes use the store's
compare-and-swap revision.

## IndexedDB

The adapter has one record per game slot: `{ slot, revision, value, backup }`. A read/write
transaction compares the expected revision, moves the prior value to `backup`, writes the next
revision and value, then commits atomically. Request, transaction, quota, and blocked-open failures
reject rather than being reported as successful writes. The adapter has no simulation or lifecycle
policy.

## Worker protocol

Every message has protocol version `1` and a caller-generated `requestId`. State-changing requests
also carry `sourceRevision`, encoded as a decimal string. The frozen request union is:

- `initialize`: serialized snapshot transfer;
- `advance`: elapsed milliseconds;
- `dispatch`: a game-defined, structured-clone-safe intent;
- `catchup`: total elapsed milliseconds and a positive per-chunk step budget;
- `cancel`: target request ID;
- `snapshot` and `dispose`.

Responses are `ready`, `result`, `cancelled`, or `error`. Successful and cancellation responses carry
the committed revision and serialized snapshot. Errors distinguish protocol, stale revision,
invalid intent, simulation failure, cancellation target, and disposed host.

`WorkerTransferCodec` is game-owned and converts snapshots to structured-clone-safe data and intents
to validated engine commands. Functions and live numeric objects never cross the boundary.
Transport ordering is not trusted: clients ignore results older than their accepted revision and
the worker rejects source revisions that do not match its current snapshot.

Catch-up commits one engine advancement chunk at a time. Cancellation is observed only between
chunks. A cancel received before a chunk begins preserves the preceding committed snapshot. A
cancel received after a chunk commits acknowledges that new revision. The acknowledgement is the
authority; a later result for the cancelled request is stale and ignored. Repeating a request ID
returns the cached terminal response, so transport retries are idempotent.

## Evidence boundary

CI covers injected clocks, hidden/show/reload behavior, IndexedDB faults, two-page ownership and
handoff, worker cancellation races, stale responses, and main-thread/worker equality. Real device
sleep is recorded separately because CI cannot cause or verify operating-system suspension. Until a
named device/browser run exists, the corresponding D4 release row remains open rather than being
inferred from synthetic clock tests.
