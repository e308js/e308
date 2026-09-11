// @vitest-environment happy-dom

import { nativeNumbers } from "../../packages/core/src/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
  type ViewSource,
} from "../../packages/ux/src/index.js";

type Intent = { readonly type: string; readonly value?: unknown };
interface State {
  readonly name: string;
}

class Source implements ViewSource<State, Intent, unknown> {
  readonly intents: Intent[] = [];
  getSnapshot(): State {
    return { name: "Ada" };
  }
  subscribe(): () => void {
    return () => undefined;
  }
  dispatch(intent: Intent): unknown {
    this.intents.push(intent);
    return undefined;
  }
}

const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });

function required<ElementType extends Element>(element: ElementType | null): ElementType {
  if (!element) throw new Error("expected rendered element");
  return element;
}

function baseline(state: State): ViewDocument<Intent, number> {
  return {
    content: [
      {
        kind: "section",
        id: "status-strip",
        title: "Status",
        variant: "status-strip",
        children: [
          {
            kind: "help",
            id: "metal-help",
            label: "About Metal rate",
            targetId: "status-strip",
            triggerLabel: "i",
            content: [
              {
                kind: "description",
                id: "metal-help-text",
                content: [{ kind: "text", value: "Exactly 2 Metal per second." }],
              },
            ],
          },
        ],
      },
      {
        kind: "fieldset",
        id: "options",
        legend: "Options",
        children: [
          {
            kind: "toggle-input",
            id: "repeat",
            domId: "repeat-control",
            label: "Repeat",
            value: true,
            intent: (value) => ({ type: "repeat", value }),
          },
          {
            kind: "text-input",
            id: "name-field",
            domId: "name-control",
            label: "Name",
            value: state.name,
            intent: (value) => ({ type: "name", value }),
          },
        ],
      },
      blockedAction(),
      pendingAction(),
      failureFeedback(),
    ],
  };
}

function blockedAction(): ViewDocument<Intent, number>["content"][number] {
  return {
    kind: "action",
    id: "blocked-control",
    action: {
      id: "blocked",
      label: "Build",
      enabled: false,
      intent: { type: "build" },
      blockers: [
        { kind: "insufficient", resourceId: "metal", required: 10, available: 2 },
        { kind: "locked", prerequisiteIds: ["forge"] },
      ],
    },
  };
}

function pendingAction(): ViewDocument<Intent, number>["content"][number] {
  return {
    kind: "action",
    id: "pending-control",
    action: {
      id: "pending",
      label: "Sending",
      enabled: true,
      state: "pending",
      intent: { type: "pending" },
      blockers: [],
    },
  };
}

function failureFeedback(): ViewDocument<Intent, number>["content"][number] {
  return {
    kind: "command-feedback",
    id: "build-error",
    targetId: "blocked",
    state: "failure",
    message: "Build rejected.",
    focusOnError: true,
    errors: [
      {
        id: "name-short",
        targetId: "name-control",
        label: "Name",
        message: "Enter at least three characters.",
      },
    ],
  };
}

