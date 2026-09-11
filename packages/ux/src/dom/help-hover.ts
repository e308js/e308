import { bindEvent } from "./events.js";
import type { HelpPreviewState } from "./help-preview.js";

export function cancelHelpHover(state: HelpPreviewState): void {
  state.cancelHover?.();
  state.cancelHover = undefined;
}

/** Only the actual trigger starts a preview, never its layout wrapper or popup. */
export function bindHelpHover(
  summary: HTMLElement,
  state: HelpPreviewState,
  sync: (current: HTMLDetailsElement) => void,
  delayMs: number,
): void {
  bindEvent<PointerEvent>(summary, "pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    const trigger = event.currentTarget as HTMLElement;
    const current = trigger.parentElement as HTMLDetailsElement;
    const window = trigger.ownerDocument.defaultView;
    if (!window) return;
    cancelHelpHover(state);
    state.suppressed = false;
    state.anchor = { x: event.clientX, y: event.clientY };
    if (current.open) return;
    const open = (): void => {
      state.cancelHover = undefined;
      if (!current.isConnected || state.suppressed) return;
      state.hovered = true;
      sync(current);
    };
    const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 120;
    if (delay === 0) open();
    else {
      const timer = window.setTimeout(open, delay);
      state.cancelHover = () => window.clearTimeout(timer);
    }
  });
  bindEvent<PointerEvent>(summary, "pointermove", (event) => {
    if (event.pointerType === "mouse" && state.cancelHover)
      state.anchor = { x: event.clientX, y: event.clientY };
  });
  bindEvent<PointerEvent>(summary, "pointerleave", (event) => {
    if (event.pointerType === "mouse") cancelHelpHover(state);
  });
}

export function observeHelpHover(
  root: HTMLElement,
  states: Map<string, HelpPreviewState>,
  close: (details: HTMLDetailsElement) => void,
): () => void {
  const move = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    for (const details of Array.from(
      root.querySelectorAll<HTMLDetailsElement>(".e308-help-popover[open]"),
    )) {
      const state = states.get(details.dataset.e308Key ?? "");
      if (!state || state.pinned || state.focused) continue;
      const limit = state.moveDismissPx;
      const moved =
        state.anchor &&
        limit !== undefined &&
        Number.isFinite(limit) &&
        limit > 0 &&
        Math.hypot(event.clientX - state.anchor.x, event.clientY - state.anchor.y) >= limit;
      const target = event.target as Node | null;
      const overControl = details.querySelector("summary")?.contains(target);
      const overContent = details.querySelector(".e308-help-content")?.contains(target);
      if (moved || (!overControl && !overContent)) {
        cancelHelpHover(state);
        state.hovered = false;
        state.suppressed = true;
        close(details);
      }
    }
  };
  root.ownerDocument.addEventListener("pointermove", move);
  return () => {
    root.ownerDocument.removeEventListener("pointermove", move);
    for (const state of states.values()) cancelHelpHover(state);
  };
}
