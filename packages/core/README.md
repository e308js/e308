# @e308/core

The framework-independent deterministic simulation package for e308. It provides native and
`break_eternity.js` quantities, scoped definitions, immutable transactional snapshots, fixed-step
time, module dependency ordering, named deterministic random streams, production flows, recipes,
allocations, buyables, scalable price curves, modifier breakdowns, prestige resets, upgrades,
milestones, achievements, challenges, scope activation, scheduled automation, paid task queues,
deterministic calendars, dynamic resource capacity, and atomic markets.

```ts
import { createGame, createGameKit, eternityNumbers } from "@e308/core";

const kit = createGameKit({ numbers: eternityNumbers });
const run = kit.scope("run");
const clips = kit.resource("factory/clips", { scope: run, initial: kit.q("0") });
const factory = kit.flow("factory", {
  scope: run,
  rate: kit.rates.constant(kit.q("2")),
  produces: [[clips, kit.q("1")]],
});
const definition = kit.defineGame({
  id: "paperclip-lab",
  simulationVersion: 1,
  stepMs: 50,
  resources: [clips],
  flows: [factory],
});
const game = createGame(definition);

game.advance(1_000);
```

Progression definitions use the same typed handles and transactions as the economy:

```ts
const account = kit.scope("account");
const reputation = kit.resource("reputation", { scope: account, initial: kit.q("0") });
const ascend = kit.prestige("ascend", {
  scope: run,
  reward: reputation,
  manifest: { clear: [run] },
  canReset: (state) => kit.numbers.cmp(state.get(clips), kit.q("1000")) >= 0,
  rewardFor: () => kit.q("1"),
});
```

Adapter-independent callbacks use `numbers.cmp` for comparisons. `normalPrestige` implements
threshold, gain multiplier/exponent, direct multiplier, and
softcap stages. `staticPrestige` implements TMT-compatible increasing requirements and one/max gain.
Custom prestige behavior uses ordinary `canReset` and `rewardFor` callbacks.

Imports have no timers, storage, DOM access, or simulation side effects. Numeric and state APIs reject
non-finite values and cross-definition handles before committing state. Flow rates read the state at
the start of each fixed step. Shared inputs are reserved by ascending priority and then ID; outputs
become available to other flows on the next step. `Snapshot.productionTotals` records gross output by
resource, including output later consumed or discarded by a capacity policy.

`scopeActivation` attaches a progression predicate to a scope. Inactive scopes pause flows, stepped
rules, and automation, and built-in scoped actions return a structured `scope-inactive`
failure. Automation runs at fixed game-time boundaries in priority/ID order and dispatches the same
validated commands used by a player. Reset manifests clear every definition owned by a named scope,
with explicit typed retention for resources, buyables, allocations, upgrades, triggers, challenges,
automation schedules, tasks, calendars, and market volume.

## Timed economies

Tasks reserve their inputs when queued and keep the exact escrow and output quantities in state.
Fixed-duration tasks consume game time; current-rate tasks read the current transaction at each
canonical step. Completion can wait for output capacity or discard overflow, while cancellation
creates an explicit refund claim which can be retried safely.

```ts
const shipment = kit.task("shipment", {
  scope: run,
  inputs: [[clips, kit.q("100")]],
  outputs: [[reputation, kit.q("1")]],
  work: { kind: "fixed-duration", durationMs: 5_000 },
  delivery: "block",
  cancellation: { refund: "full" },
  queueLimit: 3,
});
```

Calendars advance at fixed-step boundaries and persist an ordered boundary ledger. Markets return
revision-bound quotes and recheck their economics inside the transaction before changing stock or
payment. Resource `capacityFor` callbacks support storage derived from other resources. These APIs
are available from the root package and the `@e308/core/tasks`, `@e308/core/calendar`, and
`@e308/core/markets` subpaths.

