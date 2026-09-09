# Interface design record

Status: historical preimplementation design record. The declarations below explain the decisions
that shaped the compiled APIs; they are illustrative and may omit later additions. Use
[api-reference.md](api-reference.md) and the emitted package declarations for the current public
surface. [contracts.md](contracts.md) defines the behavioral requirements.

The subsequent [TMT parity gate](tmt-parity.md) requires numeric-backed huge buyable totals and optional tree/grid/effect capabilities for v1. The bounded-count helper sketched below remains an initial simple capability; it is not sufficient for release parity. Its large-count companion must be specified before implementing that feature, with economic counts in the numeric backend and bounded native counts only for actual iteration/queue control. Full release evidence is defined in [definition-of-done.md](definition-of-done.md).

## Review disposition

| Review point | Decision |
| --- | --- |
| Numeric generics | Accept: explicit `N` internally and in public contracts; capture it once in an authoring factory |
| Inspectable rates | Accept: typed rate data plus a custom callback escape hatch |
| Priority/output timing | Already specified; make field, default, tie-break, and units explicit |
| Throttling formula | Accept with correction: fractional work persists where earned; unmet input-limited demand does not |
| Snapshot ownership | Accept the gap; choose copy-on-write publication, not merely shallow freezing live nested objects |
| Reset scope direction | Already chosen: stateful primitives own scopes; resets name cleared scopes |
| Failure taxonomy | Accept; distinguish action blockers, forecast conclusions, and operational failures |
| RNG/save shape | Accept; choose a versioned algorithm, stream derivation, and concrete envelope |
| `process` builder name | Rename to `flow`; it describes the primitive and avoids shadowing Node's global |
| Cross-engine floats | Already qualified; explicitly exclude cross-engine bit identity and specify comparison treatment |
| Infrastructure | Record as future work, with no workspace/package/tooling creation now |

Duplicate review bullets are addressed once. Detailed task, calendar, automation, worker, bot, extension, and localization wire types have slice gates below; they are not claimed as finished APIs.

## Quantity representation and authoring

Choose `Game<N>`, `Resource<N>`, `Rate<N>`, and `ResourceView<N>`. Each game has exactly one numeric adapter for economic quantities. Time, array indices, command sequence numbers, and bounded integer counts are separate types. A factory captures `N` from the adapter so a game author normally writes no explicit generic parameters:

```ts
const kit = createGameKit({ numbers: chosenAdapter });
const run = kit.scope('run');
const machines = kit.resource('machines', { scope: run, initial: kit.q('1') });
const clips = kit.resource('clips', { scope: run, initial: kit.q('0') });
const output = kit.flow('output', {
  scope: run,
  priority: 0,
  rate: kit.rates.proportional(machines, kit.q('1')),
  produces: [[clips, kit.q('1')]],
});
const definition = kit.defineGame({ resources: [machines, clips], flows: [output] });
```

Generic module factories accept a `GameKit<N>` instead of installing their own adapter. Handles carry a runtime definition-owner token: matching TypeScript representations do not permit mixing resources from unrelated definitions. Definitions can still instantiate multiple independent games. Economic operations never mix adapters inside one game, even if two adapters happen to use the same underlying TypeScript class.

Quantities exposed through snapshots must be immutable values. A wrapper adapter for a mutable numeric class must isolate that representation and expose a safe immutable facade. TypeScript `Readonly<N>` alone does not disable mutating methods or protect hidden state.

```ts
interface NumericAdapter<N> {
  readonly id: string;
  readonly implementationVersion: string;
  readonly codec: {
    readonly id: string;
    readonly version: number;
    serialize(value: N): string;
    parse(encoded: string): N;
  };
  fromNumber(value: number): N;
  fromString(value: string): N;
  add(a: N, b: N): N;
  sub(a: N, b: N): N;
  mul(a: N, b: N): N;
  div(a: N, b: N): N;
  cmp(a: N, b: N): -1 | 0 | 1;
  floor(value: N): N;
  isFinite(value: N): boolean;
  readonly transcendental?: {
    pow(base: N, exponent: N): N;
    log(value: N, base: N): N;
  };
}
```

`fromNumber` accepts finite input and cannot recover precision already lost in a JavaScript literal. Large literals use `fromString`. Parsing and arithmetic domain failures throw an internal numeric fault caught at the transaction boundary; they never commit NaN/Infinity. `isFinite` also returns false for invalid numeric values. Codecs are canonical and round-trip supported values; parse validates its entire input. Optional capabilities are absent rather than present as `undefined`, matching the future exact-optional-property TypeScript policy.

