# @e308/core

The framework-independent deterministic simulation package for e308. It provides native and
`break_eternity.js` quantities, scoped definitions, immutable transactional snapshots, fixed-step
time, module dependency ordering, named deterministic random streams, production flows, recipes,
allocations, buyables, scalable price curves, modifier breakdowns, prestige resets, upgrades,
milestones, achievements, challenges, scope activation, and scheduled automation.

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

For adapter-independent game code, use `numbers.cmp` in callbacks rather than backend-specific
methods. `normalPrestige` implements threshold, gain multiplier/exponent, direct multiplier, and
softcap stages. `staticPrestige` implements TMT-compatible increasing requirements and one/max gain.
Custom prestige behavior uses ordinary `canReset` and `rewardFor` callbacks.

Imports have no timers, storage, DOM access, or simulation side effects. Numeric and state APIs reject
non-finite values and cross-definition handles before committing state. Flow rates read the state at
the start of each fixed step. Shared inputs are reserved by ascending priority and then ID; outputs
become available to other flows on the next step. `Snapshot.productionTotals` records gross output by
resource, including output later consumed or discarded by a capacity policy.

`scopeActivation` attaches a progression predicate to a scope. Inactive scopes do not run flows,
stepped rules, or automation, and built-in scoped actions return a structured `scope-inactive`
failure. Automation runs at fixed game-time boundaries in priority/ID order and dispatches the same
validated commands used by a player. Reset manifests clear every definition owned by a named scope,
with explicit typed retention for resources, buyables, allocations, upgrades, triggers, challenges,
and automation schedules.

`geometricCurve` performs cumulative pricing and max-buy arithmetic in the selected numeric backend.
`segmentedCurve` joins backend-compatible curves at explicit count milestones. Buyable counts remain
numeric-backed even when they exceed JavaScript's safe integer range. Instant recipe request counts
are bounded safe integers because they represent executable iterations.
