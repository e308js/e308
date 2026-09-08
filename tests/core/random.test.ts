import { describe, expect, it } from "vitest";
import {
  deriveRandomState,
  type RandomState,
  RandomStreams,
  Xoshiro128,
} from "../../packages/core/src/index.js";

describe("xoshiro128**", () => {
  it("matches the published transition algorithm from a known state", () => {
    const random = new Xoshiro128({ words: [1, 2, 3, 4], draws: 0n });
    expect([random.nextUint32(), random.nextUint32(), random.nextUint32()]).toEqual([
      11520, 0, 5927040,
    ]);
    expect(random.snapshot()).toEqual({
      words: [25179138, 12295, 540162, 2107404],
      draws: 3n,
    });
  });

  it("restores exactly and generates values in range", () => {
    const original = new Xoshiro128({ words: [9, 8, 7, 6], draws: 4n });
    const state = original.snapshot();
    const restored = new Xoshiro128(state);
    expect(restored.nextUint32()).toBe(original.nextUint32());
    expect(restored.uniform()).toBeGreaterThanOrEqual(0);
    expect(restored.uniform()).toBeLessThan(1);
    expect(restored.bounded(7)).toBeLessThan(7);
  });

  it("derives stable independent named streams without consuming parents", () => {
    const first = deriveRandomState("0123456789abcdef", ["market", "price"]);
    expect(first.words).toEqual([1301102347, 99549513, 732863329, 1028452870]);
    const streams = new RandomStreams("0123456789abcdef");
    expect(streams.open(["market"]).nextUint32()).not.toBe(streams.open(["weather"]).nextUint32());
    expect(streams.open(["market"])).toBe(streams.open(["market"]));
  });

  it.each([
    [{ words: [0, 0, 0, 0], draws: 0n }],
    [{ words: [1, 2, 3] as never, draws: 0n }],
    [{ words: [1, 2, 3, 4], draws: -1n }],
  ])("rejects invalid state", (state) => {
    expect(() => new Xoshiro128(state as unknown as RandomState)).toThrow(TypeError);
  });

  it.each([0, -1, 0x1_0000_0001, 1.5])("rejects invalid bound %s", (bound) => {
    const random = new Xoshiro128({ words: [1, 2, 3, 4], draws: 0n });
    expect(() => random.bounded(bound)).toThrow(TypeError);
  });

  it("rejects invalid seed paths", () => {
    expect(() => deriveRandomState("ABC", ["path"])).toThrow(TypeError);
    expect(() => deriveRandomState("00", [""])).toThrow(TypeError);
  });
});
