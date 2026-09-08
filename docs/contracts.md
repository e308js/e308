# Design decisions and acceptance contracts

Status: specification only. No implementation, scaffolding, or benchmark results accompany this document. These decisions resolve the eight gaps identified in the design review. They take precedence over illustrative API shorthand in the overview.

The subsequent [interface decisions](interfaces.md) supply concrete numeric/rate/snapshot/failure/save boundaries and clarify the third-party review. Types shown there remain uncompiled documentation.

The [definition of done](definition-of-done.md) adds mandatory TMT capability and AD/Kittens reference parity, plus complete-game and independent-oracle evidence. Its release requirements supersede narrower initial prototypes and include the huge-count domain and optional visual features noted in [tmt-parity.md](tmt-parity.md).

## 1. Production semantics

The first simulation model is discrete, using a game-selected fixed quantum and a saved remainder. The default proposed quantum is 50 ms. Time presented by the host accumulates until a complete quantum is available. Rendering and work chunk sizes cannot change that sequence. Events with off-grid deadlines occur at the first canonical boundary on or after their deadline; fractional timer phase is preserved so rounding does not compound every recurrence. The supported baseline requires periodic automation intervals to be at least one quantum.

“Producer” is an authoring convenience over distinct mechanics:

| Mechanic | Payment and progress | Output |
| --- | --- | --- |
| Flow | Evaluate rate from the start-of-step state; reserve proportional inputs | Divisible quantities at the endpoint |
| Instant recipe | Atomically pay an integer number of recipe executions | Whole recipe outputs in the same action |
| Timed task | Escrow inputs when the task starts; persist remaining work | Outputs become claimable at completion |
| Generator chain | A flow produces the quantity of another producer | New producer quantity affects the next step |

Timed tasks declare one of two speed policies: duration fixed at start, or remaining work advanced by the current work rate. Default to fixed-at-start. Outputs and recipe identity are fixed at start; explicit upgrade migrations can change them. This avoids retroactively charging more for work already paid for.

Tasks default to blocking delivery if storage is insufficient, retaining their paid output in a completed task slot. They do not repeatedly reroll an outcome while blocked. Discarding overflow is an explicit alternative. Queued entries do not pay until they start. Cancelling an unfinished task defaults to refunding its escrow; a developer may specify a consumed fraction. Refund overflow remains in a claimable refund record. Cancelling completed work does not refund inputs; it requires claiming or explicitly discarding the output. Reset rules below override ordinary cancellation rules where stated.

