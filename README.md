# e308

e308 is a TypeScript toolkit for deterministic incremental and idle games. It keeps simulation,
persistence, offline progress, and balance tooling in a headless core. The optional `@e308/ux`
package turns game-owned view models into accessible DOM controls while the game owns its framework
and layout.

The repository includes three complete original games with different economies and interfaces:

- **Wireworks** separates manufacturing from market sales across workshop, industry, and autonomous
  expansion eras.
- **Cascade** uses eight producer tiers, three reset layers, challenges, allocations, automation, and
  values above `1e308`.
- **Hearth** is a seasonal settlement economy built around workers, storage, crafting, paid tasks,
  shortages, and recovery.

The packages are release candidates. The workspace quality pipeline creates installable archives
and tests them in clean temporary consumers. npm publication will make installation available as:

**[Play Wireworks, Cascade, and Hearth](https://e308js.github.io/e308/)**

```sh
pnpm add @e308/core
pnpm add @e308/ux # optional renderer and view contracts
```

## Build a first game

Definitions are immutable and scoped to a game kit. Numeric operations stay in an adapter, so the
same APIs work with native numbers or `break_eternity.js` quantities.

```ts
import { createGame, createGameKit, nativeNumbers } from "@e308/core";

const kit = createGameKit({ numbers: nativeNumbers });
const run = kit.scope("run");
const sparks = kit.resource("sparks", { scope: run, initial: 0 });

const generator = kit.flow("generator", {
  scope: run,
  rate: kit.rates.constant(2),
  produces: [[sparks, 1]],
});

const definition = kit.defineGame({
  id: "spark-foundry",
  simulationVersion: 1,
  stepMs: 100,
  resources: [sparks],
  flows: [generator],
});

const game = createGame(definition);
game.advance(5_000);

console.log(game.getSnapshot().resources.sparks); // 10
```

Every advance uses canonical fixed steps and preserves fractional elapsed time. Flows read from the
same start-of-step state, reserve shared inputs in stable priority/ID order, and publish outputs at
the end of the step. Commands are atomic: failed purchases, recipes, resets, tasks, and trades leave
the snapshot unchanged and return a structured reason.

## Add mechanics

`createGameKit` builds typed, composable definitions for:

- resources, constant/proportional/product flows, recipes, capacities, and allocations;
- geometric or segmented buyables, sell/respec commands, and modifier breakdowns;
- normal, static, and custom prestige; reset scopes and retention;
- upgrades, milestones, achievements, challenges, challenge composition, and automation;
- paid task queues, deterministic calendars, and revision-bound markets.

Definitions can be grouped into dependency-checked content modules. Custom stepped rules and checked
bulk capabilities cover game-specific mechanics while keeping core generic and presentation-free.

Use `eternityNumbers` when progression must exceed native numeric range:

```ts
import { createGameKit, eternityNumbers } from "@e308/core";

const kit = createGameKit({ numbers: eternityNumbers });
const enormous = kit.q("1e1000000");
```

## Save and grant offline progress

Save codecs bind data to the game ID, content digest, simulation version, step schedule, and numeric
codec. They preserve random streams, automation clocks, tasks, calendars, market state, and an
interrupted catch-up session.

```ts
import { createGame } from "@e308/core";
import { beginCatchup, processCatchupChunk, resolveEntitlement } from "@e308/core/offline";
import { createSaveCodec } from "@e308/core/persistence";

const codec = createSaveCodec(definition, {
  stateSchemaVersion: 1,
  contentVersion: "1.0.0",
  contentDigest: "sha256-of-your-content",
});

const entitlement = resolveEntitlement(
  {
    policyVersion: "standard-1",
    enabled: true,
    cap: { kind: "duration", milliseconds: 8 * 60 * 60 * 1_000 },
    excess: "discard",
  },
  game.getSnapshot(),
);

const raw = codec.encode(game.getSnapshot(), {
  wallAnchorMs: Date.now(),
  entitlement,
  catchup: null,
});

const loaded = codec.decode(raw);
const catchup = beginCatchup(definition, loaded, Date.now(), crypto.randomUUID());

if (catchup.catchup) {
  const resumed = createGame(definition, { snapshot: catchup.snapshot });
  const result = processCatchupChunk(definition, resumed, catchup.catchup, 10_000);
  // Persist the returned snapshot and session atomically before processing another chunk.
}
```

The computation budget limits work per chunk while preserving all credited time in the serializable
session. `@e308/core/browser` adds IndexedDB, autosave, suspension reconciliation,
and cross-tab single-writer ownership. `@e308/core/worker` provides a versioned worker protocol with
revision fencing and chunk-boundary cancellation.

## Render a game

`@e308/ux` consumes a small structural source: `getSnapshot`, `subscribe`, and `dispatch`. A game owns
its view projection and intents. The included DOM renderer is replaceable by React, Vue, Svelte, a
terminal, or a custom canvas renderer.

```ts
import { nativeNumbers } from "@e308/core";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
} from "@e308/ux";

const project = (state: State): ViewDocument<Intent, number> => ({
  title: "Spark Foundry",
  content: [
    {
      kind: "resource",
      id: "sparks",
      resource: { resourceId: "sparks", label: "Sparks", value: state.sparks, rate: 2 },
    },
  ],
});

const resolver = createTextResolver({
  quantities: createQuantityFormatter(nativeNumbers),
});

const mount = mountView(document.querySelector("#game")!, { source, project, resolver });
// mount.dispose() removes subscriptions and input listeners.
```

View nodes include semantic actions, resources, cost lines, reset/offline/save summaries, nested
tabs, positioned trees, grids, progress bars, infoboxes, typed inputs, notifications, hotkeys,
particles, safe rich descriptions, and custom render slots. Controls are unstyled by default;
`starterTheme` is an optional baseline.

## Test pacing headlessly

`@e308/core/testing` gives bot policies only a serializable observation and legal, revision-bound
action quotes. It records reproducible actions, waits, constraints, milestones, offline fidelity, and
bounded samples. `@e308/core/balance` aggregates runs, sweeps parameters, and compares content
versions. `@e308/core/optimize` offers validated exact advancement with canonical fallback and
explicitly labeled approximation contracts.

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
  goalId: "first-reset",
  decisionCadenceMs: 1_000,
  schedule: [{ kind: "active", durationMs: 60_000 }],
  limits: {
    maximumDecisions: 100,
    maximumTraceEntries: 200,
    maximumSamples: 100,
    sampleCadenceMs: 1_000,
  },
  replayCommand: "pnpm pacing -- first-reset 00 01",
});

