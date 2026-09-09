import { createGameKit, nativeNumbers } from "@e308/core";
import { attachWorkerRuntime, messageEndpoint } from "@e308/core/worker";

const builder = createGameKit({ numbers: nativeNumbers });
const realm = builder.scope("run");
const currency = builder.resource("points", { scope: realm, initial: 0 });
const income = builder.flow("income", {
  scope: realm,
  rate: builder.rates.constant(1),
  produces: [[currency, 1]],
});
const workerDefinition = builder.defineGame({
  id: "browser-fixture",
  simulationVersion: 1,
  stepMs: 100,
  resources: [currency],
  flows: [income],
});
const codec = {
  encodeSnapshot: (snapshot) =>
    JSON.stringify(snapshot, (_key, value) =>
      typeof value === "bigint" ? { e308BigInt: value.toString() } : value,
    ),
  decodeSnapshot: (raw) =>
    JSON.parse(raw, (_key, value) =>
      value && typeof value === "object" && typeof value.e308BigInt === "string"
        ? BigInt(value.e308BigInt)
        : value,
    ),
  decodeIntent: (intent) => ({
    id: "add",
    execute: (transaction) => transaction.add(currency, intent.amount),
  }),
};

attachWorkerRuntime({
  definition: workerDefinition,
  codec,
  endpoint: messageEndpoint(self),
  yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
});
