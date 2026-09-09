import { refreshEvents } from "./events.js";

export function reconcileChildren(
  parent: ParentNode,
  desired: readonly Node[],
  preserveValue?: HTMLInputElement,
): void {
  for (let index = 0; index < desired.length; index += 1) {
    const next = desired[index] as Node;
    const current = matchingChild(parent, next, index);
    if (!current) {
      parent.insertBefore(next, parent.childNodes[index] ?? null);
      continue;
    }
    if (parent.childNodes[index] !== current)
      parent.insertBefore(current, parent.childNodes[index] ?? null);
    patchNode(current, next, preserveValue);
  }
  while (parent.childNodes.length > desired.length) parent.lastChild?.remove();
}

function matchingChild(parent: ParentNode, next: Node, index: number): Node | undefined {
  const key = nodeKey(next);
  if (key)
    return Array.from(parent.childNodes).find(
      (candidate) => nodeKey(candidate) === key && compatible(candidate, next),
    );
  const candidate = parent.childNodes[index];
  return candidate && !nodeKey(candidate) && compatible(candidate, next) ? candidate : undefined;
}

function patchNode(current: Node, next: Node, preserveValue?: HTMLInputElement): void {
  if (current.nodeType === 3 && next.nodeType === 3) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  if (!(current instanceof HTMLElement) || !(next instanceof HTMLElement)) {
    current.parentNode?.replaceChild(next, current);
    return;
  }
  if (next.classList.contains("e308-particles")) {
    current.parentNode?.replaceChild(next, current);
    return;
  }
  syncAttributes(current, next);
  refreshEvents(current, next);
  reconcileChildren(current, Array.from(next.childNodes), preserveValue);
  syncProperties(current, next, preserveValue);
}

function syncAttributes(current: HTMLElement, next: HTMLElement): void {
  for (const attribute of Array.from(current.attributes)) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of Array.from(next.attributes)) {
    if (current.getAttribute(attribute.name) !== attribute.value)
      current.setAttribute(attribute.name, attribute.value);
  }
}

function syncProperties(
  current: HTMLElement,
  next: HTMLElement,
  preserveValue?: HTMLInputElement,
): void {
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    if (current !== preserveValue && current.value !== next.value) current.value = next.value;
    current.checked = next.checked;
    current.disabled = next.disabled;
  } else if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    current.value = next.value;
    current.disabled = next.disabled;
  } else if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
    current.open = next.open;
  } else if (current instanceof HTMLButtonElement && next instanceof HTMLButtonElement) {
    current.disabled = next.disabled;
  }
}

function compatible(current: Node, next: Node): boolean {
  return current.nodeType === next.nodeType && current.nodeName === next.nodeName;
}

function nodeKey(node: Node): string | undefined {
  return node instanceof HTMLElement ? node.dataset.e308Key : undefined;
}
