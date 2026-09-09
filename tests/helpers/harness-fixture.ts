import { createGame, createGameKit, nativeNumbers } from "../../packages/core/src/index.js";
import type { Transaction } from "../../packages/core/src/state/types.js";
import type { HarnessScenario, HarnessValue } from "../../packages/core/src/testing/index.js";

export interface HarnessFixtureParameters extends Readonly<Record<string, HarnessValue>> {
  readonly rate: number;
  readonly cost: number;
  readonly target: number;
  readonly capacity: number | null;
  readonly certified: boolean;
  readonly noActions?: boolean;
  readonly awayCapMs?: number;
}

export interface HarnessObservation extends Readonly<Record<string, HarnessValue>> {
  readonly points: number;
  readonly tokens: number;
}

export interface HarnessIntent extends Readonly<Record<string, HarnessValue>> {
  readonly kind: "buy-token";
}

export function harnessScenario(
  parameters: HarnessFixtureParameters,
  contentVersion = "1.0.0",
): HarnessScenario<number, HarnessObservation, HarnessIntent> {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", {
    scope: run,
    initial: 0,
    ...(parameters.capacity === null ? {} : { capacity: parameters.capacity }),
  });
  const tokens = kit.resource("tokens", { scope: run, initial: 0 });
  const income = kit.flow("income", {
    scope: run,
    rate: kit.rates.constant(parameters.rate),
    produces: [[points, 1]],
  });
  const definition = kit.defineGame({
    id: "harness-fixture",
    simulationVersion: 1,
    stepMs: 100,
    resources: [points, tokens],
    flows: [income],
  });
  return {
    id: "harness-fixture",
    contentVersion,
    contentDigest: `rate=${parameters.rate};cost=${parameters.cost};target=${parameters.target}`,
    parameters,
    definition,
    goals: [
      {
        id: "tokens",
        evaluate: (snapshot) => {
          if ((snapshot.resources.tokens ?? 0) >= parameters.target) return { kind: "reached" };
          const constraint = {
            kind: "capacity" as const,
            id: "points-cap",
            detail: `capacity ${parameters.capacity} below cost ${parameters.cost}`,
          };
          if (
            parameters.certified &&
            parameters.capacity !== null &&
            parameters.capacity < parameters.cost
          ) {
            return {
              kind: "certified-barrier",
              certificate: {
                id: "capacity-below-token-cost",
                proofScope: "fixed point capacity and token cost",
                assumptions: ["no alternative point source"],
                constraints: [constraint],
              },
            };
          }
          return { kind: "pending", constraints: [constraint] };
        },
      },
    ],
    create: (_gameSeed) => createGame(definition),
    observe: (snapshot) => ({
      points: snapshot.resources.points ?? 0,
      tokens: snapshot.resources.tokens ?? 0,
    }),
    quote: (snapshot) => {
      if (parameters.noActions) return [];
      const available = snapshot.resources.points ?? 0;
      const legal = available >= parameters.cost;
      return [
        {
          id: "buy-token",
          revision: snapshot.revision.toString(),
          intent: { kind: "buy-token" },
          legal,
          useful: (snapshot.resources.tokens ?? 0) < parameters.target,
          rank: 10,
          constraints: legal
            ? []
            : [
                {
                  kind: "insufficient-input",
                  id: "points",
                  detail: `${available}/${parameters.cost}`,
                },
              ],
        },
      ];
    },
    command: (_intent, snapshot) => ({
      id: "buy-token",
      expectedRevision: snapshot.revision,
      execute: (transaction: Transaction<number>) => {
        const available = transaction.get(points);
        if (available < parameters.cost)
          transaction.reject({
            code: "insufficient",
            resourceId: points.id,
            required: parameters.cost,
            available,
          });
        transaction.set(points, available - parameters.cost);
        transaction.add(tokens, 1);
      },
    }),
    sample: (snapshot) => ({
      points: String(snapshot.resources.points),
      tokens: String(snapshot.resources.tokens),
    }),
    milestones: (snapshot) => {
      const value = snapshot.resources.tokens ?? 0;
      return [
        ...(value >= 1 ? ["first-token"] : []),
        ...(value >= parameters.target ? ["goal"] : []),
      ];
    },
    diagnostics: () => ({ overflow: 0, resetRecoveries: 0, taskBlocks: 0 }),
    ...(parameters.awayCapMs === undefined
      ? {}
      : {
          advanceAway: (game, durationMs) => {
            const credited = Math.min(durationMs, parameters.awayCapMs as number);
            const result = game.advance(credited);
            if (!result.ok) throw new TypeError(result.error.code);
            return {
              snapshot: result.value,
              fidelity: "canonical" as const,
              discardedRealMs: durationMs - credited,
              bankedRealMs: 0,
            };
          },
        }),
  };
}

export const baseHarnessParameters: HarnessFixtureParameters = {
  rate: 1,
  cost: 2,
  target: 3,
  capacity: null,
  certified: false,
};
