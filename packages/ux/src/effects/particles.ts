import { bindEvent } from "../dom/events.js";
import type { VisualClock } from "../dom/types.js";
import type { TextValue } from "../localization/types.js";
import type { ParticleView } from "../view/nodes.js";

export interface ParticleRenderOptions<Intent, N> {
  readonly document: Document;
  readonly particles: readonly ParticleView<Intent, N>[];
  readonly reducedMotion: boolean;
  readonly clock: VisualClock;
  readonly claimed: Set<string>;
  readonly text: (value: TextValue<N>) => string;
  readonly dispatch: (intent: Intent) => unknown;
  readonly dispose: (callback: () => void) => void;
}

export function renderParticleLayer<Intent, N>(
  id: string,
  options: ParticleRenderOptions<Intent, N>,
): HTMLElement {
  const layer = options.document.createElement("div");
  layer.className = "e308-particles";
  layer.dataset.e308Key = id;
  const moving: { element: HTMLElement; view: ParticleView<Intent, N> }[] = [];
  for (const view of options.particles) {
    if (view.claimed || (view.claimId && options.claimed.has(view.claimId))) continue;
    const element = particleElement(view, options);
    layer.append(element);
    moving.push({ element, view });
  }
  if (!options.reducedMotion && moving.length > 0) animate(moving, options);
  else layer.dataset.reducedMotion = String(options.reducedMotion);
  return layer;
}

function particleElement<Intent, N>(
  view: ParticleView<Intent, N>,
  options: ParticleRenderOptions<Intent, N>,
): HTMLElement {
  const interactive =
    view.intent !== undefined || view.hoverIntent !== undefined || view.leaveIntent !== undefined;
  const element = options.document.createElement(interactive ? "button" : "span");
  if (interactive) (element as HTMLButtonElement).type = "button";
  element.className = "e308-particle";
  element.dataset.particle = view.id;
  element.style.position = "absolute";
  element.style.left = `${view.x}px`;
  element.style.top = `${view.y}px`;
  element.style.width = `${view.size}px`;
  element.style.height = `${view.size}px`;
  if (view.fade) element.style.opacity = "1";
  if (view.imageUrl) {
    const image = options.document.createElement("img");
    image.src = view.imageUrl;
    image.alt = view.label ? options.text(view.label) : "";
    element.append(image);
  } else if (view.label) element.textContent = options.text(view.label);
  bindParticle(element, view, options);
  return element;
}

function bindParticle<Intent, N>(
  element: HTMLElement,
  view: ParticleView<Intent, N>,
  options: ParticleRenderOptions<Intent, N>,
): void {
  if (view.intent !== undefined) {
    bindEvent<MouseEvent>(element, "click", () => {
      if (view.claimId && options.claimed.has(view.claimId)) return;
      if (view.claimId) options.claimed.add(view.claimId);
      options.dispatch(view.intent as Intent);
      if (view.claimId) element.remove();
    });
  }
  if (view.hoverIntent !== undefined) {
    bindEvent<MouseEvent>(element, "mouseenter", () =>
      options.dispatch(view.hoverIntent as Intent),
    );
  }
  if (view.leaveIntent !== undefined) {
    bindEvent<MouseEvent>(element, "mouseleave", () =>
      options.dispatch(view.leaveIntent as Intent),
    );
  }
}

function animate<Intent, N>(
  particles: readonly { element: HTMLElement; view: ParticleView<Intent, N> }[],
  options: ParticleRenderOptions<Intent, N>,
): void {
  const start = options.clock.now();
  let frame = 0;
  const update = (time: number): void => {
    let active = false;
    for (const { element, view } of particles) {
      const elapsed = Math.max(0, time - start);
      if (elapsed >= view.lifetimeMs) {
        element.remove();
        continue;
      }
      active = true;
      const seconds = elapsed / 1_000;
      const x = (view.velocityX ?? 0) * seconds;
      const y = (view.velocityY ?? 0) * seconds + ((view.gravity ?? 0) * seconds ** 2) / 2;
      element.style.transform = `translate(${x}px, ${y}px) rotate(${view.rotation ?? 0}deg)`;
      if (view.fade) element.style.opacity = String(1 - elapsed / view.lifetimeMs);
    }
    if (active) frame = options.clock.requestFrame(update);
  };
  frame = options.clock.requestFrame(update);
  options.dispose(() => options.clock.cancelFrame(frame));
}
