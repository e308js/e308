export type ActionBlocker =
  | { readonly kind: "insufficient"; readonly resource: string }
  | { readonly kind: "locked" }
  | { readonly kind: "cooldown"; readonly remainingMs: number }
  | { readonly kind: "invalid-count" };

export interface ActionView {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly blockers: readonly ActionBlocker[];
}
