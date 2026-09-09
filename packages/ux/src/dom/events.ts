type EventCallback = (event: Event) => void;

interface EventBinding {
  callback: EventCallback;
  readonly listener: EventListener;
}

const bindings = new WeakMap<EventTarget, Map<string, EventBinding>>();

export function bindEvent<EventType extends Event>(
  target: EventTarget,
  type: string,
  callback: (event: EventType) => void,
): void {
  const binding: EventBinding = {
    callback: callback as EventCallback,
    listener: (event) => binding.callback(event),
  };
  const targetBindings = bindings.get(target) ?? new Map<string, EventBinding>();
  targetBindings.set(type, binding);
  bindings.set(target, targetBindings);
  target.addEventListener(type, binding.listener);
}

export function refreshEvents(current: EventTarget, next: EventTarget): void {
  const currentBindings = bindings.get(current);
  const nextBindings = bindings.get(next);
  if (!nextBindings) {
    if (currentBindings) {
      for (const [type, binding] of currentBindings)
        current.removeEventListener(type, binding.listener);
      bindings.delete(current);
    }
    return;
  }
  const retained = currentBindings ?? new Map<string, EventBinding>();
  for (const [type, binding] of retained) {
    if (!nextBindings.has(type)) {
      current.removeEventListener(type, binding.listener);
      retained.delete(type);
    }
  }
  for (const [type, nextBinding] of nextBindings) {
    next.removeEventListener(type, nextBinding.listener);
    const existing = retained.get(type);
    if (existing) existing.callback = nextBinding.callback;
    else {
      retained.set(type, nextBinding);
      current.addEventListener(type, nextBinding.listener);
    }
  }
  bindings.set(current, retained);
}
