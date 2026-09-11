import type { TextResolver } from "../localization/types.js";
import type { ActionView } from "../view/models.js";
import type { ViewNode } from "../view/nodes.js";
import type { ControlOverride, RenderContext, VisualClock } from "./types.js";

export interface InternalRenderContext<Intent, N> extends RenderContext<Intent, N> {
  readonly open: Map<string, boolean>;
  readonly tabs: Map<string, string>;
  readonly claimed: Set<string>;
  readonly clock: VisualClock;
  readonly overrides: Partial<Record<ViewNode<Intent, N>["kind"], ControlOverride<Intent, N>>>;
  readonly resolver: TextResolver<N>;
  readonly idPrefix: string;
  readonly renderDisposers: (() => void)[];
  readonly startHold: (hold: NonNullable<ActionView<Intent>["hold"]>, event: PointerEvent) => void;
  renderMany(nodes: readonly ViewNode<Intent, N>[]): Node[];
  requestRender(): void;
  requestFeedbackFocus(id: string): void;
  clearFeedbackFocus(id: string): void;
  takeFocusRequest(): string | undefined;
}