`geometricCurve` performs cumulative pricing and max-buy arithmetic in the selected numeric backend.
`segmentedCurve` joins backend-compatible curves at explicit count milestones. Buyable counts remain
numeric-backed even when they exceed JavaScript's safe integer range. Instant recipe request counts
are bounded safe integers because they represent executable iterations.

## Saves and offline progress

Persistence is opt-in and headless. A save records the numeric codec, fixed-step schedule, RNG
streams, automation clocks, progression event ledger, resolved offline entitlement, and any pending
catch-up session. Decode rejects corrupt, future, mismatched, and structurally unknown state.

```ts
import { createSaveCodec } from "@e308/core/persistence";
import { beginCatchup, processCatchupChunk } from "@e308/core/offline";

const codec = createSaveCodec(definition, {
  stateSchemaVersion: 1,
  contentVersion: "1.0.0",
  contentDigest: "replace-with-your-build-digest",
});
const entitlement = {
  policyVersion: "1",
  enabled: true,
  capMs: 8 * 60 * 60 * 1_000,
  excess: "discard" as const,
};
const raw = codec.encode(game.getSnapshot(), {
  wallAnchorMs: Date.now(),
  entitlement,
  catchup: null,
});

const loaded = codec.decode(raw);
const returned = beginCatchup(definition, loaded, Date.now(), crypto.randomUUID());
if (returned.catchup) {
  const candidate = createGame(definition, { snapshot: returned.snapshot });
  const chunk = processCatchupChunk(definition, candidate, returned.catchup, 10_000);
  // Persist chunk.value or chunk.error state and session together before processing more.
}
```

The work budget above limits computation per checkpoint while preserving credited time. The cap is
resolved and saved before an absence. It is applied once even if catch-up needs many chunks or
restarts. `MemorySaveStore` and `commitCatchupChunk` in `@e308/core/storage` demonstrate atomic
compare-and-swap recovery.

Games with validated bulk capabilities can pass an optimized catch-up execution. Its callback
receives the pending duration and work budget, advances the supplied game, and returns its processed
duration and fidelity. Catch-up reports combine canonical, validated-bulk, and approximate segments
across interrupted sessions. `BrowserHostOptions.catchupExecution` applies the same execution path
during page restoration.

## Browser host and workers

`@e308/core/browser` connects a game to explicit lifecycle events, IndexedDB, autosave, and
single-writer ownership across tabs. It uses monotonic time while the page is active and the saved
wall-clock anchor after suspension or reload, so each interval is credited exactly once.

```ts
import {
  browserClock,
  browserScheduler,
  IndexedDbSaveStore,
  openBrowserHost,
  WebLockOwnership,
} from "@e308/core/browser";

const host = await openBrowserHost({
  definition,
  codec,
  store: new IndexedDbSaveStore({ databaseName: "my-game" }),
  slot: "main",
  initial: { snapshot: game.getSnapshot(), metadata: { wallAnchorMs: Date.now(), entitlement, catchup: null } },
  clock: browserClock,
  scheduler: browserScheduler,
  ownership: new WebLockOwnership({ lockName: "my-game-writer" }),
});
```

Secondary tabs remain readable and can request an explicit handoff. Every write is additionally
fenced by the storage revision. `@e308/core/worker` supplies a versioned request/response protocol,
structured-clone transfer codecs, stale-revision checks, idempotent request IDs, and chunk-boundary
catch-up cancellation. Game code defines the serializable intent codec, while commands still run
through the ordinary validated engine path.

Games with intentionally different away-time rules can pass `{ kind: "custom-reward", apply }` as
the final `processCatchupChunk` argument. The callback runs in one transaction and the report labels
the result `custom-reward`; cap and recovery accounting remain unchanged. Canonical mode always runs
the ordinary fixed-step rules and enabled automation.

Schema migrations and pending simulation-rule transitions are explicit and carry stable IDs in the
migration ledger. Crossing a simulation version requires the pending session's declared transition.
The published JSON Schema is `schema/save-v1.schema.json`; a complete interrupted save is
kept in the repository as a compatibility fixture.

