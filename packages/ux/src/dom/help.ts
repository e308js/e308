import type { ViewNode } from "../view/nodes.js";
import { keyed } from "./elements.js";
import { bindEvent } from "./events.js";
import { cancelHelpHover } from "./help-hover.js";
import { positionHelp } from "./help-position.js";
import { bindHelpPreview } from "./help-preview.js";
import type { InternalRenderContext } from "./internal.js";

export function renderHelp<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "help" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  if (node.presentation === "expanded") {
    const section = keyed(context.document, "section", node.id);
    section.className = "e308-help e308-help-expanded";
    section.setAttribute("aria-label", context.resolver.text(node.label));
    section.append(...context.renderMany(node.content));
    return section;
  }
  const details = keyed(context.document, "details", node.id) as HTMLDetailsElement;
  details.className = "e308-help e308-help-popover";
  details.open = context.open.get(node.id) ?? node.initiallyOpen ?? false;
  const summary = context.document.createElement("summary");
  summary.dataset.e308Key = `${node.id}:trigger`;
  summary.className = "e308-help-trigger";
  summary.setAttribute("role", "button");
  summary.setAttribute("aria-label", context.resolver.text(node.label));
  summary.setAttribute("aria-expanded", String(details.open));
  summary.textContent = node.triggerLabel ? context.resolver.text(node.triggerLabel) : "i";
  const content = context.document.createElement("div");
  content.className = "e308-help-content";
  content.id = `${context.idPrefix}-${node.id}-content`;
  summary.setAttribute("aria-controls", content.id);
  if (node.targetId) details.dataset.helpFor = node.targetId;
  content.append(...context.renderMany(node.content));
  bindDisclosureEvents(details, node.id, context, node.preview);
  if (node.preview) {
    const state = context.helpPreviews.get(node.id) ?? {
      pinned: details.open,
      hovered: false,
      focused: false,
      suppressed: false,
      pointerFocus: false,
    };
    state.moveDismissPx = node.previewMoveDismissPx;
    context.helpPreviews.set(node.id, state);
    details.dataset.helpPinned = String(state.pinned);
    const arrow = context.document.createElement("span");
    arrow.className = "e308-help-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▸";
    summary.append(arrow);
    bindHelpPreview(
      details,
      summary,
      state,
      (current, open) => {
        current.open = open;
        current.dataset.helpPinned = String(state.pinned);
        context.open.set(node.id, open);
        current.querySelector("summary")?.setAttribute("aria-expanded", String(open));
        positionHelp(current);
      },
      node.previewDelayMs,
    );
  }
  details.append(summary, content);
  return details;
}

function bindDisclosureEvents<Intent, N>(
  details: HTMLDetailsElement,
  id: string,
  context: InternalRenderContext<Intent, N>,
  preview = false,
): void {
  bindEvent<Event>(details, "toggle", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (!current.isConnected) return;
    context.open.set(id, current.open);
    positionHelp(current);
    current.querySelector("summary")?.setAttribute("aria-expanded", String(current.open));
  });
  if (preview) return;
  bindEvent<MouseEvent>(details, "click", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (!current.querySelector("summary")?.contains(event.target as Node)) return;
    event.preventDefault();
    current.open = !current.open;
    context.open.set(id, current.open);
    current.querySelector("summary")?.setAttribute("aria-expanded", String(current.open));
    positionHelp(current);
  });
  bindEvent<KeyboardEvent>(details, "keydown", (event) => {
    const current = event.currentTarget as HTMLDetailsElement;
    if (event.key !== "Escape" || !current.open) return;
    event.preventDefault();
    current.open = false;
    current.querySelector("summary")?.setAttribute("aria-expanded", "false");
    context.open.set(id, false);
    current.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
  });
}

/** Escape also dismisses hover help when keyboard focus is outside the disclosure. */
export function dismissOutsideHelp<Intent, N>(
  root: HTMLElement,
  event: KeyboardEvent,
  context: InternalRenderContext<Intent, N>,
): void {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  for (const state of context.helpPreviews.values()) {
    if (!state.cancelHover) continue;
    cancelHelpHover(state);
    state.suppressed = true;
    event.preventDefault();
  }
  for (const details of Array.from(
    root.querySelectorAll<HTMLDetailsElement>(".e308-help-popover[open]"),
  )) {
    const id = details.dataset.e308Key;
    if (!id) continue;
    event.preventDefault();
    details.open = false;
    context.open.set(id, false);
    const state = context.helpPreviews.get(id);
    if (state) {
      state.pinned = false;
      state.suppressed = true;
      details.dataset.helpPinned = "false";
    }
    details.querySelector("summary")?.setAttribute("aria-expanded", "false");
  }
}
