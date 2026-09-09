import { renderParticleLayer } from "../effects/particles.js";
import { appendDescription } from "../localization/catalog.js";
import type { ViewNode } from "../view/nodes.js";
import { renderGrid, renderInfobox, renderProgress, renderTabs, renderTree } from "./complex.js";
import {
  appendMark,
  applyStyle,
  keyed,
  renderAction,
  renderQuantity,
  renderResource,
} from "./elements.js";
import { renderInput } from "./inputs.js";
import type { InternalRenderContext } from "./internal.js";

export function renderNode<Intent, N>(
  node: ViewNode<Intent, N>,
  context: InternalRenderContext<Intent, N>,
): Node | undefined {
  if ("hidden" in node && node.hidden) return undefined;
  const override = context.overrides[node.kind];
  if (override) return override(node, context);
  switch (node.kind) {
    case "stack":
    case "row":
      return renderGroup(node, context);
    case "heading":
      return renderHeading(node, context);
    case "description":
      return renderDescription(node, context);
    case "separator":
      return keyed(context.document, "hr", node.id);
    case "image":
      return renderImage(node, context);
    case "resource": {
      const element = keyed(context.document, "div", node.id);
      element.append(renderResource(context.document, node.resource, context.resolver));
      return element;
    }
    case "action": {
      const element = renderAction(
        context.document,
        node.action,
        context.resolver,
        context.dispatch,
        context.startHold,
      );
      element.dataset.e308Key = node.id;
      appendMark(element, node.mark, context.resolver);
      applyStyle(element, node.style);
      return element;
    }
    case "quantities":
      return renderQuantities(node, context);
    case "progress":
      return renderProgress(node, context);
    case "infobox":
      return renderInfobox(node, context);
    case "tabs":
      return renderTabs(node, context);
    case "tree":
      return renderTree(node, context);
    case "grid":
      return renderGrid(node, context);
    case "text-input":
    case "range-input":
    case "select-input":
    case "toggle-input":
      return renderInput(context.document, node, context.resolver, context.dispatch);
    case "notification":
      return renderNotification(node, context);
    case "particles":
      return renderParticleLayer(node.id, {
        document: context.document,
        particles: node.particles,
        reducedMotion: context.reducedMotion,
        clock: context.clock,
        claimed: context.claimed,
        text: (value) => context.resolver.text(value),
        dispatch: context.dispatch,
        dispose: (callback) => context.renderDisposers.push(callback),
      });
    case "reset":
      return renderReset(node, context);
    case "offline":
      return renderOffline(node, context);
    case "save":
      return renderSave(node, context);
    case "custom": {
      const rendered = node.render(context.document);
      if (node.dispose) context.renderDisposers.push(node.dispose);
      return rendered;
    }
    default:
      return undefined;
  }
}

function renderReset<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "reset" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const section = keyed(context.document, "section", node.id);
  section.className = "e308-reset";
  section.append(
    renderAction(
      context.document,
      node.action,
      context.resolver,
      context.dispatch,
      context.startHold,
    ),
    ...node.gain.map((line) => renderQuantity(context.document, line, context.resolver)),
  );
  section.dataset.clears = node.clears.map((text) => context.resolver.text(text)).join(", ");
  section.dataset.retains = node.retains.map((text) => context.resolver.text(text)).join(", ");
  return section;
}

function renderOffline<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "offline" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const section = keyed(context.document, "section", node.id);
  section.className = "e308-offline";
  section.dataset.elapsedMs = String(node.elapsedMs);
  section.dataset.processedMs = String(node.processedMs);
  section.dataset.pendingMs = String(node.pendingMs);
  section.dataset.discardedMs = String(node.discardedMs);
  section.append(context.document.createTextNode(context.resolver.text(node.policyLabel)));
  for (const line of node.gains)
    section.append(renderQuantity(context.document, line, context.resolver));
  return section;
}

function renderSave<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "save" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const section = keyed(context.document, "section", node.id);
  section.className = "e308-save";
  section.dataset.status = node.status;
  if (node.lastSavedAtMs !== undefined) section.dataset.lastSavedAtMs = String(node.lastSavedAtMs);
  if (node.message)
    section.append(context.document.createTextNode(context.resolver.text(node.message)));
  for (const action of [node.save, node.export, node.import, node.wipe]) {
    if (action)
      section.append(
        renderAction(
          context.document,
          action,
          context.resolver,
          context.dispatch,
          context.startHold,
        ),
      );
  }
  return section;
}

function renderGroup<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "stack" | "row" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const element = keyed(context.document, "div", node.id);
  element.className = `e308-${node.kind}`;
  element.append(...context.renderMany(node.children));
  applyStyle(element, node.style);
  return element;
}

function renderHeading<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "heading" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const heading = keyed(context.document, `h${node.level}`, node.id);
  heading.textContent = context.resolver.text(node.text);
  return heading;
}

function renderDescription<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "description" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const paragraph = keyed(context.document, "p", node.id);
  appendDescription(paragraph, node.content, context.resolver);
  return paragraph;
}

function renderImage<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "image" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLImageElement {
  const image = keyed(context.document, "img", node.id) as HTMLImageElement;
  image.src = node.src;
  image.alt = context.resolver.text(node.alt);
  applyStyle(image, node.style);
  return image;
}

function renderQuantities<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "quantities" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const list = keyed(context.document, "div", node.id);
  list.className = "e308-quantities";
  for (const line of node.lines)
    list.append(renderQuantity(context.document, line, context.resolver));
  return list;
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
