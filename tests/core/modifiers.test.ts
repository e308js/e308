import { describe, expect, it } from "vitest";
import {
  applyModifiers,
  type NumericAdapter,
  nativeNumbers,
} from "../../packages/core/src/index.js";

describe("modifier pipeline", () => {
  it("uses fixed stages and stable priority/ID order with a breakdown", () => {
    const result = applyModifiers(
      2,
      [
        { id: "override", stage: "override", value: 99 },
        { id: "z-add", stage: "add", value: 2, priority: 1 },
        { id: "power", stage: "power", value: 2 },
        { id: "multiply", stage: "multiply", value: 3 },
        { id: "a-add", stage: "add", value: 1, priority: 1 },
      ],
      nativeNumbers,
    );
    expect(result.value).toBe(99);
    expect(result.steps.map((step) => step.id)).toEqual([
      "a-add",
      "z-add",
      "multiply",
      "power",
      "override",
    ]);
    expect(result.steps[2]).toMatchObject({ before: 5, after: 15 });
    expect(Object.isFrozen(result.steps)).toBe(true);
  });

  it("rejects unsupported powers and invalid results", () => {
    const limited: NumericAdapter<number> = { ...nativeNumbers };
    delete (limited as { transcendental?: unknown }).transcendental;
    expect(() => applyModifiers(2, [{ id: "power", stage: "power", value: 2 }], limited)).toThrow(
      "unsupported",
    );
    expect(() =>
      applyModifiers(
        2,
        [{ id: "bad", stage: "multiply", value: Number.POSITIVE_INFINITY }],
        nativeNumbers,
      ),
    ).toThrow();
  });

  it("orders same-stage modifiers by explicit priority and stable IDs", () => {
    const result = applyModifiers(
      0,
      [
        { id: "same", stage: "add", value: 4, priority: 2 },
        { id: "first", stage: "add", value: 1, priority: -1 },
        { id: "same", stage: "add", value: 2, priority: 2 },
      ],
      nativeNumbers,
    );
    expect(result.steps.map((step) => step.value)).toEqual([1, 4, 2]);
    expect(result.value).toBe(7);
  });
});
