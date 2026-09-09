import type { Command, Snapshot } from "@e308/core";
import type { BrowserHost } from "@e308/core/browser";
import type { ViewSource } from "@e308/ux";

export class HostSource<N, Intent extends { readonly type: string }>
  implements ViewSource<Snapshot<N>, Intent, unknown>
{
  readonly #listeners = new Set<(snapshot: Snapshot<N>) => void>();

  constructor(
    readonly host: BrowserHost<N>,
    readonly command: (
      snapshot: Snapshot<N>,
      intent: Exclude<Intent, { readonly type: "advance" }>,
    ) => Command<N>,
  ) {
    host.subscribe(() => this.publish());
  }

  getSnapshot(): Snapshot<N> {
    return this.host.game.getSnapshot();
  }

  subscribe(listener: (snapshot: Snapshot<N>) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispatch(intent: Intent): unknown {
    const result =
      intent.type === "advance"
        ? this.host.game.advance(
            (intent as Intent & { readonly milliseconds: number }).milliseconds,
          )
        : this.host.dispatch((snapshot) =>
            this.command(snapshot, intent as Exclude<Intent, { readonly type: "advance" }>),
          );
    this.publish();
    return result;
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
