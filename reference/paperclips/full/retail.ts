export interface RetailState {
  readonly demand: number;
  readonly funds: number;
  readonly margin: number;
  readonly unsoldClips: number;
  readonly wireBasePrice: number;
  readonly wireCost: number;
  readonly wirePriceCounter: number;
  readonly wirePriceTimer: number;
}

export interface RetailDraws {
  readonly sale: number;
  readonly wire: number;
}

export function advanceRetailTick(state: RetailState, draws: RetailDraws): RetailState {
  const wire = adjustWirePrice(state, draws.wire);
  if (draws.sale >= state.demand / 100 || state.unsoldClips <= 0) return wire;
  return sellClips(wire, Math.floor(0.7 * state.demand ** 1.15));
}

function adjustWirePrice(state: RetailState, draw: number): RetailState {
  let wireBasePrice = state.wireBasePrice;
  let wirePriceTimer = state.wirePriceTimer + 1;
  if (wirePriceTimer > 250 && wireBasePrice > 15) {
    wireBasePrice -= wireBasePrice / 1_000;
    wirePriceTimer = 0;
  }
  if (draw >= 0.015) return { ...state, wireBasePrice, wirePriceTimer };
  const wirePriceCounter = state.wirePriceCounter + 1;
  return {
    ...state,
    wireBasePrice,
    wireCost: Math.ceil(wireBasePrice + 6 * Math.sin(wirePriceCounter)),
    wirePriceCounter,
    wirePriceTimer,
  };
}

function sellClips(state: RetailState, demanded: number): RetailState {
  if (demanded > state.unsoldClips) {
    const transaction = Math.floor(state.unsoldClips * state.margin * 1_000) / 1_000;
    return { ...state, funds: state.funds + transaction, unsoldClips: 0 };
  }
  const transaction = Math.floor(demanded * state.margin * 1_000) / 1_000;
  return {
    ...state,
    funds: Math.floor((state.funds + transaction) * 100) / 100,
    unsoldClips: state.unsoldClips - demanded,
  };
}
