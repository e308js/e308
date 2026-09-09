import type { TextResolver } from "../localization/types.js";
import type { ViewDocument, ViewNode } from "../view/nodes.js";

export interface VisualClock {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
}

export interface RenderContext<Intent, N> {
  readonly document: Document;
  readonly resolver: TextResolver<N>;
  readonly dispatch: (intent: Intent) => unknown;
  readonly reducedMotion: boolean;
  render(node: ViewNode<Intent, N>): Node | undefined;
}

export type ControlOverride<Intent, N> = (
  node: ViewNode<Intent, N>,
  context: RenderContext<Intent, N>,
) => Node | undefined;

export interface MountViewOptions<State, Intent, N> {
  readonly source: {
    getSnapshot(): State;
    subscribe(listener: (snapshot: State) => void): () => void;
    dispatch(intent: Intent): unknown;
  };
  readonly project: (state: State) => ViewDocument<Intent, N>;
  readonly resolver: TextResolver<N>;
  readonly overrides?: Partial<Record<ViewNode<Intent, N>["kind"], ControlOverride<Intent, N>>>;
  readonly reducedMotion?: boolean;
  readonly visualClock?: VisualClock;
  readonly onDispatchResult?: (result: unknown, intent: Intent) => void;
}

export interface ViewMount {
  render(): void;
  dispose(): void;
}
