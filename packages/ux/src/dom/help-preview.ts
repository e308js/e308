import { bindEvent } from "./events.js";
import { bindHelpHover, cancelHelpHover } from "./help-hover.js";

export interface HelpPreviewState {
  pinned: boolean;
  hovered: boolean;
  focused: boolean;
  suppressed: boolean;
  pointerFocus: boolean;
  cancelHover?: (() => void) | undefined;
  anchor?: { x: number; y: number } | undefined;
  moveDismissPx?: number | undefined;
}

export function bindHelpPreview(
  details: HTMLDetailsElement,
  summary: HTMLElement,
  state: HelpPreviewState,
  setOpen: (current: HTMLDetailsElement, open: boolean) => void,
  delayMs = 120,
): void {
  const sync = (current: HTMLDetailsElement): void =>
    setOpen(current, state.pinned || (!state.suppressed && (state.hovered || state.focused)));
  bindHelpHover(summary, state, sync, delayMs);
  bindEvent<PointerEvent>(details, "pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    cancelHelpHover(state);
    state.hovered = false;
    sync(event.currentTarget as HTMLDetailsElement);
  });
  bindEvent<PointerEvent>(details, "pointerdown", () => {
    cancelHelpHover(state);
    state.pointerFocus = true;
  });
  bindEvent<FocusEvent>(details, "focusin", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (!current.contains(event.relatedTarget as Node | null) && !state.pointerFocus) {
      cancelHelpHover(state);
      state.focused = true;
      state.suppressed = false;
      sync(current);
    }
    state.pointerFocus = false;
  });
  bindEvent<FocusEvent>(details, "focusout", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (current.contains(event.relatedTarget as Node | null)) return;
    state.focused = false;
    state.pointerFocus = false;
    sync(current);
  });
  bindEvent<MouseEvent>(details, "click", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (!current.querySelector("summary")?.contains(event.target as Node)) return;
    event.preventDefault();
    cancelHelpHover(state);
    state.pinned = !state.pinned;
    state.suppressed = !state.pinned;
    state.pointerFocus = false;
    sync(current);
  });
  bindEvent<KeyboardEvent>(details, "keydown", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (event.key !== "Escape" || !current.open) return;
    event.preventDefault();
    cancelHelpHover(state);
    // Focus first: returning from a link must not undo Escape's suppression.
    current.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    state.pinned = false;
    state.suppressed = true;
    sync(current);
  });
}
