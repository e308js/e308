// @vitest-environment happy-dom

import {
  type Command,
  createGame,
  createGameKit,
  nativeNumbers,
  type Result,
} from "../../packages/core/src/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  fromSelectableSource,
  mountView,
} from "../../packages/ux/src/index.js";

it("dispatches the exact revision-bound intent and survives repeated mount cycles", () => {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const game = createGame(
    kit.defineGame({ id: "ux-stale", simulationVersion: 1, stepMs: 50, resources: [points] }),
  );
  const stale: Command<number> = {
    id: "stale-add",
    expectedRevision: 0n,
    execute: (transaction) => transaction.add(points, 1),
  };
  expect(game.advance(50).ok).toBe(true);
  const source = fromSelectableSource(game);
  const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });
  const results: unknown[] = [];
  const root = document.createElement("main");
  const options = {
    source,
    resolver,
    project: () => ({
      content: [
        {
          kind: "action" as const,
          id: "stale",
          action: {
            id: "stale",
            label: "Stale",
            enabled: true,
            blockers: [],
            intent: stale,
          },
        },
      ],
    }),
    onDispatchResult: (result: unknown) => results.push(result),
  };
  const first = mountView(root, options);
  root.querySelector<HTMLButtonElement>("button")?.click();
  first.dispose();
  const second = mountView(root, options);
  root.querySelector<HTMLButtonElement>("button")?.click();
  second.dispose();

  expect(results).toHaveLength(2);
  for (const result of results as Result<unknown, { code: string }>[]) {
    expect(result).toMatchObject({ ok: false, error: { code: "stale-revision" } });
  }
  expect(game.getSnapshot().resources.points).toBe(0);
});
