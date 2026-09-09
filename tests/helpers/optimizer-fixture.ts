import {
  createGame,
  createGameKit,
  nativeNumbers,
  type Transaction,
} from "../../packages/core/src/index.js";

export function createChainFixture(options: {
  readonly initial?: readonly [number, number, number];
  readonly baseRate?: number;
  readonly automation?: boolean;
}) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const [a0, b0, c0] = options.initial ?? [1, 0, 0];
  const a = kit.resource("a", { scope: run, initial: a0 });
  const b = kit.resource("b", { scope: run, initial: b0 });
  const c = kit.resource("c", { scope: run, initial: c0 });
  const source = kit.flow("source", {
    scope: run,
    rate: kit.rates.constant(options.baseRate ?? 1),
    produces: [[a, 1]],
  });
  const middle = kit.flow("middle", {
    scope: run,
    rate: kit.rates.proportional(a, 2),
    produces: [[b, 1]],
  });
  const product = kit.flow("product", {
    scope: run,
    rate: kit.rates.product(kit.rates.constant(1), kit.rates.proportional(b, 1)),
    produces: [[c, 1]],
  });
  const automation = options.automation
    ? [
        kit.automation("pulse", {
          scope: run,
          cadenceMs: 5_000,
          initiallyEnabled: true,
          priority: 0,
          unlocked: () => true,
          condition: () => true,
          action: () => ({
            id: "pulse",
            execute: (transaction: Transaction<number>) => transaction.set(a, 0),
          }),
        }),
      ]
    : [];
  const definition = kit.defineGame({
    id: options.automation ? "automated-chain" : "chain",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [a, b, c],
    flows: [source, middle, product],
    automation,
  });
  return { definition, create: () => createGame(definition), resources: { a, b, c } };
}

export const generousLimits = { maximumWork: 10_000, maximumBulkBatches: 100 } as const;
