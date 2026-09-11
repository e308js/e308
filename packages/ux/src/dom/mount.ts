import type { ActionView } from "../view/models.js";
import type { HotkeyView, ViewDocument } from "../view/nodes.js";
import { dismissOutsideHelp } from "./help.js";
import { observeHelpHover } from "./help-hover.js";
import { observeHelpPosition, positionOpenHelp } from "./help-position.js";
import type { InternalRenderContext } from "./internal.js";
import { reconcileChildren } from "./reconcile.js";
import { renderNode } from "./render-node.js";
import type { MountViewOptions, ViewMount, VisualClock } from "./types.js";

interface FocusState {
  readonly key: string;
  readonly start?: number | null;
  readonly end?: number | null;
}

let mountSequence = 0;

interface RangeGestureController {
  active(): HTMLInputElement | undefined;
  dispose(): void;
}

export function mountView<State, Intent, N>(
  root: HTMLElement,
  options: MountViewOptions<State, Intent, N>,
): ViewMount {
  let disposed = false;
  let rendering = false;
  let ranges!: RangeGestureController;
  let view = options.project(options.source.getSnapshot());
  const renderDisposers: (() => void)[] = [];
  const dispatch = (intent: Intent): unknown => {
    const result = options.source.dispatch(intent);
    options.onDispatchResult?.(result, intent);
    return result;
  };
  const hold = createHoldController(root.ownerDocument, dispatch);
  const context = createContext(
    root,
    options,
    dispatch,
    hold.start,
    renderDisposers,
    `e308-mount-${mountSequence++}`,
    () => render(),
  );
  const render = (): void => {
    if (disposed || rendering) return;
    rendering = true;
    const focus = captureFocus(root);
    for (const dispose of renderDisposers.splice(0)) dispose();
    reconcileChildren(root, context.renderMany(view.content), ranges.active());
    if (view.title) root.setAttribute("aria-label", options.resolver.text(view.title));
    else root.removeAttribute("aria-label");
    wireRelationships(root);
    restoreFocus(root, focus);
    const requestedFocus = context.takeFocusRequest();
    if (requestedFocus) {
      const candidate = Array.from(root.querySelectorAll<HTMLElement>("[data-e308-key]")).find(
        (element) => element.dataset.e308Key === requestedFocus,
      );
      candidate?.focus({ preventScroll: true });
    }
    positionOpenHelp(root);
    rendering = false;
  };
  ranges = createRangeGestureController(root, render);
  const unsubscribe = options.source.subscribe((snapshot) => {
    view = options.project(snapshot);
    render();
  });
  const keydown = (event: KeyboardEvent): void => {
    dismissOutsideHelp(root, event, context);
    dispatchHotkey(event, view, dispatch);
  };
  root.ownerDocument.addEventListener("keydown", keydown);
  root.ownerDocument.addEventListener("pointerup", hold.stop);
  root.ownerDocument.addEventListener("pointercancel", hold.stop);
  const stopPositioning = observeHelpPosition(root);
  const stopHelpHover = observeHelpHover(root, context.helpPreviews, (details) => {
    details.open = false;
    context.open.set(details.dataset.e308Key ?? "", false);
    details.querySelector("summary")?.setAttribute("aria-expanded", "false");
  });
  render();
  return {
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      stopPositioning();
      stopHelpHover();
      root.ownerDocument.removeEventListener("keydown", keydown);
      ranges.dispose();
      root.ownerDocument.removeEventListener("pointerup", hold.stop);
      root.ownerDocument.removeEventListener("pointercancel", hold.stop);
      hold.stop();
      for (const dispose of renderDisposers.splice(0)) dispose();
      root.replaceChildren();
    },
  };
}

function wireRelationships(root: HTMLElement): void {
  for (const feedback of Array.from(root.querySelectorAll<HTMLElement>("[data-feedback-for]"))) {
    const targetId = feedback.dataset.feedbackFor;
    if (!targetId || !feedback.id) continue;
    const target = relationshipTarget(root, targetId);
    if (!target) continue;
    const describedBy = new Set(
      (target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean),
    );
    describedBy.add(feedback.id);
    target.setAttribute("aria-describedby", [...describedBy].join(" "));
  }
  for (const help of Array.from(root.querySelectorAll<HTMLElement>("[data-help-for]"))) {
    const targetId = help.dataset.helpFor;
    const content = help.querySelector<HTMLElement>(".e308-help-content");
    if (!targetId || !content?.id) continue;
    relationshipTarget(root, targetId)?.setAttribute("aria-details", content.id);
  }
}

function relationshipTarget(root: HTMLElement, targetId: string): HTMLElement | undefined {
  const byId = root.ownerDocument.getElementById(targetId);
  if (byId instanceof HTMLElement && root.contains(byId)) return byId;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-action], [data-e308-key]")).find(
    (candidate) => candidate.dataset.action === targetId || candidate.dataset.e308Key === targetId,
  );
}

