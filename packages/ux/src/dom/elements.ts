import { appendDescription } from "../localization/catalog.js";
import type { TextResolver } from "../localization/types.js";
import type { ActionBlocker } from "../view/failures.js";
import type { ActionView, QuantityLine, ResourceView } from "../view/models.js";
import type { MarkView, ViewStyle } from "../view/nodes.js";

export function keyed(document: Document, tag: string, id: string): HTMLElement {
  const element = document.createElement(tag);
  element.dataset.e308Key = id;
  return element;
}

export function applyStyle(element: HTMLElement, style: ViewStyle | undefined): void {
  if (!style) return;
  if (style.className) element.classList.add(...style.className.split(/\s+/).filter(Boolean));
  if (style.color) element.style.color = style.color;
  if (style.background) element.style.background = style.background;
  if (style.borderColor) element.style.borderColor = style.borderColor;
  if (style.width) element.style.width = style.width;
  if (style.height) element.style.height = style.height;
}

export function appendMark<N>(
  parent: HTMLElement,
  mark: MarkView<N> | undefined,
  resolver: TextResolver<N>,
): void {
  if (!mark) return;
  const badge = parent.ownerDocument.createElement("span");
  badge.className = "e308-mark";
  badge.dataset.tone = mark.tone ?? "neutral";
  badge.textContent = resolver.text(mark.label);
  parent.append(badge);
}

export function renderQuantity<N>(
  document: Document,
  line: QuantityLine<N>,
  resolver: TextResolver<N>,
): HTMLElement {
  const row = document.createElement("span");
  row.className = "e308-quantity";
  const value = resolver.argument({
    kind: "quantity",
    value: line.value,
    ...(line.format ? { format: line.format } : {}),
  });
  row.textContent = `${resolver.text(line.label)}: ${value}`;
  row.dataset.resource = line.resourceId;
  return row;
}

export function renderResource<N>(
  document: Document,
  resource: ResourceView<N>,
  resolver: TextResolver<N>,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "e308-resource";
  element.append(renderQuantity(document, resource, resolver));
  if (resource.rate !== undefined) {
    const rate = resolver.argument({ kind: "quantity", value: resource.rate });
    element.append(document.createTextNode(` (${rate}/s)`));
  }
  if (resource.capacity !== undefined) {
    const capacity = resolver.argument({ kind: "quantity", value: resource.capacity });
    element.title = `capacity ${capacity}`;
  }
  return element;
}

export function renderAction<Intent, N>(
  document: Document,
  action: ActionView<Intent, N>,
  resolver: TextResolver<N>,
  dispatch: (intent: Intent) => unknown,
  startHold?: (hold: NonNullable<ActionView<Intent>["hold"]>, event: PointerEvent) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = !action.enabled;
  button.textContent = resolver.text(action.label);
  button.dataset.action = action.id;
  button.setAttribute("aria-disabled", String(!action.enabled));
  if (action.description) {
    const description = document.createElement("span");
    description.className = "e308-action-description";
    appendDescription(description, action.description, resolver);
    button.title = description.textContent ?? "";
    button.append(description);
  }
  if (action.blockers.length > 0)
    button.dataset.blockers = action.blockers.map((item) => item.kind).join(" ");
  appendActionDetails(button, action, resolver);
  button.addEventListener("click", () => {
    if (
      !button.disabled &&
      (!action.confirm || document.defaultView?.confirm(resolver.text(action.confirm)) !== false)
    ) {
      dispatch(action.intent);
    }
  });
  const hold = action.hold;
  if (hold && startHold) {
    button.addEventListener("pointerdown", (event) => {
      if (!button.disabled && event.button === 0) startHold(hold, event);
    });
  }
  return button;
}

function appendActionDetails<Intent, N>(
  button: HTMLButtonElement,
  action: ActionView<Intent, N>,
  resolver: TextResolver<N>,
): void {
  for (const [kind, lines] of [
    ["costs", action.costs],
    ["rewards", action.rewards],
  ] as const) {
    if (!lines || lines.length === 0) continue;
    const details = button.ownerDocument.createElement("span");
    details.className = `e308-action-${kind}`;
    for (const line of lines) details.append(renderQuantity(button.ownerDocument, line, resolver));
    button.append(details);
  }
  if (action.blockers.length > 0) {
    const blockers = button.ownerDocument.createElement("span");
    blockers.className = "e308-action-blockers";
    blockers.textContent = action.blockers.map((item) => blockerText(item, resolver)).join("; ");
    button.append(blockers);
  }
}

function blockerText<N>(blocker: ActionBlocker<N>, resolver: TextResolver<N>): string {
  const quantity = (value: N) => resolver.argument({ kind: "quantity", value });
  switch (blocker.kind) {
    case "insufficient":
      return `${blocker.resourceId}: need ${quantity(blocker.required)}, have ${quantity(blocker.available)}`;
    case "capacity-blocked":
      return `${blocker.resourceId}: capacity ${quantity(blocker.capacity)}`;
    case "locked":
      return `requires ${blocker.prerequisiteIds.join(", ")}`;
    case "cooldown":
      return `${blocker.actionId}: ${Math.ceil(blocker.remainingMs / 1_000)} seconds remaining`;
    case "invalid-count":
      return "enter a valid purchase count";
    case "allocation-exceeded":
      return `${blocker.allocationId}: ${quantity(blocker.assigned)} of ${quantity(blocker.budget)} assigned`;
    case "stale-revision":
      return "the game state changed; try again";
    case "invalid-target":
      return `unknown target: ${blocker.id}`;
    case "disabled":
      return blocker.reasonKey.replaceAll("-", " ");
    case "budget-exceeded":
      return `${blocker.budgetId}: limit reached`;
    case "numeric-fault":
    case "transaction-failed":
      return blocker.message;
    case "extension":
      return blocker.fallbackKey.replaceAll("-", " ");
  }
}
