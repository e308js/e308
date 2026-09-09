export interface ViewSource<State, Intent, DispatchResult = unknown> {
  getSnapshot(): State;
  subscribe(listener: (snapshot: State) => void): () => void;
  dispatch(intent: Intent): DispatchResult;
}

export interface SelectableSource<State, Intent, DispatchResult = unknown> {
  getSnapshot(): State;
  subscribe<Value>(
    selector: (snapshot: State) => Value,
    listener: (value: Value) => void,
    equal?: (left: Value, right: Value) => boolean,
  ): () => void;
  dispatch(intent: Intent): DispatchResult;
}

export function fromSelectableSource<State, Intent, DispatchResult>(
  source: SelectableSource<State, Intent, DispatchResult>,
): ViewSource<State, Intent, DispatchResult> {
  return {
    getSnapshot: () => source.getSnapshot(),
    subscribe: (listener) => source.subscribe((snapshot) => snapshot, listener),
    dispatch: (intent) => source.dispatch(intent),
  };
}

export function selectSource<State, Intent, Result, Value>(
  source: ViewSource<State, Intent, Result>,
  selector: (snapshot: State) => Value,
  listener: (value: Value) => void,
  equal: (left: Value, right: Value) => boolean = Object.is,
): () => void {
  let selected = selector(source.getSnapshot());
  return source.subscribe((snapshot) => {
    const next = selector(snapshot);
    if (equal(selected, next)) return;
    selected = next;
    listener(next);
  });
}
