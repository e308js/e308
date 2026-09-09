import { describe, expect, it } from "vitest";
import {
  createCascadeKernel,
  createHearthKernel,
  createWireworksKernel,
} from "../helpers/kernels.js";

describe("S02 headless game kernels", () => {
  it("runs Wireworks as an input- and power-constrained factory", () => {
    const { game } = createWireworksKernel();
    const trace = [game.getSnapshot().resources];
    game.advance(1000);
    trace.push(game.getSnapshot().resources);
    game.advance(1000);
    trace.push(game.getSnapshot().resources);
    expect(trace).toEqual([
      { matter: 5, power: 2, wire: 0 },
      { matter: 1, power: 2, wire: 12 },
      { matter: 0, power: 2, wire: 15 },
    ]);
  });

  it("runs Cascade as a delayed producer chain", () => {
    const { game } = createCascadeKernel();
    const trace: number[] = [];
    for (let step = 0; step < 4; step += 1) {
      trace.push(game.getSnapshot().resources.currency ?? Number.NaN);
      game.advance(1000);
    }
    expect(trace).toEqual([0, 0, 1, 3]);
  });

  it("runs Hearth as allocated gathering followed by an atomic recipe", () => {
    const { game, cook } = createHearthKernel();
    game.advance(3000);
    expect(cook(3).ok).toBe(true);
    expect(game.getSnapshot().resources).toEqual({ workers: 3, food: 0, wood: 1, meals: 3 });
  });
});
