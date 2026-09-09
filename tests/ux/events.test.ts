// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { bindEvent, refreshEvents } from "../../packages/ux/src/dom/events.js";

describe("reconciled DOM events", () => {
  it("refreshes callbacks and removes handlers that leave a keyed control", () => {
    const current = document.createElement("button");
    const next = document.createElement("button");
    const oldClick = vi.fn();
    const newClick = vi.fn();
    const oldHover = vi.fn();
    bindEvent(current, "click", oldClick);
    bindEvent(current, "mouseenter", oldHover);
    bindEvent(next, "click", newClick);

    refreshEvents(current, next);
    current.click();
    current.dispatchEvent(new Event("mouseenter"));

    expect(oldClick).not.toHaveBeenCalled();
    expect(newClick).toHaveBeenCalledOnce();
    expect(oldHover).not.toHaveBeenCalled();
  });

  it("adds a new handler and clears all handlers from a retained element", () => {
    const current = document.createElement("button");
    const next = document.createElement("button");
    const click = vi.fn();
    bindEvent(next, "click", click);

    refreshEvents(current, next);
    current.click();
    expect(click).toHaveBeenCalledOnce();

    refreshEvents(current, document.createElement("button"));
    current.click();
    expect(click).toHaveBeenCalledOnce();

    refreshEvents(document.createElement("button"), document.createElement("button"));
  });
});
