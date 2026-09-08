#!/usr/bin/env bash
set -euo pipefail

workspace_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
consumer_dir=$(mktemp -d -t e308-consumer-XXXXXX)
trap 'rm -rf -- "$consumer_dir"' EXIT

cd "$workspace_root"
pnpm --filter @e308/core pack --pack-destination "$consumer_dir" >/dev/null
pnpm --filter @e308/ux pack --pack-destination "$consumer_dir" >/dev/null

cd "$consumer_dir"
printf '%s\n' '{"name":"e308-clean-consumer","private":true,"type":"module"}' > package.json
npm install --save-exact --ignore-scripts --no-audit --cache "$consumer_dir/.npm-cache" \
  "$consumer_dir/e308-core-0.0.0.tgz" \
  "$consumer_dir/e308-ux-0.0.0.tgz" >/dev/null

node --input-type=module -e '
  import { defineGame } from "@e308/core";
  const game = defineGame({ id: "consumer", simulationVersion: 1, stepMs: 50 });
  if (game.id !== "consumer" || !Object.isFrozen(game)) process.exit(1);
'
node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  const pkg = JSON.parse(await readFile("node_modules/@e308/ux/package.json", "utf8"));
  if (pkg.dependencies?.["@e308/core"] !== "0.0.0") process.exit(1);
'