Geometric cumulative costs and max-buy belong to an adapter-backed economy helper, not to every numeric adapter's required arithmetic interface. Its contract includes `totalCost(startCount, quantity)` and `maxAffordable(balance, startCount, maxCount)`. All price arithmetic and inversion stay in `N`; returned counts are validated bounded safe integers. Require an explicit count ceiling. A separate future capability is needed for enormous purchase counts beyond that range.

Closed-form totals are not automatically equivalent to repeated floating-point summation. A curve definition chooses its canonical cumulative-cost/rounding policy, and individual-versus-bulk parity is an acceptance requirement for curves advertising that capability. Unsupported transcendental operations or incompatible rounding disable the shortcut; they do not trigger a conversion to native numbers. Games with custom state-dependent purchases can use repeated atomic actions with explicit work bounds.

## Rate data and allocation

```ts
type Rate<N> =
  | { readonly kind: 'constant'; readonly value: N }
  | { readonly kind: 'proportional'; readonly resource: Resource<N>; readonly factor: N }
  | { readonly kind: 'product'; readonly factors: readonly Rate<N>[] }
  | { readonly kind: 'custom'; readonly evaluate: (state: ReadContext<N>) => N };

interface FlowDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly priority?: number;
  readonly rate: Rate<N>;
  readonly consumes?: readonly (readonly [Resource<N>, N])[];
  readonly produces: readonly (readonly [Resource<N>, N])[];
  readonly onInputShortage?: 'throttle' | 'block';
}
```

`Scope`, `Resource<N>`, and `ReadContext<N>` denote the typed handles/read interface described in the architecture; their full declaration files remain future work. Rate constructors produce data, not parsed strings or executable text. The final rate has units of executions per game second. This first contract does not claim compile-time dimensional analysis: authors must supply compatible factors. Negative/nonfinite rates and coefficients are rejected.

Ordered product factors preserve arithmetic evaluation order. Product nodes are inspectable but are not necessarily linear or eligible for bulk integration. A custom callback defaults to stepped-only. A separately registered custom bulk implementation can declare dependencies and checked preconditions; the scheduler never assumes those from closure inspection. Rate data is only one condition for optimization: caps, input contention, events, numeric parity, and other readers/writers must also permit it.

Priority is an explicit finite safe integer, default 0; lower numbers reserve first. Ties use case-sensitive stable IDs ordered by UTF-16 code units, not locale-sensitive sorting. Definition/import order has no effect. Outputs become inputs only in the next canonical step. Quantum and schedule version are recorded in the simulation identity.

For a flow with desired execution count `d = rate × gameSeconds`, input quantities `a_i` remaining in the input ledger, and required coefficients `c_i > 0`, the input-constrained amount is:

`e_input = max(0, min(d, min_i(a_i / c_i)))`.

The empty-input minimum imposes no bound. Repeated entries for the same resource are summed before evaluation. Under `block`, insufficient inputs for `d` yield zero instead of partial execution. Blocking outputs impose additional bounds on the whole process using projected final balances, as described in the production contract. In particular, when the same resource is both consumed and produced, capacity constrains its net increase, while input availability still constrains its full consumption. All reservations and outputs commit atomically.

For an instant recipe, requested execution count is a nonnegative bounded integer; floor the feasible amount when the caller explicitly requests “up to” or max. An exact-count recipe fails if it cannot execute that count. Zero requested count is rejected as `invalid-count` rather than generating a successful no-op purchase. There is no saved fractional debt for an instant recipe. Unexecuted flow demand caused by missing inputs is lost, not banked. Persisted fractional work belongs to passive discrete production or paid timed tasks and cannot create output whose inputs were never paid.

## Snapshots and selectors

Choose transaction-owned mutable working state with copy-on-write committed records. A new snapshot root is published per committed revision; changed records are copied, unchanged immutable records are shared. No object reachable from a published snapshot may later be mutated. Snapshot records/arrays are frozen, and numeric adapters must satisfy the immutable-value contract. A shallow root copy alone is insufficient.

`getSnapshot()` returns the identical root reference until the next publication. Selectors are pure and receive that snapshot. Subscriptions accept a selector and an equality function, defaulting to `Object.is`; a selector that creates a new object on every call should supply equality or memoize. Subscribers see committed state only. Observer exceptions do not roll back or interrupt economic simulation; the host reports them separately.

The core publishes at transaction boundaries. A browser adapter may coalesce view notifications, but it must not change simulation commits or silently lose command results. Bot observations and reset previews retain their source revision. A saved envelope serializes committed data, never a working transaction.

