import {
  type Command,
  createGame,
  createGameKit,
  marketCommand,
  nativeNumbers,
  quoteMarket,
} from "../../packages/core/src/index.js";

export function createWireworks() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const retail = kit.scope("retail");
  const industry = kit.scope("industry");
  const wire = kit.resource("wire", { scope: retail, initial: 20 });
  const inventory = kit.resource("inventory", { scope: retail, initial: 0 });
  const cash = kit.resource("cash", { scope: retail, initial: 100 });
  const price = kit.resource("price", { scope: retail, initial: 3 });
  const demand = kit.resource("demand", { scope: retail, initial: 2 });
  const matter = kit.resource("matter", { scope: industry, initial: 5 });
  const power = kit.resource("power", { scope: industry, initial: 2 });
  const industrialWire = kit.resource("industrial-wire", { scope: industry, initial: 0 });
  const manufacturing = kit.flow("clipper", {
    scope: retail,
    rate: kit.rates.constant(4),
    consumes: [[wire, 1]],
    produces: [[inventory, 1]],
  });
  const sales = kit.market("sales", {
    scope: retail,
    inventory,
    currency: cash,
    price: { kind: "marginal", price: ({ get }) => get(price) },
    feeRate: 0,
    feeRounding: "none",
    maximumQuantity: 100,
  });
  const grid = kit.allocation("grid", { scope: industry, budget: power, targets: ["extruder"] });
  const extruder = kit.flow("extruder", {
    scope: industry,
    rate: kit.rates.allocated(grid, "extruder", 2),
    consumes: [[matter, 1]],
    produces: [[industrialWire, 3]],
  });
  const project = kit.upgrade("industrialize", {
    scope: retail,
    costs: [[cash, 100]],
    prerequisiteIds: ["cash:100"],
    unlocked: (state) => state.get(cash) >= 100,
  });
  const retailActive = kit.scopeActivation("retail-phase", {
    scope: retail,
    active: (state) => !state.hasUpgrade(project.id),
  });
  const industryActive = kit.scopeActivation("industry-phase", {
    scope: industry,
    active: (state) => state.hasUpgrade(project.id),
  });
  const definition = kit.defineGame({
    id: "wireworks-reference",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [wire, inventory, cash, price, demand, matter, power, industrialWire],
    flows: [manufacturing, extruder],
    allocations: [grid],
    upgrades: [project],
    scopeActivations: [retailActive, industryActive],
    markets: [sales],
  });
  const game = createGame(definition);
  return {
    game,
    definition,
    retail,
    industry,
    manufacturing,
    extruder,
    grid,
    project,
    sales,
    resources: { wire, inventory, cash, price, demand, matter, power, industrialWire },
  };
}

export type Wireworks = ReturnType<typeof createWireworks>;

export function saleCommand(model: Wireworks): Command<number> {
  const snapshot = model.game.getSnapshot();
  const quantity = Math.min(
    snapshot.resources.inventory as number,
    Math.floor(snapshot.resources.demand as number),
  );
  const quote = quoteMarket(model.sales, snapshot, "sell", quantity, nativeNumbers);
  if (!quote.ok)
    return { id: "sale-unavailable", execute: (transaction) => transaction.reject(quote.error) };
  return marketCommand(model.sales, quote.value);
}
