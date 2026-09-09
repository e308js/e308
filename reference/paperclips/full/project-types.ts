export interface PaperclipsProject {
  readonly id: string;
  readonly title: string;
  readonly operations?: number;
  readonly creativity?: number;
  readonly yomi?: number;
  readonly funds?: number;
  readonly trustCost?: number;
  readonly clips?: number;
  readonly prerequisites: readonly string[];
  readonly trigger?: PaperclipsProjectTrigger;
  readonly repeatable?: boolean;
  readonly persistent?: boolean;
  readonly effect: PaperclipsProjectEffect;
}

export type PaperclipsProjectTrigger =
  | { readonly kind: "resource"; readonly id: string; readonly minimum: number }
  | { readonly kind: "purchase"; readonly id: string; readonly minimum: number }
  | { readonly kind: "purchase-total"; readonly ids: readonly string[]; readonly minimum: number };

export type PaperclipsProjectEffect =
  | { readonly kind: "clipper-boost"; readonly amount: number; readonly target: "auto" | "mega" }
  | { readonly kind: "wire-supply"; readonly multiplier: number }
  | { readonly kind: "wire-refill"; readonly repeatable: boolean }
  | { readonly kind: "trust"; readonly amount: number; readonly stockGain?: number }
  | { readonly kind: "marketing"; readonly multiplier: number }
  | { readonly kind: "demand"; readonly multiplier: number; readonly trust: number }
  | { readonly kind: "goodwill"; readonly repeatable: boolean }
  | { readonly kind: "photonic-chip" }
  | { readonly kind: "strategy"; readonly strategy: string }
  | { readonly kind: "theory-of-mind" }
  | { readonly kind: "drone-rate"; readonly multiplier: number }
  | { readonly kind: "drone-cohesion"; readonly multiplier: number }
  | {
      readonly kind: "unlock";
      readonly system:
        | "creativity"
        | "strategy"
        | "investment"
        | "mega"
        | "wire-buyer"
        | "quantum"
        | "hypnodrones"
        | "revtracker"
        | "auto-tourney";
    }
  | { readonly kind: "transition" }
  | { readonly kind: "industry" }
  | { readonly kind: "space" }
  | { readonly kind: "ending" };

export function project(
  id: string,
  title: string,
  options: Omit<PaperclipsProject, "id" | "title" | "prerequisites"> & {
    readonly prerequisites?: readonly string[];
  },
): PaperclipsProject {
  return Object.freeze({
    id,
    title,
    prerequisites: Object.freeze([...(options.prerequisites ?? [])]),
    ...options,
  });
}