Every stateful primitive requires a scope. Resets name scopes to clear and optional field retentions; the layer never maintains a parallel manual inventory of every resource. Stateless formulas and view definitions need no saved scope. Readonly declarations describe consumer access, not the internal transaction implementation.

## Outcomes and failures

Use a discriminated `Result<T, E>`: `{ ok: true, value: T }` or `{ ok: false, error: E }`. A dispatch result contains its command ID and committed revision; quotes contain the observed revision. Quantities in reasons remain `N` until formatting.

| Code | Required details and interpretation |
| --- | --- |
| `insufficient` | Resource ID, required quantity, available quantity |
| `capacity-blocked` | Resource ID, addition, available room; current execution blocker |
| `locked` | Revealed prerequisite IDs; no undiscovered details |
| `cooldown` | Action ID, remaining time, clock domain |
| `invalid-count` | Allowed minimum/maximum and requested count |
| `allocation-exceeded` | Allocation ID, assigned quantity, budget |
| `stale-revision` | Expected/current revision; new preview can be requested |
| `invalid-target` | Unknown or reset-invalidated handle/generation |
| `disabled` | Action/rule ID and public reason key |

`capacity-unreachable` is a forecast diagnosis, with assumptions and proof scope, not automatically a command error: future upgrades might increase storage. `budget-exceeded` is an operational catch-up/harness limit carrying processed/pending work, not insufficient player currency. Other operational failures include numeric fault, invalid definition, migration incompatibility, save failure, and lost writer ownership. Such faults pause or abort safely and expose a diagnostic; they do not appear as ordinary purchasable-item blockers.

This taxonomy is shared by core adapters, UX, and bots. Extension-specific reasons use a namespaced code and a fallback localization key; adding an extension cannot break exhaustive handling of built-in categories. Display strings are produced outside the simulation.

## RNG and save representation

