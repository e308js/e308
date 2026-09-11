// @vitest-environment happy-dom

import { mountView, type ViewDocument } from "../../packages/ux/src/index.js";

function fixture() {
  const root = document.createElement("main");
  document.body.append(root);
  let visible = true;
  let notify = (_value: number): void => {};
  const mount = mountView(root, {
    source: {
      getSnapshot: () => 0,
      subscribe: (listener) => {
        notify = listener;
        return () => {};
      },
      dispatch: () => {},
    },
    resolver: { text: String, argument: String },
    project: (): ViewDocument => ({
      content: visible
        ? [
            {
              kind: "help",
              id: "hint",
              label: "Hint",
              preview: true,
              previewMoveDismissPx: 24,
              content: [
                {
                  kind: "description",
                  id: "text",
                  content: [{ kind: "text", value: "Short hint" }],
                },
              ],
            },
          ]
        : [],
    }),
  });
  const details = root.querySelector("details") as HTMLDetailsElement;
  const trigger = root.querySelector("summary") as HTMLElement;
  const content = root.querySelector(".e308-help-content") as HTMLElement;
  const pointer = (target: HTMLElement, type: string, x = 100, y = 100, pointerType = "mouse") =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: type === "pointermove",
        pointerType,
        clientX: x,
        clientY: y,
      }),
    );
  return {
    root,
    mount,
    details,
    trigger,
    content,
    pointer,
    remove: () => {
      visible = false;
      notify(0);
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it("requires trigger dwell, cancels flybys and survives a render during the delay", () => {
  const f = fixture();
  f.pointer(f.details, "pointerenter");
  vi.advanceTimersByTime(200);
  expect(f.details.open).toBe(false);
  f.pointer(f.trigger, "pointerenter");
  vi.advanceTimersByTime(60);
  f.pointer(f.trigger, "pointerleave");
  vi.advanceTimersByTime(200);
  expect(f.details.open).toBe(false);
  f.pointer(f.trigger, "pointerenter");
  vi.advanceTimersByTime(119);
  f.mount.render();
  expect(f.details.open).toBe(false);
  vi.advanceTimersByTime(1);
  expect(f.details.open).toBe(true);
  f.mount.dispose();
});

it("measures displacement at opening and dismisses over content without reopening", () => {
  const f = fixture();
  f.pointer(f.trigger, "pointerenter");
  f.pointer(f.trigger, "pointermove", 110);
  vi.advanceTimersByTime(120);
  f.pointer(f.content, "pointermove", 120);
  expect(f.details.open).toBe(true);
  f.pointer(f.content, "pointermove", 134);
  expect(f.details.open).toBe(false);
  f.mount.render();
  f.pointer(f.trigger, "pointermove", 140);
  vi.advanceTimersByTime(500);
  expect(f.details.open).toBe(false);
  f.pointer(f.trigger, "pointerenter", 140);
  vi.advanceTimersByTime(120);
  expect(f.details.open).toBe(true);
  f.mount.dispose();
});

it("preserves pinned and keyboard help despite mouse movement", () => {
  const f = fixture();
  f.pointer(f.trigger, "pointerenter");
  f.trigger.click();
  f.pointer(f.content, "pointermove", 400);
  vi.advanceTimersByTime(500);
  expect(f.details.open).toBe(true);
  expect(f.details.dataset.helpPinned).toBe("true");
  f.trigger.click();
  f.trigger.focus();
  f.pointer(f.content, "pointermove", 500);
  expect(f.details.open).toBe(true);
  f.mount.dispose();
});

it("cancels pending help on Escape, removal and disposal", () => {
  const f = fixture();
  f.pointer(f.trigger, "pointerenter");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  vi.advanceTimersByTime(200);
  expect(f.details.open).toBe(false);
  f.pointer(f.trigger, "pointerenter");
  f.remove();
  vi.advanceTimersByTime(200);
  expect(f.details.open).toBe(false);
  f.mount.dispose();
  const next = fixture();
  next.pointer(next.trigger, "pointerenter");
  next.mount.dispose();
  vi.advanceTimersByTime(200);
  expect(next.details.open).toBe(false);
});
