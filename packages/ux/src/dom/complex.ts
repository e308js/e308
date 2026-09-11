import type { TextValue } from "../localization/types.js";
import type { GridCellView, TabView, TreeNodeView, ViewNode } from "../view/nodes.js";
import { appendMark, applyStyle, keyed, renderAction } from "./elements.js";
import { bindEvent } from "./events.js";
import type { InternalRenderContext } from "./internal.js";

export function renderProgress<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "progress" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const outer = keyed(context.document, "div", node.id);
  outer.className = "e308-progress";
  outer.dataset.direction = node.direction;
  outer.setAttribute("role", "progressbar");
  const value = Math.max(0, Math.min(1, node.value));
  outer.setAttribute("aria-valuenow", String(value * 100));
  outer.setAttribute("aria-label", context.resolver.text(node.label));
  const fill = context.document.createElement("span");
  fill.className = "e308-progress-fill";
  fill.style.setProperty("--e308-progress", String(value));
  fill.dataset.animated = String(node.animated === true && !context.reducedMotion);
  const label = context.document.createElement("span");
  label.className = "e308-progress-label";
  label.textContent = context.resolver.text(node.label);
  outer.append(fill, label);
  applyStyle(outer, node.style);
  return outer;
}

export function renderInfobox<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "infobox" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const details = keyed(context.document, "details", node.id) as HTMLDetailsElement;
  details.className = "e308-infobox";
  details.open = context.open.get(node.id) ?? node.initiallyOpen ?? false;
  bindEvent<Event>(details, "toggle", (event) =>
    context.open.set(node.id, (event.currentTarget as HTMLDetailsElement).open),
  );
  const summary = context.document.createElement("summary");
  summary.textContent = context.resolver.text(node.title);
  details.append(summary, ...context.renderMany(node.content));
  return details;
}

