// @vitest-environment happy-dom

import { positionHelp } from "../../packages/ux/src/dom/help-position.js";
import { mountView, type ViewDocument } from "../../packages/ux/src/index.js";

function fixture(initiallyOpen = false) {
  const root = document.createElement("main");
  document.body.append(root);
  const mount = mountView(root, {
    source: { getSnapshot: () => 0, subscribe: () => () => {}, dispatch: () => {} },
    resolver: { text: String, argument: String },
    project: (): ViewDocument => ({
      content: [
        {
          kind: "help",
          id: "help",
          label: "Help",
          preview: true,
          initiallyOpen,
          content: [
            {
              kind: "description",
              id: "text",
              content: [
                { kind: "link", href: "#", children: [{ kind: "text", value: "Read more" }] },
              ],
            },
          ],
        },
      ],
    }),
  });
  const details = root.querySelector("details") as HTMLDetailsElement;
  const trigger = root.querySelector("summary") as HTMLElement;
  const link = root.querySelector("a") as HTMLElement;
  const pointer = (type: string, pointerType = "mouse") =>
    details.dispatchEvent(new PointerEvent(type, { pointerType }));
  const key = (key: string) =>
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  return { root, mount, details, trigger, link, pointer, key };
}

afterEach(() => document.body.replaceChildren());

it("keeps mouse previews open through reconciliation, content traversal and pinning", () => {
  const { root, mount, details, trigger, link, pointer, key } = fixture();
  pointer("pointerenter", "touch");
  expect(details.open).toBe(false);
  pointer("pointerenter");
  expect(details.open).toBe(true);
  mount.render();
  expect(root.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  link.click();
  expect(details.open).toBe(true);
  pointer("pointerleave", "touch");
  expect(details.open).toBe(true);
  pointer("pointerleave");
  expect(details.open).toBe(false);
  pointer("pointerenter");
  trigger.click();
  pointer("pointerleave");
  mount.render();
  expect(details.open).toBe(true);
  key("x");
  expect(details.open).toBe(true);
  key("Escape");
  expect(details.open).toBe(false);
  key("Escape");
  mount.render();
  expect(details.open).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  mount.dispose();
});

it("distinguishes keyboard previews from touch focus and dismisses from content", () => {
  const { mount, details, trigger, link, pointer, key } = fixture();
  pointer("pointerdown", "touch");
  trigger.focus();
  expect(details.open).toBe(false);
  trigger.click();
  expect(details.open).toBe(true);
  trigger.click();
  expect(details.open).toBe(false);
  trigger.blur();
  trigger.focus();
  expect(details.open).toBe(true);
  link.focus();
  expect(details.open).toBe(true);
  key("Escape");
  expect(document.activeElement).toBe(trigger);
  expect(details.open).toBe(false);
  trigger.blur();
  trigger.focus();
  expect(details.open).toBe(true);
  trigger.blur();
  expect(details.open).toBe(false);
  mount.dispose();
});

it("initially open previews stay pinned and mounting cleans up global observers", () => {
  const { mount, details, trigger } = fixture(true);
  const remove = vi.spyOn(document, "removeEventListener");
  trigger.focus();
  trigger.blur();
  expect(details.open).toBe(true);
  details.dispatchEvent(new Event("toggle"));
  window.dispatchEvent(new Event("resize"));
  document.dispatchEvent(new Event("scroll"));
  mount.dispose();
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  expect(remove).toHaveBeenCalledWith("focusin", expect.any(Function));
  // A queued native toggle on a discarded render must not resurrect open state.
  details.dispatchEvent(new Event("toggle"));
});

it("clamps help to viewport edges, flips above and avoids an outside focused control", () => {
  const { mount, details, trigger } = fixture(true);
  const content = details.querySelector(".e308-help-content") as HTMLElement;
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(990, 700, 44, 44));
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(new DOMRect(664, 600, 352, 100));
  Object.defineProperty(content, "scrollHeight", { value: 100 });
  positionHelp(details);
  expect(content.style.left).toBe("664px");
  expect(content.style.top).toBe("600px");
  const input = document.createElement("input");
  document.body.append(input);
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue(new DOMRect(650, 620, 360, 44));
  input.focus();
  expect(content.style.top).toBe("516px");
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 20, 44, 44));
  positionHelp(details);
  expect(content.style.left).toBe("8px");
  expect(content.style.top).toBe("64px");
  details.open = false;
  positionHelp(details);
  mount.dispose();
});