function createRangeGestureController(
  root: HTMLElement,
  render: () => void,
): RangeGestureController {
  const document = root.ownerDocument;
  let active: HTMLInputElement | undefined;
  let release: number | undefined;
  const pointerdown = (event: PointerEvent): void => {
    if (event.target instanceof HTMLInputElement && event.target.type === "range")
      active = event.target;
  };
  const pointerup = (): void => {
    if (!active || !document.defaultView) return;
    release = document.defaultView.setTimeout(() => {
      active = undefined;
      release = undefined;
      render();
    }, 0);
  };
  const pointercancel = (): void => {
    active = undefined;
    render();
  };
  root.addEventListener("pointerdown", pointerdown);
  document.addEventListener("pointerup", pointerup);
  document.addEventListener("pointercancel", pointercancel);
  return {
    active: () => active,
    dispose() {
      root.removeEventListener("pointerdown", pointerdown);
      document.removeEventListener("pointerup", pointerup);
      document.removeEventListener("pointercancel", pointercancel);
      if (release !== undefined) document.defaultView?.clearTimeout(release);
    },
  };
}

function createContext<State, Intent, N>(
  root: HTMLElement,
  options: MountViewOptions<State, Intent, N>,
  dispatch: (intent: Intent) => unknown,
  startHold: (hold: NonNullable<ActionView<Intent>["hold"]>) => void,
  renderDisposers: (() => void)[],
  idPrefix: string,
  requestRender: () => void,
): InternalRenderContext<Intent, N> {
  const focusedFeedback = new Set<string>();
  const focusRequests: string[] = [];
  const context: InternalRenderContext<Intent, N> = {
    document: root.ownerDocument,
    resolver: options.resolver,
    idPrefix,
    dispatch,
    reducedMotion: options.reducedMotion ?? reducedMotion(root.ownerDocument),
    clock: options.visualClock ?? browserVisualClock(root.ownerDocument),
    overrides: options.overrides ?? {},
    open: new Map(),
    helpPreviews: new Map(),
    tabs: new Map(),
    claimed: new Set(),
    renderDisposers,
    startHold,
    requestRender,
    requestFeedbackFocus(id) {
      if (focusedFeedback.has(id)) return;
      focusedFeedback.add(id);
      focusRequests.push(id);
    },
    clearFeedbackFocus(id) {
      focusedFeedback.delete(id);
    },
    takeFocusRequest: () => focusRequests.shift(),
    render: (node) => renderNode(node, context),
    renderMany(nodes) {
      return nodes
        .map((node) => context.render(node))
        .filter((node): node is Node => node !== undefined);
    },
  };
  return context;
}

function createHoldController<Intent>(
  document: Document,
  dispatch: (intent: Intent) => unknown,
): {
  readonly start: (hold: NonNullable<ActionView<Intent>["hold"]>) => void;
  readonly stop: () => void;
} {
  const window = document.defaultView;
  if (!window) throw new TypeError("renderer document must have a window");
  let delay: number | undefined;
  let repeat: number | undefined;
  const stop = (): void => {
    if (delay !== undefined) window.clearTimeout(delay);
    if (repeat !== undefined) window.clearInterval(repeat);
    delay = undefined;
    repeat = undefined;
  };
  return {
    stop,
    start(hold) {
      stop();
      delay = window.setTimeout(() => {
        dispatch(hold.intent);
        repeat = window.setInterval(() => dispatch(hold.intent), hold.repeatMs ?? 100);
      }, hold.delayMs ?? 300);
    },
  };
}

function captureFocus(root: HTMLElement): FocusState | undefined {
  const active = root.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return undefined;
  const keyed = active.closest<HTMLElement>("[data-e308-key]");
  if (!keyed?.dataset.e308Key) return undefined;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return {
      key: active.dataset.e308Key ?? keyed.dataset.e308Key,
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }
  return { key: keyed.dataset.e308Key };
}

function restoreFocus(root: HTMLElement, focus: FocusState | undefined): void {
  if (!focus) return;
  const candidate = Array.from(root.querySelectorAll<HTMLElement>("[data-e308-key]")).find(
    (element) => element.dataset.e308Key === focus.key,
  );
  if (candidate !== root.ownerDocument.activeElement) candidate?.focus({ preventScroll: true });
  if (
    (candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) &&
    focus.start !== undefined &&
    focus.start !== null
  ) {
    candidate.setSelectionRange(focus.start, focus.end ?? focus.start);
  }
}

function dispatchHotkey<Intent, N>(
  event: KeyboardEvent,
  view: ViewDocument<Intent, N>,
  dispatch: (intent: Intent) => unknown,
): void {
  if (event.defaultPrevented || isTypingTarget(event.target)) return;
  const scopes = new Set(view.activeScopeIds ?? []);
  const hotkey = view.hotkeys?.find((item) => hotkeyMatches(item, event, scopes));
  if (!hotkey) return;
  event.preventDefault();
  dispatch(hotkey.intent);
}

function hotkeyMatches<Intent>(
  hotkey: HotkeyView<Intent>,
  event: KeyboardEvent,
  scopes: ReadonlySet<string>,
): boolean {
  if (!hotkey.enabled || hotkey.key.toLowerCase() !== event.key.toLowerCase()) return false;
  if (hotkey.scopeId && !scopes.has(hotkey.scopeId)) return false;
  const modifiers = new Set(hotkey.modifiers ?? []);
  return (
    event.altKey === modifiers.has("alt") &&
    event.ctrlKey === modifiers.has("ctrl") &&
    event.metaKey === modifiers.has("meta") &&
    event.shiftKey === modifiers.has("shift")
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function reducedMotion(document: Document): boolean {
  return document.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function browserVisualClock(document: Document): VisualClock {
  const window = document.defaultView;
  if (!window) throw new TypeError("renderer document must have a window");
  return {
    now: () => window.performance.now(),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
  };
}
