// @vitest-environment happy-dom

import { nativeNumbers } from "../../packages/core/src/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
  type ViewNode,
  type ViewSource,
} from "../../packages/ux/src/index.js";

type Intent = { readonly type: string; readonly value?: unknown };
interface State {
  readonly points: number;
  readonly name: string;
  readonly claimed: boolean;
}

class Source implements ViewSource<State, Intent, string> {
  state: State = { points: 12, name: "Ada", claimed: false };
  readonly intents: Intent[] = [];
  readonly listeners = new Set<(state: State) => void>();

  getSnapshot(): State {
    return this.state;
  }

  subscribe(listener: (state: State) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(intent: Intent): string {
    this.intents.push(intent);
    return intent.type;
  }

  emit(state: State): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

const resolver = createTextResolver({
  quantities: createQuantityFormatter(nativeNumbers),
  messages: { title: "Gallery {name}" },
});

function required<ElementType extends Element>(element: ElementType | null): ElementType {
  if (!element) throw new Error("expected rendered element");
  return element;
}

function action(type: string, enabled = true) {
  return {
    id: type,
    label: type,
    enabled,
    intent: { type },
    blockers: enabled ? [] : [{ kind: "locked" as const, prerequisiteIds: ["known"] }],
  };
}

function gallery(state: State): ViewDocument<Intent, number> {
  const all: ViewNode<Intent, number>[] = [
    {
      kind: "heading",
      id: "heading",
      level: 1,
      text: { key: "title", args: { name: state.name } },
    },
    {
      kind: "description",
      id: "description",
      content: [
        { kind: "text", value: "Headless " },
        { kind: "strong", children: [{ kind: "text", value: "state" }] },
      ],
    },
    { kind: "separator", id: "line" },
    { kind: "image", id: "image", src: "/pixel.png", alt: "pixel", style: { width: "1px" } },
    {
      kind: "resource",
      id: "points",
      resource: {
        resourceId: "points",
        label: "Points",
        value: state.points,
        rate: 2,
        capacity: 100,
      },
    },
    { kind: "quantities", id: "costs", lines: [{ resourceId: "points", label: "Cost", value: 3 }] },
    {
      kind: "action",
      id: "gain",
      action: {
        ...action("gain"),
        description: [{ kind: "text", value: "Gain points" }],
        confirm: "Continue?",
      },
      mark: { label: "new", tone: "positive" },
    },
    { kind: "action", id: "locked", action: action("locked", false) },
    { kind: "progress", id: "right", label: "Right", value: 2, direction: "right", animated: true },
    { kind: "progress", id: "left", label: "Left", value: -1, direction: "left" },
    { kind: "progress", id: "up", label: "Up", value: 0.5, direction: "up" },
    { kind: "progress", id: "down", label: "Down", value: 0.5, direction: "down" },
    {
      kind: "infobox",
      id: "help",
      title: "Help",
      initiallyOpen: true,
      content: [
        { kind: "description", id: "help-body", content: [{ kind: "text", value: "Body" }] },
      ],
    },
    {
      kind: "tabs",
      id: "tabs",
      activeId: "one",
      tabs: [
        {
          id: "one",
          label: "One",
          content: [{ kind: "heading", id: "one-title", level: 2, text: "One panel" }],
        },
        {
          id: "two",
          label: "Two",
          content: [
            {
              kind: "tabs",
              id: "nested",
              tabs: [
                {
                  id: "inside",
                  label: "Inside",
                  content: [{ kind: "separator", id: "nested-line" }],
                },
              ],
            },
          ],
        },
        { id: "hidden-tab", label: "Secret", hidden: true, content: [] },
        { id: "disabled-tab", label: "Disabled", disabled: true, content: [] },
      ],
    },
    {
      kind: "tree",
      id: "tree",
      branches: [
        { from: "start", to: "next", dashed: true, width: 3, color: "red" },
        { from: "next", to: "start" },
        { from: "missing", to: "next" },
      ],
      nodes: [
        {
          id: "start",
          label: "Start",
          x: 10,
          y: 20,
          ghost: true,
          side: true,
          imageUrl: "/start.png",
          mark: { label: "!" },
        },
        {
          id: "next",
          label: "Next",
          x: 100,
          y: 100,
          action: action("tree"),
          imageUrl: "/next.png",
          highlight: "prestige",
        },
        { id: "secret-node", label: "Secret", x: 0, y: 0, hidden: true },
      ],
    },
    {
      kind: "grid",
      id: "grid",
      rows: 2,
      columns: 2,
      cells: [
        { id: "cell-a", row: 1, column: 1, label: "A", variant: "round", action: action("cell") },
        { id: "cell-b", row: 1, column: 2, label: "B", mark: { label: "new" } },
        { id: "cell-hidden", row: 2, column: 1, label: "Hidden", hidden: true },
      ],
    },
    {
      kind: "text-input",
      id: "name",
      label: "Name",
      value: state.name,
      intent: (value) => ({ type: "name", value }),
    },
    {
      kind: "range-input",
      id: "range",
      label: "Range",
      value: 2,
      min: 0,
      max: 10,
      step: 1,
      intent: (value) => ({ type: "range", value }),
    },
    {
      kind: "select-input",
      id: "select",
      label: "Select",
      value: "a",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      intent: (value) => ({ type: "select", value }),
    },
    {
      kind: "toggle-input",
      id: "toggle",
      label: "Toggle",
      value: true,
      intent: (value) => ({ type: "toggle", value }),
    },
    { kind: "notification", id: "notice", text: "Ready", tone: "positive" },
    {
      kind: "particles",
      id: "particles",
      particles: [
        {
          id: "star",
          label: "Star",
          x: 1,
          y: 2,
          size: 10,
          lifetimeMs: 1_000,
          fade: true,
          intent: { type: "claim" },
          hoverIntent: { type: "hover" },
          leaveIntent: { type: "leave" },
          claimId: "star-claim",
          claimed: state.claimed,
        },
      ],
    },
    {
      kind: "reset",
      id: "reset-view",
      action: action("reset"),
      gain: [{ resourceId: "rank", label: "Rank", value: 1 }],
      clears: ["Points"],
      retains: ["Achievements"],
    },
    {
      kind: "offline",
      id: "offline-view",
      elapsedMs: 1_000,
      processedMs: 800,
      pendingMs: 100,
      discardedMs: 100,
      gains: [{ resourceId: "points", label: "Points", value: 8 }],
      policyLabel: "Canonical catch-up",
    },
    {
      kind: "save",
      id: "save-view",
      status: "saved",
      lastSavedAtMs: 500,
      message: "Saved",
      save: action("save"),
      export: action("export"),
      import: action("import"),
      wipe: action("wipe"),
    },
    {
      kind: "stack",
      id: "hidden-content",
      hidden: true,
      children: [{ kind: "heading", id: "leak", level: 2, text: "Leak" }],
    },
  ];
  return {
    title: "Feature gallery",
    content: [
      {
        kind: "stack",
        id: "root-stack",
        children: all,
        style: {
          className: "custom panel",
          color: "white",
          background: "black",
          borderColor: "gray",
          width: "100%",
          height: "auto",
        },
      },
    ],
    activeScopeIds: ["main"],
    hotkeys: [
      {
        id: "gain-key",
        key: "g",
        description: "Gain",
        enabled: true,
        intent: { type: "hotkey" },
        scopeId: "main",
      },
      {
        id: "shift-key",
        key: "x",
        modifiers: ["shift"],
        description: "Shift",
        enabled: true,
        intent: { type: "shift" },
      },
      {
        id: "wrong-scope",
        key: "z",
        description: "Wrong",
        enabled: true,
        intent: { type: "wrong" },
        scopeId: "other",
      },
    ],
  };
}

describe("DOM renderer", () => {
  it("renders the gallery, dispatches controls, and hides undiscovered content", () => {
    const root = document.createElement("main");
    document.body.append(root);
    const source = new Source();
    const results: string[] = [];
    const confirm = vi.fn(() => true);
    Object.defineProperty(window, "confirm", { value: confirm, configurable: true });
    const mount = mountView(root, {
      source,
      project: gallery,
      resolver,
      reducedMotion: true,
      onDispatchResult: (result) => results.push(String(result)),
    });

    expect(root.getAttribute("aria-label")).toBe("Feature gallery");
    expect(root.textContent).toContain("Gallery Ada");
    expect(root.textContent).not.toContain("Leak");
    expect(root.textContent).not.toContain("Secret");
    expect(root.querySelectorAll("[role=progressbar]")).toHaveLength(4);
    expect(root.querySelector("[data-e308-key=right]")?.getAttribute("aria-valuenow")).toBe("100");
    expect(root.querySelector("[data-e308-key=left]")?.getAttribute("aria-valuenow")).toBe("0");
    expect(root.querySelector(".e308-resource")?.getAttribute("title")).toBe("capacity 100");
    expect(root.querySelectorAll(".e308-tree-branches line")).toHaveLength(2);
    expect(root.querySelector(".e308-tree-node img")?.getAttribute("alt")).toBe("Start");
    expect(root.querySelector("[data-action=locked] .e308-action-blockers")?.textContent).toBe(
      "requires known",
    );
    expect(root.querySelector(".e308-reset")?.getAttribute("data-clears")).toBe("Points");
    expect(root.querySelector(".e308-offline")?.getAttribute("data-pending-ms")).toBe("100");
    expect(root.querySelector(".e308-save")?.getAttribute("data-status")).toBe("saved");

    (root.querySelector("[data-action=gain]") as HTMLButtonElement).click();
    (root.querySelector("[data-action=locked]") as HTMLButtonElement).click();
    expect(source.intents.map((item) => item.type)).toEqual(["gain"]);
    expect(results).toEqual(["gain"]);
    expect(root.querySelector("[data-action=gain]")?.getAttribute("title")).toBe("Gain points");
    confirm.mockReturnValue(false);
    (root.querySelector("[data-action=gain]") as HTMLButtonElement).click();
    expect(source.intents).toHaveLength(1);
    confirm.mockReturnValue(true);

    (root.querySelector("[data-tab=two]") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Inside");
    expect(root.querySelector("[data-tab=hidden-tab]")).toBeNull();

    const name = required(root.querySelector<HTMLInputElement>("[data-e308-key='name:control']"));
    name.value = "Grace";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    const range = required(root.querySelector<HTMLInputElement>("[data-e308-key='range:control']"));
    range.value = "4";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(source.intents.at(-1)).toEqual({ type: "name", value: "Grace" });
    range.dispatchEvent(new Event("change", { bubbles: true }));
    const select = required(
      root.querySelector<HTMLSelectElement>("[data-e308-key='select:control']"),
    );
    select.value = "b";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const toggle = required(
      root.querySelector<HTMLInputElement>("[data-e308-key='toggle:control']"),
    );
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(source.intents.slice(-4)).toEqual([
      { type: "name", value: "Grace" },
      { type: "range", value: 4 },
      { type: "select", value: "b" },
      { type: "toggle", value: false },
    ]);

    const star = required(root.querySelector<HTMLElement>("[data-particle=star]"));
    star.dispatchEvent(new Event("mouseenter"));
    star.dispatchEvent(new Event("mouseleave"));
    star.click();
    star.click();
    expect(source.intents.filter((item) => item.type === "claim")).toHaveLength(1);
    expect(root.querySelector("[data-particle=star]")).toBeNull();
    expect(root.querySelector(".e308-particles")?.getAttribute("data-reduced-motion")).toBe("true");

    mount.dispose();
    expect(root.childNodes).toHaveLength(0);
    expect(source.listeners.size).toBe(0);
  });

  it("preserves keyed identity, local state, and handles scoped hotkeys", () => {
    const root = document.createElement("main");
    document.body.append(root);
    const source = new Source();
    const mount = mountView(root, { source, project: gallery, resolver, reducedMotion: true });
    const input = required(root.querySelector<HTMLInputElement>("[data-e308-key='name:control']"));
    const heading = required(root.querySelector<HTMLElement>("[data-e308-key=heading]"));
    const resource = required(root.querySelector<HTMLElement>("[data-e308-key=points]"));
    input.focus();
    input.setSelectionRange(1, 2);
    const details = required(root.querySelector<HTMLDetailsElement>("details"));
    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    source.emit({ ...source.state, points: 13 });
    expect(root.querySelector("[data-e308-key=heading]")).toBe(heading);
    expect(root.querySelector("[data-e308-key=points]")).toBe(resource);
    expect(root.textContent).toContain("Points: 13");
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement?.getAttribute("data-e308-key")).toBe("name:control");
    expect((document.activeElement as HTMLInputElement).selectionStart).toBe(1);
    expect(root.querySelector<HTMLDetailsElement>("details")?.open).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "g" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "x", shiftKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
    expect(source.intents.map((item) => item.type)).toEqual(["hotkey", "shift"]);
    mount.render();
    mount.dispose();
    mount.dispose();
  });

  it("supports control overrides and custom-slot disposal", () => {
    const root = document.createElement("main");
    const source = new Source();
    let customDisposed = 0;
    const project = (): ViewDocument<Intent, number> => ({
      content: [
        { kind: "action", id: "replace", action: action("replace") },
        {
          kind: "custom",
          id: "custom",
          render: (owner) => owner.createTextNode("custom slot"),
          dispose: () => customDisposed++,
        },
      ],
    });
    const mount = mountView(root, {
      source,
      project,
      resolver,
      overrides: {
        action: (node, context) => {
          const button = context.document.createElement("button");
          button.textContent = `override:${node.id}`;
          return button;
        },
      },
    });
    expect(root.textContent).toBe("override:replacecustom slot");
    source.emit(source.state);
    expect(customDisposed).toBe(1);
    mount.dispose();
    expect(customDisposed).toBe(2);
  });
});
