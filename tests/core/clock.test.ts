import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { planAdvance } from "../../packages/core/src/index.js";

describe("fixed-step clock", () => {
  it("preserves incomplete time and advances only whole quanta", () => {
    expect(planAdvance({ gameTimeMs: 100, remainderMs: 20 }, 135, 50)).toEqual({
      gameTimeMs: 250,
      remainderMs: 5,
      steps: 3,
    });
  });

  it("is invariant to elapsed-time partitioning", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 30 }),
        (parts) => {
          const whole = planAdvance(
            { gameTimeMs: 0, remainderMs: 0 },
            parts.reduce((a, b) => a + b),
            50,
          );
          const partitioned = parts.reduce(
            (state, elapsedMs) => planAdvance(state, elapsedMs, 50),
            { gameTimeMs: 0, remainderMs: 0, steps: 0 },
          );
          expect(partitioned.gameTimeMs).toBe(whole.gameTimeMs);
          expect(partitioned.remainderMs).toBe(whole.remainderMs);
        },
      ),
    );
  });

  it.each([
    [{ gameTimeMs: -1, remainderMs: 0 }, 1, 50],
    [{ gameTimeMs: 0, remainderMs: -1 }, 1, 50],
    [{ gameTimeMs: 0, remainderMs: 0 }, -1, 50],
    [{ gameTimeMs: 0, remainderMs: 0 }, 1, 0],
    [{ gameTimeMs: 0, remainderMs: 50 }, 1, 50],
  ])("rejects invalid clock input", (state, elapsed, step) => {
    expect(() => planAdvance(state, elapsed, step)).toThrow();
  });

  it("rejects unsafe accumulated and game time", () => {
    expect(() =>
      planAdvance({ gameTimeMs: 0, remainderMs: 49 }, Number.MAX_SAFE_INTEGER, 50),
    ).toThrow(RangeError);
    expect(() =>
      planAdvance({ gameTimeMs: Number.MAX_SAFE_INTEGER, remainderMs: 0 }, 50, 50),
    ).toThrow(RangeError);
  });
});
