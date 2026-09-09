export interface AutomaticProductionState {
  readonly clips: number;
  readonly funds: number;
  readonly unsoldClips: number;
  readonly wire: number;
  readonly wireBasePrice: number;
  readonly wirePriceTimer: number;
}

export interface AutomaticProductionConfig {
  readonly autoPerTick: number;
  readonly megaPerTick: number;
  readonly wireBuyer: boolean;
  readonly wireCost: number;
  readonly wireSupply: number;
}

export function advanceAutomaticTick(
  state: AutomaticProductionState,
  config: AutomaticProductionConfig,
): AutomaticProductionState {
  let current = buyWireWhenEmpty(state, config);
  current = makeClips(current, config.autoPerTick);
  return makeClips(current, config.megaPerTick);
}

function buyWireWhenEmpty(
  state: AutomaticProductionState,
  config: AutomaticProductionConfig,
): AutomaticProductionState {
  if (!config.wireBuyer || state.wire > 1 || state.funds < config.wireCost) return state;
  return {
    ...state,
    funds: state.funds - config.wireCost,
    wire: state.wire + config.wireSupply,
    wireBasePrice: state.wireBasePrice + 0.05,
    wirePriceTimer: 0,
  };
}

function makeClips(state: AutomaticProductionState, requested: number): AutomaticProductionState {
  if (state.wire < 1) return state;
  const produced = Math.min(requested, state.wire);
  return {
    ...state,
    clips: state.clips + produced,
    unsoldClips: state.unsoldClips + produced,
    wire: state.wire - produced,
  };
}