Flows default to start-of-step rates, input throttling, and discard-overflow output. Their explicit `priority` defaults to 0, with lower safe integers first and stable case-sensitive ID order as tie-break. Inputs cannot become negative. Each step maintains an input-availability ledger initialized from starting stocks and a projected final-balance ledger. Earlier reserved outputs never become available as inputs in the same step. A process reserves a feasible execution amount against all inputs and, for blocking outputs, against projected capacity after its own input deductions. Both ledgers update together. Earlier reservations can intentionally affect later processes through the documented priority order. A process is not revisited within the same step if a later process frees capacity. The [allocation formula](interfaces.md#rate-data-and-allocation) defines feasible executions; unmet input demand does not become saved production debt.

Blocking output scales the whole flow, including every input and output, to the jointly feasible amount. Discarding output still consumes its paid inputs and records overflow. Each output declares its policy; unspecified outputs use discard. Redirecting overflow is deferred to an explicit separate mechanic because recursive redirects need additional cycle semantics. Shrinking a capacity defaults to retaining over-cap stock until consumed while blocking additions to that stock; destructive clamping must be selected explicitly.

Discrete passive output is represented as accumulated work towards a recipe, not fractional inventory that a player can spend. Work remainders persist. Input-consuming discrete production uses paid tasks or whole recipes; it cannot emit a free item from a rounded fractional calculation.

The generator-chain contract uses purchased count for price/milestone rules and total quantity for production unless the author chooses otherwise. For a one-second quantum, zero lower generators, and one new lower generator each second producing one currency/sec, ten steps produce 10 lower generators and 45 currency. Continuous integration would produce 50 currency and is a different model. This difference is intentional and testable.

Acceptance fixtures must cover shared inputs, mixed blocking/discard outputs, simultaneous depletion and completion, capacity reduction, cancellation refunds, fractional work across reload, and the 45-currency chain example. Reversing definition import order must not alter results when IDs/priorities are unchanged.

## 2. Prestige, resets, and challenges

Every saved field belongs to a named scope. Definitions declare initial values and scope ownership. A reset names cleared scopes, retained fields, and reward destinations. Retention overrides clearing; conflicting declarations or unspecified references fail definition validation. Adding a field to a cleared scope automatically includes it in future resets. Persistent account-wide counters must live outside run scopes.

Prestige-layer dependencies form a directed acyclic unlock graph. They do not imply reset propagation. A higher prestige clears lower scopes only when its reset manifest names them. One prestige action grants its own reward once; clearing another layer does not execute that layer's reward action.

Reset transaction order:

1. Evaluate eligibility and reward from the pre-reset state, with the currently active challenge rules.
2. Capture retained values and the full reset preview.
3. Invalidate queued commands targeting cleared scopes using scope-generation identifiers.
4. Discard tasks/escrow owned by cleared scopes, without ordinary cancellation refunds. Retained tasks retain their escrow and remaining work. A task referencing a removed destination cannot be retained without an explicit migration.
5. Initialize cleared state; restore retained fields; grant the already computed reward.
6. Restore valid allocation and automation state, recompute derived values, and resolve milestones in stable order.
7. Commit once and emit one reset event plus its recorded consequences.

Automation settings and unlocks may be persistent, but scheduled cooldowns in cleared scopes restart from the reset boundary. They cannot fire again at that same boundary. Retained tasks use remaining work, not an obsolete absolute due time. RNG stream positions persist across prestige by default; reset does not allow a player to reroll the same next event. Reset-specific randomness is part of the same transaction.

Reward destinations should be outside cleared scopes; an explicit after-initialization grant is allowed when the design needs otherwise. Failures roll back the whole reset. A preview carries a revision and cannot silently authorize a changed reset: execution of a confirmed preview rejects a stale revision and returns a replacement preview.

Challenges have an explicit lifecycle: enter, active, completed or failed, and exit. Entry and exit each name a reset manifest and do not grant prestige rewards implicitly. Completion rewards are permanent ledger entries keyed by challenge ID and completion tier; retries cannot grant a tier twice. Retry means exit followed by a new entry transaction with no production between them.

Challenges default to exclusive. Combination requires a declared compatible group. Additive/multiplicative modifiers follow the normal named stacking stages; conflicting replacements or opposing action permissions require an explicit precedence rule, otherwise the combination is rejected. A challenge manifest declares whether each prestige action is allowed and whether that action exits the challenge. No challenge silently survives or ends because its tab disappeared.

Acceptance fixtures include two-level prestige retention, a queued purchase invalidated by reset, retained and discarded tasks, simultaneous challenge completion/prestige, combined modifier conflicts, retry reward idempotency, and stale reset confirmation.

## 3. Balance authoring

Add a balance subpath, `@e308/core/balance`, for pure curve definitions, tabulation, and sensitivity experiments. All helpers use the game's numeric adapter and expose their domain and boundary behavior. This is a library and report format; a visual editor is deferred.

The initial vocabulary includes constant, linear, geometric, power, piecewise milestone curves, hard caps, power soft caps, and saturation curves. A power soft cap at positive threshold `T`, with exponent `0 < p < 1`, is `x` up to `T` and `T × (x/T)^p` above it. A saturation curve for nonnegative `x` is `L × x/(K+x)`, with positive `L` and `K`. These definitions are continuous at their intended boundaries. Authors explicitly select a curve and its position in the modifier pipeline.

Curve definitions provide evaluation and optional cumulative-cost, inverse, and monotonicity capabilities. Unsupported inversion returns “unsupported”; the engine must not invent an inverse for arbitrary code. Integer-price rounding is declared and included in cumulative costs. Repeated individual purchases and an approved bulk path must agree, including milestone breakpoints and rounding.

The balance inspector tabulates values, next costs, marginal production changes, and modifier contributions. Payback time is shown only with assumptions about what is held constant. Dynamic markets, resource constraints, and resets can make a single payback number misleading.

Parameter sweeps run explicit finite sets of changes against identical scenario definitions: for example, producer cost at 0.8×, 1.0×, and 1.2× across three player strategies. Preserve paired seeds within a comparison; a change that alters random event paths can break pathwise pairing, and the report must say so. Report valid runs, invalid configurations, timeouts, and unreached milestones separately. Do not average failures away.

Acceptance fixtures check curve continuity, domain failures, milestone costs, rounding boundaries, and a known 20% cost change with a hand-checkable milestone timing consequence.

## 4. Bot-player and pacing report contract

Each run is identified by content/simulation versions, parameter overrides, starting save hash, numeric adapter/version, simulation quantum, game seed, bot seed/policy version, decision cadence, session schedule, fidelity, and stop condition. A recorded action trace can be replayed independently of the bot. A bot may inspect only its observation interface; it cannot mutate state or read an undiscovered definition through engine internals.

The baseline comparison matrix contains a scripted known path, an affordable-first policy with a declared ranking, and a game-authored goal policy, each under active, intermittent, and long-absence schedules. Stochastic scenarios use a configurable explicit seed list; twenty seeds is an initial experiment preset, not a statistical sufficiency claim. Deterministic scenarios do not pretend repeated identical seeds add evidence.

Report milestone first-passage times in real elapsed time, advanced game time, and active player time. Waiting is time with no action satisfying the policy's declared usefulness predicate. Distinguish that from no legal action at all. Report action attempts, successful actions, manual decisions, longest waiting interval, reset recovery targets, cap losses, task blocks, and resource constraints. Use separate engine wall-runtime measurements for computational performance.

Report distributions and the fraction reaching each goal before the horizon. Quantiles over successful runs must be labeled as conditional on success, with the unreached count adjacent. Never treat an unreached milestone as zero or silently substitute the timeout as its completion time.

Compare content versions with the same scenario matrix. Show absolute and relative changes in milestone times and action burden, new stalls, and changed outcomes. Regression thresholds belong to a versioned developer baseline; a balance change becomes a review finding unless the developer explicitly designates a hard invariant.

Diagnostics attach reasons from actual action quotes and production evaluations: insufficient input, insufficient capacity, unavailable prerequisite, allocation constraint, disabled automation, or policy rejection. An optional counterfactual run changes one identified constraint and records whether it resolves the stall. Label this intervention evidence, not proof of a unique cause.

“Unreachable” requires a bounded proof with its assumptions: for example, cost exceeds a fixed capacity with no capacity-changing action permitted in the declared scenario. Otherwise say “not reached by this policy within this horizon.” Detecting a repeated canonical state under a deterministic policy can prove a loop only when all relevant clocks, queues, randomness, and counters are included.

Acceptance fixtures include a poor bot missing a reachable goal, a certified capacity barrier, version comparisons with one unreached goal, a regression explained by a missing input, and away sessions in which the player bot makes no decisions.

## 5. Modular content and compatibility

A content module declares a namespaced ID, version, required modules/version constraints, exported typed handles, mechanics, state scopes, localization keys, and migrations. The assembled game records an ordered module/version manifest and a build/content digest. Module definitions are immutable; registries and state are per game instance.

Dependency resolution precedes simulation creation. Missing dependencies, duplicate IDs, cycles in module dependencies, invalid cross-module references, conflicting replacements, and unsupported numeric capabilities are startup errors with source module and definition IDs. Economic feedback cycles may exist; module dependency cycles are a separate prohibited condition. Stable ordering uses declared priorities and IDs, never filesystem import order.

Use namespaces such as `village/food` and `cosmos/probes`. Modules depend on exported handles, not another module's private saved-state layout. Content modules can export presentation metadata, but their simulation entry point cannot import a renderer. Separate view modules may depend on a content module and the UX layer.

A changed label needs no state migration; renaming a persistent ID does. Removing a module requires an explicit migration mapping or retiring its state, tasks, allocations, and pending references. Unknown content must never be silently dropped from an imported save. Provide a diagnosis and preserve the original save when no valid migration path exists.

The initial model supports content assembled at build time. Runtime plugin downloading, untrusted mod sandboxing, and dependency installation are outside this contract. Game-authored modules are code and can invalidate deterministic guarantees if they call clocks, ambient randomness, or external services.

Acceptance fixtures include an independently reusable research branch, two instances of the same assembled game, reordered imports, missing dependencies, a renamed resource migration, and removal of a module owning a pending task.

## 6. Updates during absence

The chosen default is **migrate first, then advance under the installed rules**. A player leaving version 1 and returning to version 2 gets the eligible unprocessed absence evaluated using version 2. Reports identify a rules update. Reconstructing the release time inside the absence is not implied, and historical code is not loaded automatically.

Entitlement is separate from production rules. Persist the resolved absence entitlement policy at the last authoritative save (enabled state, real-time cap, excess handling, policy version). A dynamic cap is resolved from that state when the absence begins; closing need not fire a final browser event, so the latest coherent saved checkpoint is the recovery boundary. Migration retains this entitlement unless a developer supplies an explicitly labeled compensation or policy migration. A reduced cap in the new release therefore does not silently reduce a previous saved absence's entitlement.

Already committed catch-up retains its rewards. Only pending duration can change rules, and it requires a registered transition converting state, tasks, RNG, scheduler position, and simulation remainder. The report records segments under each rules version. A quantum change must explicitly convert the remainder/cooldown phase or reject migration; never reset the remainder to zero casually.

A pending session with no declared compatible transition remains preserved and paused with a compatibility error. The developer can ship that transition or deliberately bundle the old definition to finish it. The engine cannot assume that a schema migration alone establishes simulation compatibility. Retries of an update migration use a stable migration ID and atomic save replacement to avoid applying compensation twice.

New absences use the installed version's entitlement policy. Repeated reloads while processing an existing absence resume its frozen policy rather than create fresh capped sessions. Time after the return endpoint is accounted for separately using the same pending-time rules.

Acceptance fixtures cover a production buff during absence, a cap reduction, an interrupted catch-up updated halfway through, an incompatible quantum change, and a migration/compensation interrupted before and after commit.

## 7. Renderer integration

The rendering contract has four inputs: a narrow view source, a localization/formatting catalog, game-authored layout/composition, and optional theme/control overrides. Core does not accept a layout. UX does not force a router, root component, app shell, or prestige-tree view.

The DOM renderer mounts into a caller-owned element and returns update/dispose handles. The host owns game start/stop; mounting never starts a simulation timer and unmounting never resets a game. Disposing removes only the renderer's subscriptions, handlers, timers, and descendants. Multiple mounted views can observe one game, and one page can render independent games.

Use keyed controls bound to typed action/resource views. Render updates retain element identity and input focus. Pointer/keyboard interaction dispatches stable command IDs through the source. Routine purchase commands can request “buy what is affordable now”; confirmed reset commands require their preview revision. Pending asynchronous commands expose busy/result states and deduplicate repeated submission by command ID, with idempotency state owned by the host for the session.

A control override receives the same view and command interface as the supplied control. Replacing a buy button does not require copying cost math. A custom mechanic supplies its own view projection, validated command, and custom control; the engine does not require adding it to a global renderer switch statement. A custom renderer can ignore all supplied controls and consume the same headless views.

The example renderer is composed with ordinary DOM composition functions; a serialized page-layout language is not required. Support a complete sample screen with resource list, producers, allocations, project list, reset preview, and offline report. A narrative example uses different composition and progressive disclosure over the same game save.

Acceptance requires mounting and disposing repeatedly without duplicate actions, replacing one buy control, rendering a custom market view, changing layouts without a save migration, keyboard-only completion of the example actions, focus retention after unlocks, and UX rendering through a non-core mock source. Source-side projections filter undiscovered details before controls receive them; hiding text with CSS is insufficient.

## 8. Determinism and performance boundaries

The contractual baseline is identical canonical state for the same initial state, ordered commands, seed, content/simulation version, numeric implementation/version, and supported runtime configuration, independent of render cadence, work yielding, and save/load boundaries. It excludes wall-clock diagnostics and presentation preferences. Custom callbacks must use provided time and RNG, avoid external state, and follow the specified mutation and ordering contracts.

Do not promise bit-identical results across numerical backends or arbitrary runtime versions. Publish the tested runtime matrix when implementation exists. A backend change is a simulation migration and needs comparative fixtures. Alternate arithmetic evaluation order can change floating-point rounding even with an algebraically equivalent shortcut. A shortcut is canonical only if it preserves the canonical numerical result; otherwise classify it as approximate with measured differences and exact checks for discrete outcomes.

Numeric adapters declare construction from strings, arithmetic, comparisons, finite/invalid detection, integer rounding, powers/logs where supported, and a versioned codec. No implicit conversion of large quantities to native numbers. Reject invalid or unsupported results at transaction boundaries and preserve the last valid state. Extremely large “integer” quantities may cease to distinguish adjacent integers in approximate backends; exact task indices, bounded queue counts, and sequence IDs use separate bounded integer types. A purchase helper must refuse unsupported count resolution rather than loop forever adding one to an unchanging huge quantity.

No capacity or speed figures are measured yet. The planned benchmark matrix deliberately varies shape as well as size:

| Workload | Initial experiment points |
| --- | --- |
| Resources and active processes | 10, 100, 1,000 of each |
| Production dependencies | Independent flows; chains of 3, 10, 100; shared-input contention |
| Scheduled work | 10, 100, 1,000 active tasks/automation rules |
| Absence | 1 minute, 1 hour, 8 hours, 1 day, 30 days |
| Views | Headless; one view; two views; 100 and 1,000 visible controls |
| Arithmetic | Native numbers and the chosen large-number adapter |

Run selected representative combinations rather than every Cartesian product. Record hardware, runtime versions, fixture versions, warm/cold runs, elapsed simulation work, peak memory, throughput, longest chunk, and UI dispatch latency. Repeat enough runs to report median and tail values. Include a worst-case custom callback fixture whose only valid path is stepping.

Provisional goals are an 8 ms cooperative chunk target, no avoidable main-thread task over 50 ms in representative browser runs, and under two seconds for an eight-hour catch-up of each small example on a declared reference machine. These are future go/no-go targets, not advertised guarantees. If a single custom operation exceeds the budget, report it; cooperative yielding cannot preempt arbitrary synchronous callbacks.

Bound work queues, diagnostics, event-cascade iterations, and report samples with configured operational limits. Hitting a limit pauses with a diagnostic and pending duration intact. It never silently drops economic events. Release documentation must publish measured supported workloads and explain exceptions. Unlimited entitlement remains supported by accounting even when replay is expensive.

## Decision closure

All eight review gaps now have explicit semantics and future acceptance fixtures. Remaining empirical work is to validate authoring ergonomics, numerical behavior, runtime support, and performance. That work is intentionally deferred until implementation is requested; specification completeness is not evidence that the library already meets its targets.
