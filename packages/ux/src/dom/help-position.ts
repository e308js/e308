/** Recompute after live renders, scrolling, resizing, and focus changes. */
export function positionOpenHelp(root: ParentNode): void {
  for (const details of Array.from(
    root.querySelectorAll<HTMLDetailsElement>(".e308-help-popover[open]"),
  ))
    positionHelp(details);
}

export function positionHelp(details: HTMLDetailsElement): void {
  const content = details.querySelector<HTMLElement>(".e308-help-content");
  const trigger = details.querySelector("summary");
  const document = details.ownerDocument;
  const window = document.defaultView;
  if (!details.open || !details.isConnected || !content || !trigger || !window) return;
  const viewport = window.visualViewport;
  const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
  const topEdge = (viewport?.offsetTop ?? 0) + 8;
  const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
  const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
  const anchor = trigger.getBoundingClientRect();
  content.style.position = "fixed";
  content.style.inset = "auto";
  content.style.width = `${Math.max(0, Math.min(352, rightEdge - leftEdge))}px`;
  const width = content.getBoundingClientRect().width;
  const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - width));
  content.style.left = `${left}px`;
  const above = Math.min(bottomEdge, anchor.top);
  const below = Math.max(topEdge, anchor.bottom);
  placeVertically(content, above, below, topEdge, bottomEdge);
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused !== document.body && !details.contains(focused)) {
    const rect = (focused.closest("label") ?? focused).getBoundingClientRect();
    const panel = content.getBoundingClientRect();
    if (
      rect.right > left &&
      rect.left < left + width &&
      rect.bottom > panel.top &&
      rect.top < panel.bottom
    ) {
      placeVertically(
        content,
        Math.min(above, rect.top - 4),
        Math.max(below, rect.bottom + 4),
        topEdge,
        bottomEdge,
      );
    }
  }
}

function placeVertically(
  content: HTMLElement,
  above: number,
  below: number,
  topEdge: number,
  bottomEdge: number,
): void {
  const roomAbove = Math.max(0, above - topEdge);
  const roomBelow = Math.max(0, bottomEdge - below);
  const useBelow = roomBelow >= Math.min(content.scrollHeight + 2, 240) || roomBelow >= roomAbove;
  content.style.maxHeight = `${useBelow ? roomBelow : roomAbove}px`;
  content.style.overflowY = "auto";
  content.style.top = `${useBelow ? Math.min(below, bottomEdge) : Math.max(topEdge, above - content.getBoundingClientRect().height)}px`;
}

export function observeHelpPosition(root: HTMLElement): () => void {
  const position = (): void => positionOpenHelp(root);
  const document = root.ownerDocument;
  const window = document.defaultView;
  window?.addEventListener("resize", position);
  window?.visualViewport?.addEventListener("resize", position);
  window?.visualViewport?.addEventListener("scroll", position);
  document.addEventListener("scroll", position, true);
  document.addEventListener("focusin", position);
  return () => {
    window?.removeEventListener("resize", position);
    window?.visualViewport?.removeEventListener("resize", position);
    window?.visualViewport?.removeEventListener("scroll", position);
    document.removeEventListener("scroll", position, true);
    document.removeEventListener("focusin", position);
  };
}
