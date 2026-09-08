# @e308/core

The framework-independent deterministic simulation package for e308. It provides native and
`break_eternity.js` quantities, scoped definitions, immutable transactional snapshots, fixed-step
time, module dependency ordering, named deterministic random streams, production flows, recipes,
allocations, buyables, scalable price curves, and modifier breakdowns.

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

Imports have no timers, storage, DOM access, or simulation side effects. Numeric and state APIs reject
non-finite values and cross-definition handles before committing state. Flow rates read the state at
the start of each fixed step. Shared inputs are reserved by ascending priority and then ID; outputs
become available to other flows on the next step. `Snapshot.productionTotals` records gross output by
resource, including output later consumed or discarded by a capacity policy.

`geometricCurve` performs cumulative pricing and max-buy arithmetic in the selected numeric backend.
`segmentedCurve` joins backend-compatible curves at explicit count milestones. Buyable counts remain
numeric-backed even when they exceed JavaScript's safe integer range. Instant recipe request counts
are bounded safe integers because they represent executable iterations.
