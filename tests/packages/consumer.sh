#!/usr/bin/env bash
set -euo pipefail

workspace_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
consumer_dir=$(mktemp -d -t e308-consumer-XXXXXX)
trap 'rm -rf -- "$consumer_dir"' EXIT

cd "$workspace_root"
pnpm --filter @e308/core pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/ux pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/game-wireworks pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/game-cascade pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/game-hearth pack --pack-destination "$consumer_dir" >/dev/null
npm pack "$workspace_root/packages/core/node_modules/break_eternity.js" \
  --pack-destination "$consumer_dir" --cache "$consumer_dir/.npm-cache" --silent >/dev/null
npm pack "$workspace_root/packages/core/node_modules/@noble/hashes" \
  --pack-destination "$consumer_dir" --cache "$consumer_dir/.npm-cache" --silent >/dev/null
npm pack "$workspace_root/packages/core/node_modules/semver" \
  --pack-destination "$consumer_dir" --cache "$consumer_dir/.npm-cache" --silent >/dev/null

cd "$consumer_dir"
printf '%s\n' '{"name":"e308-clean-consumer","private":true,"type":"module"}' > package.json
npm install --save-exact --ignore-scripts --no-audit --offline --cache "$consumer_dir/.npm-cache" \
  "$consumer_dir/e308-core-0.0.0.tgz" \
  "$consumer_dir/e308-ux-0.0.0.tgz" \
  "$consumer_dir/e308-game-wireworks-1.0.0.tgz" \
  "$consumer_dir/e308-game-cascade-1.0.0.tgz" \
  "$consumer_dir/e308-game-hearth-1.0.0.tgz" \
  "$consumer_dir/break_eternity.js-2.1.3.tgz" \
  "$consumer_dir/noble-hashes-2.4.0.tgz" \
  "$consumer_dir/semver-7.8.5.tgz" >/dev/null

node --input-type=module -e '
  import { createGame, createGameKit, nativeNumbers, upgradeCommand } from "@e308/core";
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 1 });
  const upgrade = kit.upgrade("first", {
    scope: run, costs: [[points, 1]], prerequisiteIds: [], unlocked: () => true
  });
  const definition = kit.defineGame({
    id: "consumer", simulationVersion: 1, stepMs: 50, resources: [points], upgrades: [upgrade]
  });
  const game = createGame(definition);
  if (!game.dispatch(upgradeCommand(upgrade)).ok || !game.getSnapshot().progression.upgrades.first) process.exit(1);
'
node --input-type=module -e '
  import { compareBaseline } from "@e308/core/balance";
  import { rankedPolicy, runHarness } from "@e308/core/testing";
  if (![compareBaseline, rankedPolicy, runHarness].every(value => typeof value === "function")) process.exit(1);
'
node --input-type=module -e '
  import { AdvanceBacklog, advanceOptimized, profileAdvancement } from "@e308/core/optimize";
  if (![AdvanceBacklog, advanceOptimized, profileAdvancement]
    .every(value => typeof value === "function")) process.exit(1);
'
node --input-type=module -e '
  import { currentPhase } from "@e308/core/calendar";
  import { IndexedDbSaveStore } from "@e308/core/browser";
  import { quoteMarket } from "@e308/core/markets";
  import { queueTaskCommand } from "@e308/core/tasks";
  import { attachWorkerRuntime } from "@e308/core/worker";
  if (![currentPhase, IndexedDbSaveStore, quoteMarket, queueTaskCommand, attachWorkerRuntime]
    .every(value => typeof value === "function")) process.exit(1);
'
node --input-type=module -e '
  import { createGame, createGameKit, nativeNumbers } from "@e308/core";
  import { beginCatchup, processCatchupChunk } from "@e308/core/offline";
  import { createSaveCodec } from "@e308/core/persistence";
  import { MemorySaveStore } from "@e308/core/storage";
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 1 });
  const definition = kit.defineGame({ id: "save-consumer", simulationVersion: 1, stepMs: 50, resources: [points] });
  const game = createGame(definition);
  const entitlement = { policyVersion: "1", enabled: true, capMs: null, excess: "discard" };
  const codec = createSaveCodec(definition, { stateSchemaVersion: 1, contentVersion: "1", contentDigest: "one" });
  const loaded = codec.decode(codec.encode(game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }));
  const started = beginCatchup(definition, loaded, 50, "consumer");
  const result = processCatchupChunk(definition, createGame(definition, { snapshot: started.snapshot }), started.catchup, 1);
  if (!result.ok || result.value.snapshot.gameTimeMs !== 50) process.exit(1);
  const store = new MemorySaveStore();
  const written = await store.compareAndSwap("main", null, codec.encode(result.value.snapshot, { ...started, catchup: result.value.session }));
  if (!written.ok) process.exit(1);
'
node --input-type=module -e '
  import { createWireworks } from "@e308/game-wireworks";
  import { createCascade } from "@e308/game-cascade";
  import { createHearth } from "@e308/game-hearth";
  const games = [createWireworks(), createCascade(), createHearth()];
  if (games.some(game => game.getSnapshot().revision !== 0n)) process.exit(1);
  if (!games.every(game => game.dispatch({ type: "advance", milliseconds: 1000 }).ok)) process.exit(1);
'
node --input-type=module -e '
  import { starterTheme } from "@e308/ux";
  import { mountView } from "@e308/ux/dom";
  import { renderParticleLayer } from "@e308/ux/effects";
  import { createQuantityFormatter } from "@e308/ux/format";
  import { createTextResolver } from "@e308/ux/localization";
  import { actionFromQuote } from "@e308/ux/views";
  if (![mountView, renderParticleLayer, createQuantityFormatter, createTextResolver, actionFromQuote]
    .every(value => typeof value === "function") || !starterTheme.includes(".e308-root")) process.exit(1);
'
node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  const pkg = JSON.parse(await readFile("node_modules/@e308/ux/package.json", "utf8"));
  if (pkg.dependencies?.["@e308/core"] !== "0.0.0") process.exit(1);
  const schema = JSON.parse(await readFile("node_modules/@e308/core/schema/save-v1.schema.json", "utf8"));
  if (schema.title !== "e308 save envelope v1") process.exit(1);
'
