import { describe, expect, it } from "vitest";
import { createGameKit, nativeNumbers, resolveModules } from "../../packages/core/src/index.js";
import { compareModuleIds } from "../../packages/core/src/model/modules.js";

describe("game kit", () => {
  it("captures the numeric type and freezes owned definitions", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const clips = kit.resource("factory/clips", { scope: run, initial: kit.q("1") });
    const definition = kit.defineGame({
      id: "wireworks",
      simulationVersion: 1,
      stepMs: 50,
      resources: [clips],
    });
    expect(definition.resources).toEqual([clips]);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.resources)).toBe(true);
  });

  it("rejects invalid and cross-kit handles", () => {
    const first = createGameKit({ numbers: nativeNumbers });
    const second = createGameKit({ numbers: nativeNumbers });
    expect(() => first.scope("Bad Scope")).toThrow("Invalid scope id");
    expect(() => first.resource("bad", { scope: second.scope("run"), initial: 0 })).toThrow(
      "another game kit",
    );
    expect(() => first.resource("bad", { scope: first.scope("run"), initial: Number.NaN })).toThrow(
      "must be finite",
    );
    const other = second.resource("other/value", { scope: second.scope("other"), initial: 0 });
    expect(() =>
      first.defineGame({ id: "bad", simulationVersion: 1, stepMs: 50, resources: [other] }),
    ).toThrow("another game kit");
  });

  it("rejects duplicate resource IDs", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const scope = kit.scope("run");
    const first = kit.resource("value", { scope, initial: 0 });
    const second = kit.resource("value", { scope, initial: 1 });
    expect(() =>
      kit.defineGame({ id: "bad", simulationVersion: 1, stepMs: 50, resources: [first, second] }),
    ).toThrow("Duplicate resource id");
  });
});

describe("module resolution", () => {
  it("uses exact code-unit ID ordering", () => {
    expect(compareModuleIds({ id: "a" }, { id: "b" })).toBe(-1);
    expect(compareModuleIds({ id: "b" }, { id: "a" })).toBe(1);
    expect(compareModuleIds({ id: "a" }, { id: "a" })).toBe(0);
  });

  it("orders dependencies deterministically", () => {
    const modules = resolveModules([
      {
        id: "story",
        version: "1.0.0",
        requires: [
          { id: "research", range: "1.x" },
          { id: "factory", range: "^1.0.0" },
        ],
      },
      { id: "factory", version: "1.2.0" },
      { id: "automation", version: "1.0.0", requires: [{ id: "factory", range: ">=1" }] },
      { id: "research", version: "1.0.0" },
    ]);
    expect(modules.map((module) => module.id)).toEqual([
      "factory",
      "automation",
      "research",
      "story",
    ]);
    expect(Object.isFrozen(modules)).toBe(true);
    expect(Object.isFrozen(modules[0])).toBe(true);
  });

  it("rejects duplicate, missing, and cyclic dependencies", () => {
    expect(() =>
      resolveModules([
        { id: "a", version: "1.0.0" },
        { id: "a", version: "2.0.0" },
      ]),
    ).toThrow("Duplicate module id");
    expect(() =>
      resolveModules([{ id: "a", version: "1.0.0", requires: [{ id: "missing", range: "*" }] }]),
    ).toThrow("Missing module dependency");
    expect(() =>
      resolveModules([
        { id: "a", version: "1.0.0", requires: [{ id: "b", range: "*" }] },
        { id: "b", version: "1.0.0", requires: [{ id: "a", range: "*" }] },
      ]),
    ).toThrow("dependency cycle");
  });

  it("rejects invalid and unsatisfied versions", () => {
    expect(() => resolveModules([{ id: "a", version: "latest" }])).toThrow(
      "Invalid module version",
    );
    expect(() =>
      resolveModules([
        { id: "a", version: "1.0.0", requires: [{ id: "b", range: "nope" }] },
        { id: "b", version: "1.0.0" },
      ]),
    ).toThrow("Invalid dependency range");
    expect(() =>
      resolveModules([
        { id: "a", version: "1.0.0", requires: [{ id: "b", range: "^2.0.0" }] },
        { id: "b", version: "1.0.0" },
      ]),
    ).toThrow("requires b@^2.0.0");
  });
});
