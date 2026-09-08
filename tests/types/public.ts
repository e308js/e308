import {
  createGameKit,
  eternityNumbers,
  type NumericAdapter,
  nativeNumbers,
  type Resource,
} from "@e308/core";
import type { ActionView } from "@e308/ux";

const kit = createGameKit({ numbers: nativeNumbers });
const run = kit.scope("run");
const value = kit.resource("value", { scope: run, initial: kit.q("1") });
const numberResource: Resource<number> = value;
const adapter: NumericAdapter<number> = kit.numbers;
kit.defineGame({ id: "types", simulationVersion: 1, stepMs: 50, resources: [numberResource] });

const hugeKit = createGameKit({ numbers: eternityNumbers });
const huge = hugeKit.resource("huge", {
  scope: hugeKit.scope("run"),
  initial: hugeKit.q("1e1000"),
});
// @ts-expect-error numeric backends cannot be mixed in a definition
kit.defineGame({ id: "mixed", simulationVersion: 1, stepMs: 50, resources: [huge] });

const action = {
  id: "buy",
  label: "Buy",
  enabled: false,
  blockers: [{ kind: "locked" }],
} as const satisfies ActionView;

void adapter;
void action;
