import type { ViewNode } from "../view/nodes.js";
import { applyStyle, keyed } from "./elements.js";
import { renderHelp } from "./help.js";
import type { InternalRenderContext } from "./internal.js";

type BaselineNode<Intent, N> = Extract<
  ViewNode<Intent, N>,
  { kind: "help" | "section" | "fieldset" | "notification" | "command-feedback" }
>;

export function renderBaselineNode<Intent, N>(
  node: BaselineNode<Intent, N>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  switch (node.kind) {
    case "help":
      return renderHelp(node, context);
    case "section":
      return renderSection(node, context);
    case "fieldset":
      return renderFieldset(node, context);
    case "notification":
      return renderNotification(node, context);
    case "command-feedback":
      return renderCommandFeedback(node, context);
  }
}

function renderSection<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "section" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const section = keyed(context.document, "section", node.id);
  section.className = `e308-section e308-section-${node.variant ?? "plain"}`;
  if (node.title) {
    const heading = context.document.createElement(`h${node.headingLevel ?? 2}`);
    heading.textContent = context.resolver.text(node.title);
    section.append(heading);
  }
  section.append(...context.renderMany(node.children));
  applyStyle(section, node.style);
  return section;
}

function renderFieldset<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "fieldset" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const fieldset = keyed(context.document, "fieldset", node.id);
  fieldset.className = "e308-fieldset";
  const legend = context.document.createElement("legend");
  legend.textContent = context.resolver.text(node.legend);
  fieldset.append(legend, ...context.renderMany(node.children));
  applyStyle(fieldset, node.style);
  return fieldset;
}

function renderNotification<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "notification" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const element = keyed(context.document, "div", node.id);
  element.className = "e308-notification";
  element.setAttribute("role", "status");
  element.dataset.tone = node.tone ?? "neutral";
  element.textContent = context.resolver.text(node.text);
  return element;
}

function renderCommandFeedback<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "command-feedback" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const element = keyed(context.document, "section", node.id);
  element.id = `${context.idPrefix}-${node.id}`;
  element.className = `e308-feedback e308-feedback-${node.presentation ?? "inline"}`;
  element.dataset.feedbackFor = node.targetId;
  element.dataset.state = node.state;
  element.setAttribute("role", node.state === "failure" ? "alert" : "status");
  element.setAttribute("aria-live", node.state === "failure" ? "assertive" : "polite");
  element.setAttribute("aria-atomic", "true");
  updateFeedbackFocus(element, node, context);
  const message = context.document.createElement("p");
  message.className = "e308-feedback-message";
  message.textContent = context.resolver.text(node.message);
  element.append(message);
  if (node.errors?.length) element.append(renderErrors(node.errors, context));
  return element;
}

function updateFeedbackFocus<Intent, N>(
  element: HTMLElement,
  node: Extract<ViewNode<Intent, N>, { kind: "command-feedback" }>,
  context: InternalRenderContext<Intent, N>,
): void {
  if (node.state === "failure" && node.focusOnError) {
    element.tabIndex = -1;
    context.requestFeedbackFocus(node.id);
  } else context.clearFeedbackFocus(node.id);
}

function renderErrors<Intent, N>(
  errors: NonNullable<Extract<ViewNode<Intent, N>, { kind: "command-feedback" }>["errors"]>,
  context: InternalRenderContext<Intent, N>,
): HTMLUListElement {
  const list = context.document.createElement("ul");
  list.className = "e308-error-summary";
  for (const error of errors) {
    const item = context.document.createElement("li");
    item.dataset.error = error.id;
    const text = `${context.resolver.text(error.label)}: ${context.resolver.text(error.message)}`;
    if (error.targetId) {
      const link = context.document.createElement("a");
      link.href = `#${error.targetId}`;
      link.textContent = text;
      item.append(link);
    } else item.textContent = text;
    list.append(item);
  }
  return list;
}
