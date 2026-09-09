import { describe, expect, it } from "vitest";
import { allocationCommand, upgradeCommand } from "../../packages/core/src/index.js";
import {
  industryLedger,
  manufactureLedger,
  saleLedger,
} from "../../reference/paperclips/oracles.js";
import { createWireworks, saleCommand } from "../../reference/paperclips/wireworks.js";

describe("Universal Paperclips to Wireworks mapping", () => {
  it("PC01 keeps manufacturing inventory separate from market revenue", () => {
    const model = createWireworks();
    const expectedProduction = manufactureLedger(20, 0, 4, 1);
    model.game.advance(1_000);
    expect(model.game.getSnapshot().resources).toMatchObject({
      wire: expectedProduction.wire,
      inventory: expectedProduction.inventory,
      cash: 100,
    });
    const expectedSale = saleLedger(expectedProduction.inventory, 100, 3, 2);
    expect(model.game.dispatch(saleCommand(model)).ok).toBe(true);
    expect(model.game.getSnapshot().resources).toMatchObject({
      inventory: expectedSale.inventory,
      cash: expectedSale.cash,
    });
    model.game.dispatch({
      id: "market-policy",
      execute: (tx) => {
        tx.set(model.resources.price, 5);
        tx.set(model.resources.demand, 1);
      },
    });
    expect(model.game.dispatch(saleCommand(model)).ok).toBe(true);
    expect(model.game.getSnapshot().resources.cash).toBe(expectedSale.cash + 5);
  });

  it("PC02 constrains industrial conversion by both matter and allocated power", () => {
    const model = createWireworks();
    model.game.dispatch(upgradeCommand(model.project));
    model.game.dispatch(allocationCommand(model.grid, "extruder", 2));
    const first = industryLedger(5, 0, 2);
    model.game.advance(1_000);
    expect(model.game.getSnapshot().resources).toMatchObject({
      matter: first.matter,
      "industrial-wire": first.wire,
    });
    const second = industryLedger(first.matter, first.wire, 2);
    model.game.advance(1_000);
    expect(model.game.getSnapshot().resources).toMatchObject({
      matter: second.matter,
      "industrial-wire": second.wire,
    });
  });

  it("PC03 makes the project once-only and switches active economy controls", () => {
    const model = createWireworks();
    expect(model.game.dispatch(upgradeCommand(model.project)).ok).toBe(true);
    const afterProject = model.game.getSnapshot();
    expect(afterProject.progression.events).toContainEqual({
      sequence: 1n,
      kind: "upgrade",
      id: "industrialize",
      atGameMs: 0,
    });
    expect(model.game.dispatch(upgradeCommand(model.project))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "scope-inactive" },
    });
    model.game.advance(1_000);
    expect(model.game.getSnapshot().resources).toMatchObject({ wire: 20, inventory: 0 });
    expect(model.game.dispatch(saleCommand(model))).toMatchObject({ ok: false });
    expect(model.game.dispatch(allocationCommand(model.grid, "extruder", 1)).ok).toBe(true);
  });
});
