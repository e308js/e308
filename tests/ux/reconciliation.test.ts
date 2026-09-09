// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { nativeNumbers } from "../../packages/core/src/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
  type ViewSource,
} from "../../packages/ux/src/index.js";

type Intent = { readonly type: string; readonly value: number };
type State = { readonly points: number; readonly allocation: number };

class Source implements ViewSource<State, Intent, void> {
  state: State = { points: 12, allocation: 2 };
  readonly intents: Intent[] = [];
  readonly listeners = new Set<(state: State) => void>();

  getSnapshot(): State {
    return this.state;
  }

  subscribe(listener: (state: State) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(intent: Intent): void {
    this.intents.push(intent);
  }

  emit(state: State): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });

function project(state: State): ViewDocument<Intent, number> {
  return {
    content: [
      { kind: "heading", id: "live-heading", level: 2, text: `Points ${state.points}` },
      {
        kind: "action",
        id: "live-action",
        action: {
          id: "live",
          label: "live",
          enabled: true,
          intent: { type: "live", value: state.points },
          blockers: [],
        },
      },
      {
        kind: "range-input",
        id: "allocation",
        label: "Allocation",
        value: state.allocation,
        min: 0,
        max: 10,
        allowedMax: 4,
        step: 1,
        showTicks: true,
        intent: (value) => ({ type: "allocation", value }),
      },
      {
        kind: "range-input",
        id: "unrestricted",
        label: "Unrestricted",
        value: 1,
        min: 0,
        max: 2,
        step: 1,
        intent: (value) => ({ type: "unrestricted", value }),
      },
    ],
  };
}

function input(root: HTMLElement): HTMLInputElement {
  const result = root.querySelector<HTMLInputElement>("[data-e308-key='allocation:control']");
  if (!result) throw new Error("expected allocation input");
  return result;
}

describe("keyed DOM reconciliation", () => {
  it("patches changed values and refreshes behavior on retained controls", async () => {
    const root = document.createElement("main");
    const source = new Source();
    const mounted = mountView(root, { source, project, resolver });
    const heading = root.querySelector("[data-e308-key=live-heading]");
    const button = root.querySelector<HTMLButtonElement>("[data-e308-key=live-action]");
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((changes) => records.push(...changes));
    observer.observe(root, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    source.emit({ points: 99, allocation: 2 });
    await Promise.resolve();

    expect(root.querySelector("[data-e308-key=live-heading]")).toBe(heading);
    expect(root.querySelector("[data-e308-key=live-action]")).toBe(button);
    expect(heading?.textContent).toBe("Points 99");
    expect(records.filter((record) => record.type === "childList")).toHaveLength(0);
    button?.click();
    expect(source.intents.at(-1)).toEqual({ type: "live", value: 99 });
    observer.disconnect();
    mounted.dispose();
  });

  it("retains the rendered tree across updates at a 100 ms game cadence", async () => {
    const root = document.createElement("main");
    const source = new Source();
    const mounted = mountView(root, { source, project, resolver });
    const heading = root.querySelector("[data-e308-key=live-heading]");
    const range = input(root);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((changes) => records.push(...changes));
    observer.observe(root, { childList: true, subtree: true });

    for (let tick = 1; tick <= 100; tick += 1) {
      source.emit({ points: 12 + tick, allocation: tick % 5 });
    }
    await Promise.resolve();

    expect(root.querySelector("[data-e308-key=live-heading]")).toBe(heading);
    expect(input(root)).toBe(range);
    expect(heading?.textContent).toBe("Points 112");
    expect(records).toHaveLength(0);
    observer.disconnect();
    mounted.dispose();
  });

  it("keeps a range gesture mounted, visible, stepped, and bounded", async () => {
    const root = document.createElement("main");
    const source = new Source();
    const mounted = mountView(root, { source, project, resolver });
    const range = input(root);
    expect(range.dataset.allowedMax).toBe("4");
    expect(root.querySelectorAll("datalist option")).toHaveLength(11);
    expect(range.closest("label")?.querySelector("output")?.textContent).toBe("2 of 10");

    range.value = "3";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(range.value).toBe("3");
    range.value = "9";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(range.value).toBe("4");

    range.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    source.emit({ points: 13, allocation: 2 });
    expect(input(root)).toBe(range);
    expect(range.value).toBe("4");
    document.dispatchEvent(new PointerEvent("pointerup"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(range.value).toBe("2");

    range.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    source.emit({ points: 14, allocation: 3 });
    document.dispatchEvent(new PointerEvent("pointercancel"));
    expect(range.value).toBe("3");
    mounted.dispose();
  });
});
