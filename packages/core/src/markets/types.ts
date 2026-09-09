import type { Resource, Scope } from "../model/handles.js";

export type MarketSide = "buy" | "sell";
export type FeeRounding = "none" | "floor" | "ceil";

export interface MarketPriceContext<N> {
  readonly get: (resource: Resource<N>) => N;
  readonly side: MarketSide;
  readonly volume: N;
  readonly offset: number;
}

export type MarketPrice<N> =
  | { readonly kind: "fixed"; readonly buy: N; readonly sell: N }
  | { readonly kind: "marginal"; readonly price: (context: MarketPriceContext<N>) => N };

export interface MarketDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly inventory: Resource<N>;
  readonly currency: Resource<N>;
  readonly price: MarketPrice<N>;
  readonly feeRate: N;
  readonly feeRounding: FeeRounding;
  readonly maximumQuantity: number;
}

export interface MarketState<N> {
  readonly bought: N;
  readonly sold: N;
}

export interface MarketQuote<N> {
  readonly marketId: string;
  readonly side: MarketSide;
  readonly quantity: number;
  readonly gross: N;
  readonly fee: N;
  readonly settlement: N;
  readonly inventoryAfter: N;
  readonly volumeAfter: N;
  readonly revision: bigint;
}
