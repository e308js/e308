import type { Snapshot, Transaction } from "@e308/core";
import { createGame, createGameKit, nativeNumbers } from "@e308/core";
import type { TransferValue, WorkerTransferCodec } from "@e308/core/worker";

export type FixtureIntent = { readonly kind: "add"; readonly amount: number };

export function fixtureGame() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const flow = kit.flow("income", {
    scope: run,
    rate: kit.rates.constant(1),
    produces: [[points, 1]],
  });
  const definition = kit.defineGame({
    id: "browser-fixture",
    simulationVersion: 1,
    stepMs: 100,
    resources: [points],
    flows: [flow],
  });
  const game = createGame(definition);
  const command = (amount: number) => ({
    id: "add",
    execute: (transaction: Transaction<number>) => transaction.add(points, amount),
  });
  const transfer: WorkerTransferCodec<number, FixtureIntent, string> = {
    encodeSnapshot,
    decodeSnapshot,
    decodeIntent: (intent) => command(intent.amount),
  };
  return { definition, game, points, command, transfer };
}

function encodeSnapshot(snapshot: Snapshot<number>): string {
  return JSON.stringify(snapshot, (_key, value: TransferValue | bigint) =>
    typeof value === "bigint" ? { e308BigInt: value.toString() } : value,
  );
}

function decodeSnapshot(raw: string): Snapshot<number> {
  return JSON.parse(raw, (_key, value: unknown) => {
    if (
      typeof value === "object" &&
      value !== null &&
      "e308BigInt" in value &&
      typeof value.e308BigInt === "string"
    )
      return BigInt(value.e308BigInt);
    return value;
  }) as Snapshot<number>;
}