const randomPolicy = randomLegalPolicy({ version: "1" });
```

## Packages and examples

| Path | Purpose |
| --- | --- |
| [`packages/core`](packages/core) | Headless engine, persistence, browser host, workers, bots, balance, and optimization |
| [`packages/ux`](packages/ux) | Framework-independent view contracts, DOM renderer, formatting, localization, and effects |
| [`games/wireworks`](games/wireworks) | Complete market/automation example and alternate terminal projection |
| [`games/cascade`](games/cascade) | Complete large-number prestige/challenge example |
| [`games/hearth`](games/hearth) | Complete seasonal allocation/crafting example |
| [`examples/finished-games`](examples/finished-games) | Browser host for all three original games |
| [`examples/gallery`](examples/gallery) | Renderer capability gallery with two layouts over one state source |
| [`examples/pacing`](examples/pacing) | Reproducible pacing, sweep, baseline, checkpoint, and performance reports |

Reference-game fixtures provide private test evidence for bounded mechanics comparisons against
pinned Array Game, Universal Paperclips, Antimatter Dimensions, and Kittens Game sources. The public game page
features the three original e308 games.

## Develop e308

This workspace uses Node 24.14.1, pnpm 11.21.0, strict TypeScript, Biome, Vitest with fast-check, and
Playwright.

```sh
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` runs formatting/lint checks, strict types, file/function/duplication/import-boundary
gates, all builds and reports, 80% per-file coverage thresholds for statements, branches, functions,
and lines, packed-package consumer tests, and browser tests. See the [implementation status](docs/status.md)
for exact accepted SHAs and CI runs, and the [definition of done](docs/definition-of-done.md) for the
release evidence contract.

The [public API reference](docs/api-reference.md) lists package subpaths and contracts. The
[migration guide](docs/migration-guide.md) covers persistent IDs, save schemas, offline rule changes,
and numeric backend transitions.

e308 is ESM-only. Core imports remain headless and free of DOM, timer, storage, and ambient-randomness
dependencies.

## License

e308 is available under the [MIT License](LICENSE).
