// @vitest-environment happy-dom

import { nativeNumbers } from "@e308/core";
import { createHearth, hearthResources, hearthView } from "@e308/game-hearth";
import { createQuantityFormatter, createTextResolver, mountView } from "@e308/ux";
import { describe, expect, it } from "vitest";
import {
  recipeDescription,
  researchDescription,
  taskDescription,
} from "../../games/hearth/src/view-copy.js";

describe("Hearth settlement view", () => {
  it("explains the economy effects attached to player actions", () => {
    expect(recipeDescription("cottage")).toContain("adds one worker");
    expect(recipeDescription("preserves")).toContain("winter food use");
    expect(researchDescription("crop-rotation")).toContain("50%");
    expect(researchDescription("unknown")).toBe("Settlement research");
    expect(taskDescription("expedition")).toContain("8 herbs");
    expect(taskDescription("hall")).toContain("completes the settlement");
  });

  it("renders the accessible custom seasonal ledger and dispatches controls", () => {
    const root = document.createElement("main");
    document.body.append(root);
    const hearth = createHearth();
    const mounted = mountView(root, {
      source: hearth,
      project: hearthView,
      resolver: createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) }),
    });
    expect(root.querySelector('table[aria-label="Seasonal production ledger"]')).not.toBeNull();
    expect(root.textContent).toContain("Goal: guide the settlement through its first winter");
    expect(root.textContent).toContain("Winter will test the current stores");
    const miner = root.querySelector<HTMLInputElement>("[data-e308-key='job-miner:control']");
    expect(miner?.max).toBe("4");
    expect(miner?.dataset.allowedMax).toBe("1");
    (root.querySelector("[data-tab=projects]") as HTMLButtonElement).click();
    const hall = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("raise great hall"),
    );
    expect(hall?.disabled).toBe(true);
    expect(root.textContent).toContain("wood: need 30, have 10");
    hearth.game.dispatch({
      id: "expedition-view-fixture",
      execute(transaction) {
        transaction.set(hearthResources.meals, 1);
        transaction.set(hearthResources.tools, 1);
      },
    });
    expect(hearth.dispatch({ type: "task", task: "expedition" }).ok).toBe(true);
    expect(root.textContent).toContain("60 seconds remaining");
    hearth.dispatch({ type: "advance", milliseconds: 1_000 });
    expect(root.textContent).toContain("59 seconds remaining");
    const wait = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Advance one minute"),
    );
    wait?.click();
    expect(hearth.getSnapshot().gameTimeMs).toBe(61_000);
    expect(root.querySelector('[data-resource="herbs"]')?.textContent).toBe("herbs: 15");
    mounted.dispose();
    expect(root.childElementCount).toBe(0);
  });
});
