import { bindEvent } from "./events.js";

export interface HelpPreviewState {
  pinned: boolean;
  hovered: boolean;
  focused: boolean;
  suppressed: boolean;
  pointerFocus: boolean;
}

export function bindHelpPreview(
  details: HTMLDetailsElement,
  state: HelpPreviewState,
  setOpen: (current: HTMLDetailsElement, open: boolean) => void,
): void {
  const sync = (current: HTMLDetailsElement): void =>
    setOpen(current, state.pinned || (!state.suppressed && (state.hovered || state.focused)));
  bindEvent<PointerEvent>(details, "pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    state.hovered = true;
    state.suppressed = false;
    sync(event.currentTarget as HTMLDetailsElement);
  });
  bindEvent<PointerEvent>(details, "pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    state.hovered = false;
    sync(event.currentTarget as HTMLDetailsElement);
  });
  bindEvent<PointerEvent>(details, "pointerdown", () => {
    state.pointerFocus = true;
  });
  bindEvent<FocusEvent>(details, "focusin", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (!current.contains(event.relatedTarget as Node | null) && !state.pointerFocus) {
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
    state.pinned = !state.pinned;
    state.suppressed = !state.pinned;
    state.pointerFocus = false;
    sync(current);
  });
  bindEvent<KeyboardEvent>(details, "keydown", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (event.key !== "Escape" || !current.open) return;
    event.preventDefault();
    // Focus first: returning from a link must not undo Escape's suppression.
    current.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    state.pinned = false;
    state.suppressed = true;
    sync(current);
  });
}
