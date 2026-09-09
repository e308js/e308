// @vitest-environment happy-dom

import { nativeNumbers } from "@e308/core";
import { createHearth, hearthView } from "@e308/game-hearth";
import { createQuantityFormatter, createTextResolver, mountView } from "@e308/ux";
import { describe, expect, it } from "vitest";

describe("Hearth settlement view", () => {
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
    expect(root.textContent).toContain("Winter will test the current stores");
    const wait = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Advance one minute"),
    );
    wait?.click();
    expect(hearth.getSnapshot().gameTimeMs).toBe(60_000);
    expect(root.querySelector('[data-resource="herbs"]')?.textContent).toBe("herbs: 7");
    mounted.dispose();
    expect(root.childElementCount).toBe(0);
  });
});
