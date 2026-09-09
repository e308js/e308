export type MessageArgument<N = unknown> =
  | string
  | number
  | boolean
  | { readonly kind: "quantity"; readonly value: N; readonly format?: string }
  | { readonly kind: "duration"; readonly ms: number; readonly clock: "game" | "real" };

export interface MessageToken<N = unknown> {
  readonly key: string;
  readonly args?: Readonly<Record<string, MessageArgument<N>>>;
}

export type TextValue<N = unknown> = string | MessageToken<N>;

export type DescriptionNode<N = unknown> =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "message"; readonly token: MessageToken<N> }
  | { readonly kind: "emphasis"; readonly children: readonly DescriptionNode<N>[] }
  | { readonly kind: "strong"; readonly children: readonly DescriptionNode<N>[] }
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "break" }
  | {
      readonly kind: "link";
      readonly href: string;
      readonly children: readonly DescriptionNode<N>[];
    };

export type MessageCatalog = Readonly<Record<string, string>>;

export interface TextResolver<N = unknown> {
  text(value: TextValue<N>): string;
  argument(value: MessageArgument<N>): string;
}