describe("accessible baseline primitives", () => {
  it("renders toggles, disclosure, blockers, feedback, and layout semantics", () => {
    const root = document.createElement("main");
    document.body.append(root);
    const source = new Source();
    const mount = mountView(root, { source, project: baseline, resolver });
    expect(document.activeElement).toBe(root.querySelector("[data-feedback-for=blocked]"));

    const label = required(root.querySelector<HTMLLabelElement>(".e308-toggle"));
    const toggle = required(root.querySelector<HTMLInputElement>("#repeat-control"));
    expect(label.dataset.inputKind).toBe("toggle-input");
    expect(label.htmlFor).toBe("repeat-control");
    expect(label.textContent).toBe("Repeat");
    expect(toggle.checked).toBe(true);
    label.click();
    expect(source.intents.at(-1)).toEqual({ type: "repeat", value: false });

    verifyBlockedAction(root, source);
    verifyFeedback(root);
    verifyDisclosure(root);
    mount.dispose();
  });

  it("supports persistent help, feedback variants, defaults, and keyboard tab navigation", () => {
    const root = document.createElement("main");
    document.body.append(root);
    const source = new Source();
    const project = (): ViewDocument<Intent, number> => ({
      content: [
        {
          kind: "help",
          id: "expanded",
          label: "Expanded help",
          presentation: "expanded",
          content: [],
        },
        {
          kind: "help",
          id: "open-default",
          label: "Default trigger",
          initiallyOpen: true,
          content: [],
        },
        { kind: "section", id: "plain-section", children: [] },
        { kind: "notification", id: "neutral-note", text: "Neutral" },
        {
          kind: "command-feedback",
          id: "pending-note",
          targetId: "plain-section",
          state: "pending",
          message: "Pending",
        },
        {
          kind: "command-feedback",
          id: "success-note",
          targetId: "plain-section",
          state: "success",
          message: "Done",
          errors: [{ id: "general", label: "General", message: "No target" }],
        },
        {
          kind: "tabs",
          id: "keyboard-tabs",
          tabs: [
            { id: "one", label: "One", content: [] },
            { id: "two", label: "Two", content: [] },
            { id: "disabled", label: "Disabled", disabled: true, content: [] },
          ],
        },
      ],
    });
    const mount = mountView(root, { source, project, resolver });

    expect(root.querySelector(".e308-help-expanded")).not.toBeNull();
    expect(root.querySelector<HTMLDetailsElement>(".e308-help-popover")?.open).toBe(true);
    expect(root.querySelector(".e308-section-plain")).not.toBeNull();
    expect(root.querySelector("[data-tone=neutral]")).not.toBeNull();
    expect(root.querySelector("[data-state=pending]")?.getAttribute("role")).toBe("status");
    expect(root.querySelector("[data-error=general]")?.textContent).toContain("No target");
    verifyTabKeys(root);
    mount.dispose();
  });
});

function verifyTabKeys(root: HTMLElement): void {
  const tab = (id: string) => required(root.querySelector<HTMLButtonElement>(`[data-tab=${id}]`));
  const press = (id: string, key: string) =>
    tab(id).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  press("one", "ArrowRight");
  expect(tab("two").getAttribute("aria-selected")).toBe("true");
  press("two", "ArrowLeft");
  expect(tab("one").getAttribute("aria-selected")).toBe("true");
  press("one", "End");
  expect(tab("two").getAttribute("aria-selected")).toBe("true");
  press("two", "Home");
  expect(tab("one").getAttribute("aria-selected")).toBe("true");
  press("one", "Unrelated");
  root
    .querySelector("[role=tablist]")
    ?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  expect(tab("one").getAttribute("aria-selected")).toBe("true");
}

function verifyBlockedAction(root: HTMLElement, source: Source): void {
  const blocked = required(root.querySelector<HTMLButtonElement>("[data-action=blocked]"));
  expect(blocked.disabled).toBe(false);
  expect(blocked.getAttribute("aria-disabled")).toBe("true");
  expect(blocked.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
  expect(blocked.querySelectorAll("[role=listitem]")).toHaveLength(2);
  blocked.focus();
  expect(document.activeElement).toBe(blocked);
  blocked.click();
  expect(source.intents.some((intent) => intent.type === "build")).toBe(false);
  const pending = required(root.querySelector<HTMLButtonElement>("[data-action=pending]"));
  expect(pending.getAttribute("aria-busy")).toBe("true");
  pending.click();
  expect(source.intents.some((intent) => intent.type === "pending")).toBe(false);
}

function verifyFeedback(root: HTMLElement): void {
  const feedback = required(root.querySelector<HTMLElement>("[data-feedback-for=blocked]"));
  const blocked = required(root.querySelector<HTMLButtonElement>("[data-action=blocked]"));
  expect(feedback.getAttribute("role")).toBe("alert");
  expect(feedback.tabIndex).toBe(-1);
  expect(feedback.querySelector("a")?.getAttribute("href")).toBe("#name-control");
  expect(blocked.getAttribute("aria-describedby")).toContain(feedback.id);
}

function verifyDisclosure(root: HTMLElement): void {
  const details = required(root.querySelector<HTMLDetailsElement>(".e308-help-popover"));
  const trigger = required(details.querySelector<HTMLElement>("summary"));
  expect(trigger.getAttribute("aria-label")).toBe("About Metal rate");
  trigger.click();
  expect(details.open).toBe(true);
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(root.querySelector(".e308-section-status-strip")?.getAttribute("aria-details")).toBe(
    details.querySelector(".e308-help-content")?.id,
  );
  expect(root.querySelector("fieldset > legend")?.textContent).toBe("Options");
}
