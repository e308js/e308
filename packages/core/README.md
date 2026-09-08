# @e308/core

The framework-independent deterministic simulation package for e308. It currently provides native
and `break_eternity.js` quantities, scoped definitions, immutable transactional snapshots, fixed-step
time, module dependency ordering, and named deterministic random streams.

```ts
import { createGame, createGameKit, eternityNumbers } from "@e308/core";

const kit = createGameKit({ numbers: eternityNumbers });
const run = kit.scope("run");
const clips = kit.resource("factory/clips", { scope: run, initial: kit.q("0") });
const definition = kit.defineGame({
  id: "paperclip-lab",
  simulationVersion: 1,
  stepMs: 50,
  resources: [clips],
});
const game = createGame(definition);

game.dispatch({ id: "make-clip", execute: (transaction) => transaction.add(clips, kit.q("1")) });
```

Imports have no timers, storage, DOM access, or simulation side effects. Numeric and state APIs reject
non-finite values and cross-definition handles before committing state.
