import {
  allocationCommand,
  automationCommand,
  buyCommand,
  completeChallengeCommand,
  createGame,
  createGameKit,
  enterChallengeCommand,
  geometricCurve,
  nativeNumbers,
  resolveEntitlement,
  upgradeCommand,
} from "../../packages/core/src/index.js";

export function persistenceFixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const account = kit.scope("account");
  const points = kit.resource("points", { scope: run, initial: 10 });
  const gems = kit.resource("gems", { scope: account, initial: 1 });
  const machine = kit.buyable("machine", {
    scope: run,
    currency: points,
    curve: geometricCurve(nativeNumbers, { base: 2, ratio: 2 }),
  });
  const workers = kit.allocation("workers", {
    scope: run,
    budget: points,
    targets: ["factory"],
  });
  const upgrade = kit.upgrade("boost", {
    scope: account,
    costs: [[gems, 1]],
    prerequisiteIds: [],
    unlocked: () => true,
  });
  const milestone = kit.milestone("started", {
    scope: run,
    when: (state) => state.get(points) >= 10,
  });
  const challenge = kit.challenge("trial", {
    scope: account,
    maxCompletions: 1,
    enterReset: { clear: [] },
    exitReset: { clear: [] },
    canEnter: () => true,
    completionsEarned: () => 1,
  });
  const automation = kit.automation("idle", {
    scope: account,
    cadenceMs: 200,
    initiallyEnabled: false,
    unlocked: () => true,
    condition: () => false,
    action: () => ({ id: "unused", execute: () => undefined }),
  });
  const income = kit.flow("income", {
    scope: run,
    rate: kit.rates.constant(2),
    produces: [[points, 1]],
  });
  const definition = kit.defineGame({
    id: "persistence-test",
    simulationVersion: 1,
    rootSeed: "0123456789abcdef",
    stepMs: 100,
    resources: [points, gems],
    flows: [income],
    buyables: [machine],
    allocations: [workers],
    upgrades: [upgrade],
    triggers: [milestone],
    challenges: [challenge],
    automation: [automation],
  });
  const game = createGame(definition);
  const configuration = {
    stateSchemaVersion: 1,
    contentVersion: "1.0.0",
    contentDigest: "fixture-v1",
  } as const;
  const entitlement = resolveEntitlement(
    {
      policyVersion: "1",
      enabled: true,
      cap: { kind: "duration", milliseconds: 8 * 60 * 60 * 1000 },
      excess: "discard",
    },
    game.getSnapshot(),
  );
  return {
    kit,
    run,
    account,
    points,
    gems,
    machine,
    workers,
    upgrade,
    milestone,
    challenge,
    automation,
    definition,
    game,
    configuration,
    entitlement,
  };
}

export function populateFixture(fixture: ReturnType<typeof persistenceFixture>): void {
  const { game, upgrade, challenge, automation, machine, workers } = fixture;
  game.dispatch(upgradeCommand(upgrade));
  game.dispatch(enterChallengeCommand(challenge, [challenge]));
  game.dispatch(completeChallengeCommand(challenge));
  game.dispatch(automationCommand(automation, true));
  game.dispatch(buyCommand(machine, { mode: "exact", count: 1 }));
  game.dispatch(allocationCommand(workers, "factory", 1));
  game.dispatch({
    id: "draw",
    execute: (transaction) => void transaction.random(["events"]).nextUint32(),
  });
  game.advance(150);
}
