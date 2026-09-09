// @vitest-environment happy-dom

import { nativeNumbers } from "../../packages/core/src/index.js";
import {
  actionFromQuote,
  appendDescription,
  blockerFromFailure,
  createQuantityFormatter,
  createTextResolver,
  formatDuration,
  formatEncoded,
  formatEta,
  fromSelectableSource,
  isAllowedLink,
  selectSource,
} from "../../packages/ux/src/index.js";

describe("quantity and time formatting", () => {
  it("formats plain, scientific, engineering, zero, and signed quantities", () => {
    expect(formatEncoded("12345678", { notation: "scientific", significantDigits: 4 })).toBe(
      "1.235e+7",
    );
    expect(formatEncoded("-0.001234", { notation: "engineering", significantDigits: 3 })).toBe(
      "-1.23e-3",
    );
    expect(formatEncoded("0", { notation: "scientific" })).toBe("0e+0");
    expect(formatEncoded("custom", { notation: "scientific" })).toBe("custom");
    expect(formatEncoded("12", { notation: "plain" })).toBe("12");
    expect(() => formatEncoded("1", { significantDigits: 0 })).toThrow(/significantDigits/);
  });

  it("uses adapter codecs and named formats", () => {
    const formatter = createQuantityFormatter(nativeNumbers, {
      compact: { notation: "scientific", significantDigits: 2 },
    });
    expect(formatter.format(1e7)).toBe("1e+7");
    expect(formatter.format(1e7, "compact")).toBe("1e+7");
    expect(() => formatter.format(1, "missing")).toThrow(/unknown/);
    expect(() => formatter.format(Number.NaN)).toThrow(/non-finite/);
  });

  it.each([
    [0, "0ms"],
    [999, "999ms"],
    [1_500, "1.5s"],
    [70_000, "1.2m"],
    [7_200_000, "2h"],
    [172_800_000, "2d"],
  ])("formats %i milliseconds", (value, expected) => {
    expect(formatDuration(value)).toBe(expected);
  });

  it("formats every ETA tag", () => {
    expect(formatEta({ kind: "finite", ms: 1_000, clock: "game" })).toBe("1s game");
    expect(formatEta({ kind: "blocked", reason: "need wood" })).toBe("need wood");
    expect(formatEta({ kind: "blocked", reason: { key: "locked" } })).toBe("locked");
    expect(
      formatEta({ kind: "capacity-unreachable", assumptions: [], proofScope: "current caps" }),
    ).toBe("unreachable (current caps)");
    expect(formatEta({ kind: "unknown" })).toBe("unknown");
    expect(() => formatDuration(-1)).toThrow(/duration/);
  });
});

describe("localization", () => {
  const resolver = createTextResolver({
    quantities: createQuantityFormatter(nativeNumbers),
    messages: { gain: "Gain {amount} in {time}", hello: "Hello" },
  });

  it("validates and renders named message arguments", () => {
    expect(
      resolver.text({
        key: "gain",
        args: {
          amount: { kind: "quantity", value: 12 },
          time: { kind: "duration", ms: 1_000, clock: "game" },
        },
      }),
    ).toBe("Gain 12 in 1s");
    expect(resolver.argument(true)).toBe("true");
    expect(resolver.text({ key: "missing" })).toBe("missing");
    expect(() => resolver.text({ key: "gain", args: { amount: 1 } })).toThrow(/missing argument/);
    expect(() => resolver.text({ key: "hello", args: { extra: 1 } })).toThrow(/unexpected/);
    const strict = createTextResolver({
      quantities: createQuantityFormatter(nativeNumbers),
      missing: "error",
    });
    expect(() => strict.text({ key: "absent" })).toThrow(/missing message/);
  });

  it("builds safe rich descriptions", () => {
    const parent = document.createElement("p");
    appendDescription(
      parent,
      [
        { kind: "text", value: "A " },
        { kind: "strong", children: [{ kind: "message", token: { key: "hello" } }] },
        { kind: "emphasis", children: [{ kind: "code", value: "x" }] },
        { kind: "break" },
        { kind: "link", href: "/guide", children: [{ kind: "text", value: "guide" }] },
      ],
      resolver,
    );
    expect(parent.textContent).toBe("A Helloxguide");
    expect(parent.querySelector("a")?.getAttribute("href")).toBe("/guide");
    expect(isAllowedLink("https://example.com")).toBe(true);
    expect(isAllowedLink("javascript:alert(1)")).toBe(false);
    expect(() =>
      appendDescription(parent, [{ kind: "link", href: "javascript:bad", children: [] }], resolver),
    ).toThrow(/unsupported/);
  });
});

describe("view projections and generic sources", () => {
  it("maps every core failure without formatting its quantities", () => {
    const failure = blockerFromFailure({
      code: "insufficient",
      resourceId: "wood",
      required: 3,
      available: 2,
    });
    expect(failure).toEqual({
      kind: "insufficient",
      resourceId: "wood",
      required: 3,
      available: 2,
    });
    expect(
      actionFromQuote({
        id: "buy",
        revision: 1n,
        intent: { type: "buy", revision: 1n },
        label: "Buy",
        result: { ok: false, error: { code: "locked", prerequisiteIds: ["saw"] } },
      }),
    ).toMatchObject({ enabled: false, blockers: [{ kind: "locked" }] });
    expect(
      actionFromQuote({
        id: "buy",
        revision: 1n,
        intent: "buy",
        label: "Buy",
        costs: [],
        rewards: [],
        result: { ok: true, value: undefined },
      }),
    ).toMatchObject({ enabled: true, blockers: [], costs: [], rewards: [] });
  });

  it("adapts selector subscriptions and filters selected equality", () => {
    interface SmallState {
      value: number;
      noise: number;
    }
    let state: SmallState = { value: 1, noise: 0 };
    let selectedListener: ((state: SmallState) => void) | undefined;
    const selectable = {
      getSnapshot: () => state,
      subscribe: <Value>(
        selector: (snapshot: SmallState) => Value,
        listener: (value: Value) => void,
      ) => {
        selectedListener = (snapshot) => listener(selector(snapshot));
        return () => {
          selectedListener = undefined;
        };
      },
      dispatch: (intent: string) => intent,
    };
    const source = fromSelectableSource(selectable);
    const seen: number[] = [];
    const stop = selectSource(
      source,
      (snapshot) => snapshot.value,
      (value) => seen.push(value),
    );
    state = { value: 1, noise: 1 };
    selectedListener?.(state);
    state = { value: 2, noise: 1 };
    selectedListener?.(state);
    expect(seen).toEqual([2]);
    expect(source.dispatch("go")).toBe("go");
    stop();
    expect(selectedListener).toBeUndefined();
  });
});
