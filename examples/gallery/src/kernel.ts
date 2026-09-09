import type { ViewSource } from "@e308/ux";

export interface GalleryState {
  readonly revision: number;
  readonly points: number;
  readonly workers: number;
  readonly name: string;
  readonly claimedStar: boolean;
  readonly notifications: readonly string[];
}

export type GalleryIntent =
  | { readonly type: "gain" }
  | { readonly type: "hire" }
  | { readonly type: "name"; readonly value: string }
  | { readonly type: "claim-star" };

export class GalleryKernel implements ViewSource<GalleryState, GalleryIntent, boolean> {
  #state: GalleryState = {
    revision: 0,
    points: 12,
    workers: 1,
    name: "Workshop",
    claimedStar: false,
    notifications: [],
  };
  readonly #listeners = new Set<(state: GalleryState) => void>();

  getSnapshot(): GalleryState {
    return this.#state;
  }

  subscribe(listener: (state: GalleryState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispatch(intent: GalleryIntent): boolean {
    const next = reduce(this.#state, intent);
    if (next === this.#state) return false;
    this.#state = next;
    for (const listener of this.#listeners) listener(next);
    return true;
  }
}

function reduce(state: GalleryState, intent: GalleryIntent): GalleryState {
  if (intent.type === "gain") return changed(state, { points: state.points + state.workers });
  if (intent.type === "hire" && state.points >= 10) {
    return changed(state, { points: state.points - 10, workers: state.workers + 1 });
  }
  if (intent.type === "name") return changed(state, { name: intent.value });
  if (intent.type === "claim-star" && !state.claimedStar) {
    return changed(state, {
      points: state.points + 25,
      claimedStar: true,
      notifications: [...state.notifications, "Star claimed once"],
    });
  }
  return state;
}

function changed(
  state: GalleryState,
  fields: Partial<Omit<GalleryState, "revision">>,
): GalleryState {
  return Object.freeze({ ...state, ...fields, revision: state.revision + 1 });
}
