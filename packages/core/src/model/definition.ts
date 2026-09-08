declare const gameIdBrand: unique symbol;

export type GameId = string & { readonly [gameIdBrand]: true };

export interface GameDefinition {
  readonly id: GameId;
  readonly simulationVersion: number;
  readonly stepMs: number;
}

export interface GameDefinitionInput {
  readonly id: string;
  readonly simulationVersion: number;
  readonly stepMs: number;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function defineGame(input: GameDefinitionInput): GameDefinition {
  if (!ID_PATTERN.test(input.id)) {
    throw new TypeError(`Invalid game id: ${input.id}`);
  }
  if (!Number.isSafeInteger(input.simulationVersion) || input.simulationVersion < 1) {
    throw new TypeError("simulationVersion must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.stepMs) || input.stepMs < 1) {
    throw new TypeError("stepMs must be a positive safe integer");
  }
  return Object.freeze({
    id: input.id as GameId,
    simulationVersion: input.simulationVersion,
    stepMs: input.stepMs,
  });
}
