# Public API reference

e308 has two public packages. `@e308/core` owns deterministic game state and rules. `@e308/ux`
projects resolved state into optional framework-independent view data and semantic DOM controls.
Import only package roots and documented subpaths; source files are not public entry points.

## Core root

The root `@e308/core` export contains the normal game-authoring surface:

| API | Purpose |
| --- | --- |
| `createGameKit({ numbers })` | Creates typed scope, resource, mechanic, rate, and game builders for one numeric backend |
| `defineGame(options)` | Validates an assembled definition when builders are not needed |
| `createGame(definition, options?)` | Creates an isolated engine behind immutable revision snapshots |
| `nativeNumbers`, `eternityNumbers` | Supported number and `break_eternity.js` quantity adapters |
| `geometricCurve`, `segmentedCurve` | Backend-aware cumulative costs and max-buy calculations |
| `normalPrestige`, `staticPrestige` | Supplied prestige formulas with explicit reset manifests |
| command builders | Validated commands for buy, sell, recipe, allocation, prestige, challenge, upgrade, automation, market, and task actions |

`Game<N>` exposes `getSnapshot()`, `subscribe(listener)`, `dispatch(command)`, and
`advance(elapsedMs)`. A snapshot keeps stable identity until the next published revision. A command
either commits atomically and returns a receipt or returns a structured failure without changing the
revision.

Definitions created through `GameKit<N>` include:

- `scope`, `resource`, `flow`, `recipe`, `allocation`, and `buyable`
- `upgrade`, `milestone`, `achievement`, `challenge`, and `prestige`
- `automation`, `task`, `calendar`, `market`, `scopeActivation`, and `steppedRule`
- inspectable constant, allocated, proportional, and product rate constructors plus a callback
  escape hatch

Definition order is validated and deterministic. Flows read start-of-step state, reserve shared
inputs by priority and ID, and publish outputs at the end of the fixed step. A reset names scopes to
clear and may explicitly retain owned state.

## Core subpaths

| Import | Public responsibility |
| --- | --- |
| `@e308/core/offline` | Resolve saved entitlement; start, chunk, acknowledge, cancel, or discard catch-up work |
| `@e308/core/persistence` | Versioned save codec, envelope types, schema migrations, and pending-session transitions |
| `@e308/core/storage` | Transactional save ports, in-memory adapter, compare-and-swap catch-up commits |
| `@e308/core/browser` | Browser clocks/lifecycle, IndexedDB, autosave host, and cross-tab writer ownership |
| `@e308/core/worker` | Versioned worker messages, client fencing, endpoint, and worker runtime |
| `@e308/core/tasks` | Queue, cancel, and claim-refund commands plus paid-task state |
| `@e308/core/calendar` | Calendar phase and boundary types plus current-phase lookup |
| `@e308/core/markets` | Revision-bound quotes and atomic market commands |
| `@e308/core/testing` | Bot policies, scenario harness, replay, statistics, and report encoders |
| `@e308/core/balance` | Parameter sweeps and versioned baseline comparisons |
| `@e308/core/optimize` | Checked exact advancement, declared approximations, bounded backlogs, and profiling |

Offline work always separates time entitlement from processing budget. A cap limits credited real
time; a chunk limit bounds current computation and preserves remaining work. Exact optimized paths
must prove their preconditions and fall back to canonical fixed steps when they cannot.

## UX root and subpaths

`@e308/ux` exports the complete optional UX surface. Its important boundaries are:

| API | Purpose |
| --- | --- |
| `GameViewSource`, `ViewSource` | Read snapshots, dispatch intents, and subscribe without giving the renderer simulation ownership |
| `ViewDocument`, `ViewNode` | Game-owned tagged view data for resources, actions, tabs, grids, trees, inputs, progress, disclosures, and marks |
| `mountView` | Mounts semantic DOM controls and returns an idempotent `dispose()` handle |
| `actionFromQuote`, `blockerFromFailure` | Converts engine/game projections into visible controls and blockers |
| `createTextResolver` | Resolves structured localization and safe description tokens |
| `createQuantityFormatter`, `formatDuration`, `formatEta` | Backend-compatible quantity and time display |
| `renderParticleLayer` | Optional ephemeral effects whose durable rewards dispatch validated intents |
| `starterTheme` | Optional CSS string; games may replace the composition and styling |

Focused imports are `@e308/ux/dom`, `/effects`, `/format`, `/localization`, and `/views`.
`ViewSource` is structural, so a custom store or server-fed read model can replace e308 core. Visual
clocks may animate presentation but cannot advance economic state.

## Failures and revisions

Player-action failures use stable codes such as `insufficient`, `locked`, `cooldown`,
`invalid-count`, `stale-revision`, `disabled`, `allocation-exceeded`, and `capacity-exceeded`, with a
reason key and structured details where relevant. Operational save, migration, numeric, storage,
worker, and work-budget faults remain distinct from player blockers.

Quotes and intents should carry the snapshot revision they describe. The command rechecks all costs,
requirements, capacities, and scope activation inside its transaction. Renderers and bots therefore
share the same legal action path and cannot spend from a stale quote.

## Compatibility

The supported release configuration is ESM on Node 24 and current Chromium. Core has no DOM, timer,
or storage dependency. Native-number replay is exact within one supported runtime configuration;
cross-engine transcendental results use declared tolerances while discrete purchases, unlocks,
resets, and random integer vectors remain exact. `eternityNumbers` supports quantities above
`1e308`; changing numeric codec is an explicit save migration.

See the package READMEs for runnable code, [migration-guide.md](migration-guide.md) for persistent
changes, and [contracts.md](contracts.md) for detailed ordering and determinism rules.
