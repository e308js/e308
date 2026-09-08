#!/usr/bin/env bash
set -euo pipefail

workspace_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
consumer_dir=$(mktemp -d -t e308-consumer-XXXXXX)
trap 'rm -rf -- "$consumer_dir"' EXIT

cd "$workspace_root"
pnpm --filter @e308/core pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/ux pack --pack-destination "$consumer_dir" >/dev/null
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
  import { readFile } from "node:fs/promises";
  const pkg = JSON.parse(await readFile("node_modules/@e308/ux/package.json", "utf8"));
  if (pkg.dependencies?.["@e308/core"] !== "0.0.0") process.exit(1);
'