export function renderTabs<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "tabs" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const visible = node.tabs.filter((tab) => !tab.hidden);
  const requested = context.tabs.get(node.id) ?? node.activeId;
  const active =
    visible.find((tab) => tab.id === requested && !tab.disabled) ??
    visible.find((tab) => !tab.disabled);
  const section = keyed(context.document, "section", node.id);
  section.className = "e308-tabs";
  const list = context.document.createElement("div");
  list.setAttribute("role", "tablist");
  for (const tab of visible) list.append(tabButton(node.id, tab, active?.id, context));
  bindEvent<KeyboardEvent>(list, "keydown", (event) => {
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || current.getAttribute("role") !== "tab") return;
    const currentList = event.currentTarget as HTMLElement;
    const tabs = Array.from(
      currentList.querySelectorAll<HTMLButtonElement>("[role=tab]:not(:disabled)"),
    );
    const index = tabs.indexOf(current);
    let next: HTMLButtonElement | undefined;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs.at(-1);
    if (!next) return;
    event.preventDefault();
    next.focus();
    context.tabs.set(node.id, next.dataset.tab ?? "");
    context.requestRender();
  });
  section.append(list);
  if (active) {
    const panel = context.document.createElement("div");
    panel.id = `e308-panel-${node.id}-${active.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `${context.idPrefix}-tab-${node.id}-${active.id}`);
    panel.append(...context.renderMany(active.content));
    section.append(panel);
  }
  return section;
}

function tabButton<Intent, N>(
  tabsId: string,
  tab: TabView<Intent, N>,
  activeId: string | undefined,
  context: InternalRenderContext<Intent, N>,
): HTMLButtonElement {
  const button = context.document.createElement("button");
  button.type = "button";
  button.id = `${context.idPrefix}-tab-${tabsId}-${tab.id}`;
  button.dataset.e308Key = `tab:${tabsId}:${tab.id}`;
  button.setAttribute("role", "tab");
  button.disabled = tab.disabled ?? false;
  button.setAttribute("aria-selected", String(tab.id === activeId));
  button.tabIndex = tab.id === activeId ? 0 : -1;
  button.setAttribute("aria-controls", `e308-panel-${tabsId}-${tab.id}`);
  button.textContent = context.resolver.text(tab.label);
  button.dataset.tab = tab.id;
  bindEvent<MouseEvent>(button, "click", () => {
    context.tabs.set(tabsId, tab.id);
    context.requestRender();
  });
  return button;
}

export function renderGrid<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "grid" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const grid = keyed(context.document, "div", node.id);
  grid.className = "e308-grid";
  grid.setAttribute("role", "grid");
  grid.style.gridTemplateColumns = `repeat(${node.columns}, minmax(0, 1fr))`;
  grid.dataset.rows = String(node.rows);
  for (const cell of node.cells.filter((item) => !item.hidden))
    grid.append(gridCell(cell, context));
  return grid;
}

function gridCell<Intent, N>(
  cell: GridCellView<Intent, N>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const wrapper = keyed(context.document, "div", cell.id);
  wrapper.className = "e308-grid-cell";
  wrapper.dataset.variant = cell.variant ?? "square";
  wrapper.setAttribute("role", "gridcell");
  wrapper.style.gridRow = String(cell.row);
  wrapper.style.gridColumn = String(cell.column);
  const label = context.document.createElement("span");
  label.className = "e308-grid-cell-label";
  label.textContent = context.resolver.text(cell.label);
  wrapper.append(label);
  if (cell.action)
    wrapper.append(
      renderAction(
        context.document,
        cell.action,
        context.resolver,
        context.dispatch,
        context.startHold,
        `${context.idPrefix}-${cell.id}`,
      ),
    );
  appendMark(wrapper, cell.mark, context.resolver);
  return wrapper;
}

export function renderTree<Intent, N>(
  node: Extract<ViewNode<Intent, N>, { kind: "tree" }>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const tree = keyed(context.document, "div", node.id);
  tree.className = "e308-tree";
  const visible = new Map(node.nodes.filter((item) => !item.hidden).map((item) => [item.id, item]));
  tree.append(renderBranches(node.branches, visible, context.document));
  for (const view of visible.values()) tree.append(treeNode(view, context));
  return tree;
}

function treeNode<Intent, N>(
  node: TreeNodeView<Intent, N>,
  context: InternalRenderContext<Intent, N>,
): HTMLElement {
  const wrapper = keyed(context.document, "div", node.id);
  wrapper.className = "e308-tree-node";
  wrapper.style.left = `${node.x}px`;
  wrapper.style.top = `${node.y}px`;
  wrapper.dataset.ghost = String(node.ghost ?? false);
  wrapper.dataset.side = String(node.side ?? false);
  if (node.highlight) wrapper.dataset.highlight = node.highlight;
  if (node.action) {
    const action = renderAction(
      context.document,
      node.action,
      context.resolver,
      context.dispatch,
      context.startHold,
      `${context.idPrefix}-${node.id}`,
    );
    if (node.imageUrl) action.prepend(treeImage(node.imageUrl, node.label, context));
    wrapper.append(action);
  } else if (node.imageUrl) {
    wrapper.append(treeImage(node.imageUrl, node.label, context));
  } else wrapper.textContent = context.resolver.text(node.label);
  appendMark(wrapper, node.mark, context.resolver);
  applyStyle(wrapper, node.style);
  return wrapper;
}

function treeImage<Intent, N>(
  imageUrl: string,
  label: TextValue<N>,
  context: InternalRenderContext<Intent, N>,
): HTMLImageElement {
  const image = context.document.createElement("img");
  image.src = imageUrl;
  image.alt = context.resolver.text(label);
  return image;
}

function renderBranches<Intent, N>(
  branches: Extract<ViewNode<Intent, N>, { kind: "tree" }>["branches"],
  nodes: ReadonlyMap<string, TreeNodeView<Intent, N>>,
  document: Document,
): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("e308-tree-branches");
  for (const branch of branches) {
    const from = nodes.get(branch.from);
    const to = nodes.get(branch.to);
    if (!from || !to) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke", branch.color ?? "currentColor");
    line.setAttribute("stroke-width", String(branch.width ?? 2));
    if (branch.dashed) line.setAttribute("stroke-dasharray", "5 5");
    svg.append(line);
  }
  return svg;
}
