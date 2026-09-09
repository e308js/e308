import { owned } from "../model/handles.js";
import { assertOwner, freezeEntries, validId } from "../model/validation.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { TaskDefinition } from "./types.js";

export type TaskOptions<N> = Omit<TaskDefinition<N>, "id">;

export function createTask<N>(
  id: string,
  options: TaskOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): TaskDefinition<N> {
  validId(id, "task");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  if (!Number.isSafeInteger(options.queueLimit) || options.queueLimit < 1)
    throw new TypeError(`Task ${id} queue limit must be a positive safe integer`);
  if (options.work.kind === "fixed-duration") {
    if (!Number.isSafeInteger(options.work.durationMs) || options.work.durationMs < 1)
      throw new TypeError(`Task ${id} duration must be a positive safe integer`);
  } else if (!Number.isFinite(options.work.work) || options.work.work <= 0) {
    throw new TypeError(`Task ${id} work must be positive and finite`);
  }
  const inputs = freezeEntries(options.inputs, owner, numbers, id);
  const outputs = freezeEntries(options.outputs, owner, numbers, id);
  if (outputs.length === 0) throw new TypeError(`Task ${id} must produce at least one resource`);
  if (options.cancellation.refund === "fraction") {
    const ratio = options.cancellation.ratio;
    if (
      !numbers.isFinite(ratio) ||
      numbers.cmp(ratio, numbers.fromNumber(0)) < 0 ||
      numbers.cmp(ratio, numbers.fromNumber(1)) > 0
    ) {
      throw new TypeError(`Task ${id} refund ratio must be between zero and one`);
    }
  }
  return owned({ ...options, id, inputs, outputs }, owner);
}