Choose `xoshiro128**` for the initial simulation PRNG: four unsigned 32-bit state words with versioned transition/output functions. It is a noncryptographic simulation generator, not a source of security tokens. The authors publish the 32-bit algorithm family and reference implementations. [Author reference](https://prng.di.unimi.it/).

Streams are named by stable namespaced paths. Derive initial stream state by SHA-256 over UTF-8 JSON encoding of `["e308-rng-v1", rootSeed, streamPath]`, with `rootSeed` a stored canonical lowercase hex string and `streamPath` an array of exact case-sensitive IDs. No Unicode normalization is applied. Read the first sixteen digest bytes as four little-endian uint32 words; map an all-zero result to `[1,0,0,0]`. Derivation occurs only at stream creation, never per draw. This is a proposed versioned seed mapping, not a claim from the PRNG authors or proof of nonoverlapping streams.

Forking opens a named child path without consuming the parent. Reopening a path resumes the same registered stream; it never restarts it. Persist root seed, created stream states, and draw counts. Restore these directly on load. New streams can be derived later without changing existing ones. A uniform `[0,1)` sample is one uint32 draw divided by `2^32`; bounded integer sampling uses rejection sampling with a specified bound and persistent draw progression. Bots use a separate root/namespace so their decisions never consume game RNG.

The format below is a concrete illustrative save shape for a native-number game. The content digest string stands for the actual build digest; all economic strings use the selected codec. Timers use validated finite durations; sequence counters use decimal integer strings to avoid JSON integer-range loss. Exact field validation and schema declarations are an S04 deliverable.

```json
{
  "format": "e308-save",
  "formatVersion": 1,
  "gameId": "wireworks",
  "stateSchemaVersion": 1,
  "content": {
    "version": "1.0.0",
    "digest": "actual-build-digest",
    "modules": [{ "id": "factory", "version": "1.0.0" }]
  },
  "simulation": {
    "version": "fixed-step-v1",
    "stepMs": 50,
    "scheduleVersion": 1,
    "numericAdapter": "native",
    "numericImplementationVersion": "1",
    "numericCodec": { "id": "native-decimal", "version": 1 }
  },
  "revision": "42",
  "state": {
    "scopes": {
      "run": {
        "generation": "0",
        "resources": { "factory/clips": "12.5" },
        "purchaseCounts": {},
        "tasks": {},
        "automation": {},
        "allocations": {},
        "custom": {}
      }
    },
    "rewardLedger": []
  },
  "clock": {
    "wallAnchorMs": 1788883200000,
    "gameTimeMs": 1000,
    "remainderMs": 0,
    "entitlement": {
      "policyVersion": "1",
      "enabled": true,
      "capMs": 28800000,
      "excess": "discard"
    }
  },
  "rng": {
    "algorithm": "xoshiro128ss-v1",
    "derivation": "sha256-path-v1",
    "rootSeed": "0123456789abcdef",
    "streams": [{ "path": ["factory", "market"], "words": [1, 2, 3, 4], "draws": "0" }]
  },
  "catchup": null,
  "lastDeliveredEvent": "0"
}
```

The words above illustrate a valid stored nonzero state, not a published seed-derivation test vector. Persistent scheduler state belongs to its owning scope. The game's schema defines the shape of custom data; functions, handles, and numeric-class objects never enter JSON. `capMs: null` means unlimited; `catchup: null` means no pending session. Omitted optional fields and explicit null values are not interchangeable.

A non-null catch-up record contains session ID, start/end wall timestamps, frozen entitlement, eligible/processed/pending/discarded real durations, processed rules-version segments, report aggregates, and delivery cursor. State and this record commit together. `processed + pending = eligible` is an invariant within the session. An update migration carries its own idempotency ID in the save migration ledger when compensation is applied. Full JSON schemas, RNG transition vectors, seed/fork vectors, and interrupted-session examples must be written before S04 persistence implementation; the illustrative envelope is not a schema validator.

## Determinism boundary

Canonical replay guarantees are scoped to the pinned runtime engine/configuration, content, simulation schedule, adapter implementation, seed, and ordered command stream. They do not imply matching transcendental results across V8 and JavaScriptCore. ECMAScript specifies relevant mathematical operations using implementation-approximated results. [ECMAScript number and math specification](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.pow).

Cross-engine validation uses tolerances for numeric quantities and separately checks exact discrete actions, unlocks, and reset outcomes. A near-threshold branch divergence is a compatibility failure for that fixture, even if quantities lie within tolerance. It must be documented/resolved before claiming that scenario is portable; tolerance is not permission to ignore different gameplay. RNG integer test vectors must match exactly across supported engines. Numeric migration remains explicit when the backend changes.

## Interfaces deliberately scheduled for later

| Surface | Decisions fixed now | Required before implementation |
| --- | --- | --- |
| Tasks | Scope, escrow, fixed-duration/current-work-rate mode, completion/overflow/cancellation policies | S05: definition union and persisted active/completed task shapes |
| Calendars | Canonical boundary quantization, stable ordering, declared real/game clock | S05: phase/duration/modifier definitions and saved phase cursor |
| Automation | Ordinary validated actions; explicit enable/unlock state, priority, cadence and clock domain | S03: schedule/condition/action types; away time runs only actually enabled/unlocked rules at each boundary, including rules legitimately unlocked/enabled during catch-up |
| Workers | Versioned request IDs, source revisions, serialized state/commands; cancellation acknowledged after a committed chunk | S07, before adding worker host: request/response union, transfer codecs, replay/idempotency rules, cancellation-race fixtures |
| Bot observations | Revision, simulation times, player-visible resources/actions, quotes, declared goals; no hidden engine state | S08: concrete observation/quote unions, pagination/query limits, trace serialization |
| Extensions | Build-time content modules and separately registered stepped/bulk mechanics; no unrestricted plugin lifecycle | S00/S01/S03: module exports and rule registration types; S09: checked bulk capability type |
| Localization | Key plus named typed scalar/quantity/time arguments; rich descriptions are ordered text/token/emphasis/link nodes | S06: token/node unions, catalog argument validation and allowed link policy; no arbitrary HTML in simulation output |

“Plugin contracts” in the original package table meant these bounded extension surfaces, not an already-designed plugin manager. Definitions for a feature must pass its type/API review before that feature's engine code is written. Compilable type-only fixtures are a future S00 gate; this pass adds Markdown only.

## Deferred infrastructure decisions

At implementation start, use two ESM packages with explicit subpath exports, strict TypeScript including `exactOptionalPropertyTypes`, and `tsc` for declarations/build initially. Use Vitest and fast-check for the named behavioral invariants. Version selection and installation occur then, not in this review pass.

Enforce forbidden DOM/timer/storage imports and globals on headless source paths and their transitive dependencies. Keep explicitly permitted browser host paths separate; a package-wide ban would wrongly reject `core/browser`. Add a Node import smoke test and package-export tests, plus CI for types, Biome, coverage, structure, and tests under the [quality gates](quality-gates.md). Node alone does not detect every dormant browser dependency, so static boundary checks are also necessary.

Add Playwright for the renderer in S06 and browser lifecycle and two-tab cases in S07. Clock/lifecycle injection tests cover repeatable suspension recovery; real device sleep is a separate integration check and cannot be established solely by Playwright fake timers. No package manifests, test files, CI configuration, or dependencies are created by this document.