## Bot runs and pacing reports

`@e308/core/testing` runs a game headlessly with scripted, ranked, or game-authored goal policies.
Policies receive only a serializable observation and revision-bound legal-action quotes. The harness
dispatches the quoted intent through the same command path as a player, stops player decisions during
idle and absent sessions, and records bounded traces, samples, constraints, milestones, offline
fidelity, and replay inputs. Complete-action-space sessions execute bounded bursts of immediately
available actions before game time advances. A scenario can expose `quoteAll` with its complete
action catalog; guided pacing uses `quote`. Quotes can tag progression-reset effects. The harness
verifies the corresponding scope reset and reports reset transitions at the same game time.
Reports measure challenge duration, successful actions within each challenge, and action intervals
tied to one simulation step. A scenario can provide `advanceTime` to use a validated exact
advancement capability during active and idle simulation. A scenario can also project goal-relevant
pressures with action, investment, and passive relief routes. `assessPlayability` evaluates these
challenge, cadence, pressure, and goal metrics against explicit thresholds.

```ts
import { orderedPolicy, randomLegalPolicy, runHarness } from "@e308/core/testing";

const report = runHarness({
  scenario,
  policy: orderedPolicy({
    id: "first-reset-route",
    version: "1",
    actions: ["buy-generator", "buy-upgrade", "prestige"],
  }),
  gameSeed: "00",
  botSeed: "01",
  goalId: "first-prestige",
  decisionCadenceMs: 1_000,
  schedule: [{ kind: "active", durationMs: 60_000 }],
  limits: {
    maximumDecisions: 100,
    maximumTraceEntries: 200,
    maximumSamples: 100,
    sampleCadenceMs: 1_000,
  },
  replayCommand: "pnpm pacing -- first-prestige 00 01",
});

const randomPolicy = randomLegalPolicy({ version: "1" });
```

`@e308/core/balance` aggregates reached and unreached populations, runs paired parameter sweeps,
and compares versioned baselines. A failed policy run remains distinct from an authored barrier
certificate. The workspace's `pnpm report:pacing` command exercises three distinct economy kernels
and emits machine-readable JSON plus readable Markdown.

## Checked bulk advancement

`@e308/core/optimize` can reduce long native-number recurrences while preserving their canonical
economic result. Exact mode recognizes safe-integer constant, allocated, proportional, and linear
product rates with input-free, capacity-free definitions. It exponentiates their affine recurrence and stops
before automation boundaries so the boundary command runs through an ordinary canonical step.

```ts
import { advanceOptimized } from "@e308/core/optimize";

const result = advanceOptimized(game, definition, 8 * 60 * 60 * 1_000, {
  mode: "exact",
  limits: { maximumWork: 50_000, maximumBulkBatches: 100 },
});

if (result.status === "pending") {
  // Persist result.snapshot and result.pendingRealMs, then resume in another work chunk.
}
```

When any precondition fails, the driver uses canonical fixed steps and records why. Its work budget
preserves unprocessed time; `AdvanceBacklog` owns that pending duration and
refuses additions beyond a declared bound. Registered build-time capabilities declare dependencies,
versions, and checked plans. Approximate capabilities also declare error bounds and run only when the
caller explicitly selects `mode: "approximate"`.

`producerChainBulkCapability` supplies the closed-form path for tiered generators. The game provides
the output resource, ordered tiers, and each tier's stable per-step coefficient. The capability keeps
the chain's one-step propagation delay, production totals, partial-tick remainder, and automation
clock. Enabled automation runs at its normal canonical boundary.

`profileAdvancement` accepts an injected monotonic clock. The workspace's
`pnpm report:performance` command records machine/runtime identity, cold and warm timing samples,
throughput, longest batches, canonical/bulk work, and pending duration for the three example kernels.
CI timings are diagnostics; release performance claims use the separately documented reference
machine procedure.
