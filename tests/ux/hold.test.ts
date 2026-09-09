// @vitest-environment happy-dom

import { nativeNumbers } from "../../packages/core/src/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewSource,
} from "../../packages/ux/src/index.js";

it("repeats a hold intent across synchronous rerenders and stops on release", () => {
  vi.useFakeTimers();
  const intents: string[] = [];
  const listeners = new Set<(state: number) => void>();
  let state = 0;
  const source: ViewSource<number, string> = {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(intent) {
      intents.push(intent);
      state += 1;
      for (const listener of listeners) listener(state);
    },
  };
  const root = document.createElement("main");
  const mount = mountView(root, {
    source,
    resolver: createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) }),
    project: () => ({
      content: [
        {
          kind: "action",
          id: "hold",
          action: {
            id: "hold",
            label: "Hold",
            enabled: true,
            blockers: [],
            intent: "click",
            hold: { intent: "hold", delayMs: 5, repeatMs: 5 },
          },
        },
      ],
    }),
  });
  const button = root.querySelector<HTMLButtonElement>("button");
  if (!button) throw new Error("missing hold button");
  button.dispatchEvent(new PointerEvent("pointerdown", { button: 1, bubbles: true }));
  vi.advanceTimersByTime(20);
  expect(intents).toHaveLength(0);
  button.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
  vi.advanceTimersByTime(16);
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  expect(intents).toEqual(["hold", "hold", "hold"]);
  vi.advanceTimersByTime(20);
  expect(intents).toHaveLength(3);
  mount.dispose();
  vi.useRealTimers();
});
