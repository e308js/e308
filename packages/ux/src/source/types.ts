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

export class GameViewSource<N, Intent, DispatchResult>
  implements ViewSource<Snapshot<N>, Intent, DispatchResult>
{
  constructor(
    readonly game: Game<N>,
    readonly dispatchIntent: (game: Game<N>, intent: Intent) => DispatchResult,
  ) {}

  getSnapshot(): Snapshot<N> {
    return this.game.getSnapshot();
  }

  subscribe(listener: (snapshot: Snapshot<N>) => void): () => void {
    return this.game.subscribe((snapshot) => snapshot, listener);
  }

  dispatch(intent: Intent): DispatchResult {
    return this.dispatchIntent(this.game, intent);
  }
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

import type { Game, Snapshot } from "@e308/core";
