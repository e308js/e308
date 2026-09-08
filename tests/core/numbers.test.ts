import { describe, expect, it } from "vitest";
import {
  eternityNumbers,
  type NumericAdapter,
  NumericFault,
  nativeNumbers,
} from "../../packages/core/src/index.js";

function adapterContract<N>(name: string, numbers: NumericAdapter<N>): void {
  describe(`${name} numeric adapter`, () => {
    it("performs arithmetic and canonical codec round trips", () => {
      const two = numbers.fromString("2");
      const transcendental = numbers.transcendental;
      if (!transcendental) throw new Error("test adapter must provide powers");
      expect(
        Number(numbers.codec.serialize(transcendental.pow(two, numbers.fromString("3")))),
      ).toBeCloseTo(8);
      expect(numbers.codec.serialize(numbers.add(two, two))).toBe("4");
      expect(numbers.codec.serialize(numbers.sub(two, numbers.fromString("3")))).toBe("-1");
      expect(numbers.codec.serialize(numbers.mul(two, numbers.fromString("2.5")))).toBe("5");
      expect(numbers.codec.serialize(numbers.div(two, numbers.fromString("4")))).toBe("0.5");
      expect(numbers.cmp(two, numbers.fromString("2"))).toBe(0);
      expect(numbers.cmp(two, numbers.fromString("3"))).toBe(-1);
      expect(numbers.cmp(two, numbers.fromString("1"))).toBe(1);
      expect(numbers.codec.serialize(numbers.floor(numbers.fromString("2.9")))).toBe("2");
      expect(numbers.codec.serialize(numbers.codec.parse(numbers.codec.serialize(two)))).toBe("2");
    });

    it("provides logarithms", () => {
      const transcendental = numbers.transcendental;
      if (!transcendental) throw new Error("test adapter must provide logarithms");
      const result = transcendental.log(numbers.fromString("8"), numbers.fromString("2"));
      expect(Number(numbers.codec.serialize(result))).toBeCloseTo(3);
    });
  });
}

adapterContract("native", nativeNumbers);
adapterContract("eternity", eternityNumbers);

describe("native numeric validation", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects non-finite input", (value) => {
    expect(() => nativeNumbers.fromNumber(value)).toThrow(NumericFault);
  });

  it.each([" 1", "0x10", "", "Infinity"])("rejects non-decimal encoding %s", (value) => {
    expect(() => nativeNumbers.fromString(value)).toThrow(NumericFault);
  });

  it("rejects non-finite operation output", () => {
    expect(() => nativeNumbers.div(1, 0)).toThrow(NumericFault);
  });
});

describe("break-eternity adapter", () => {
  it("represents values beyond native floating point", () => {
    const huge = eternityNumbers.fromString("1e1000");
    expect(eternityNumbers.cmp(huge, eternityNumbers.fromString("1e999"))).toBe(1);
    expect(Object.isFrozen(huge)).toBe(true);
  });

  it("rejects malformed, non-finite, and foreign values", () => {
    expect(() => eternityNumbers.fromString(" ")).toThrow(NumericFault);
    expect(() => eternityNumbers.fromString("NaN")).toThrow(NumericFault);
    expect(eternityNumbers.isFinite({} as never)).toBe(false);
    expect(() => eternityNumbers.codec.serialize({} as never)).toThrow(NumericFault);
  });
});
