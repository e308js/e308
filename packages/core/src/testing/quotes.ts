import type { GameDefinition } from "../model/definition.js";
import { createGame } from "../state/game.js";
import type { Command, CommandFailure, Snapshot } from "../state/types.js";
import type { ConstraintEvidence, HarnessValue, LegalActionQuote } from "./types.js";

export interface CommandQuoteCandidate<I extends HarnessValue> {
  readonly id: string;
  readonly intent: I;
  readonly useful?: boolean;
  readonly rank?: number;
}

const failureKinds: Readonly<
  Partial<Record<CommandFailure<unknown>["code"], ConstraintEvidence["kind"]>>
> = {
  insufficient: "insufficient-input",
  "capacity-blocked": "capacity",
  locked: "prerequisite",
  "allocation-exceeded": "allocation",
  disabled: "policy",
};

export function quoteCommands<N, I extends HarnessValue>(
  definition: GameDefinition<N>,
  snapshot: Snapshot<N>,
  candidates: readonly CommandQuoteCandidate<I>[],
  command: (intent: I, snapshot: Snapshot<N>) => Command<N>,
): readonly LegalActionQuote<I>[] {
  return candidates.map((candidate) => {
    const probe = createGame(definition, { snapshot });
    const result = probe.dispatch(command(candidate.intent, snapshot));
    const constraints = result.ok ? [] : [constraint(result.error)];
    return {
      id: candidate.id,
      revision: snapshot.revision.toString(),
      intent: candidate.intent,
      legal: result.ok,
      useful: candidate.useful ?? true,
      ...(candidate.rank === undefined ? {} : { rank: candidate.rank }),
      constraints,
    };
  });
}

function constraint(failure: CommandFailure<unknown>): ConstraintEvidence {
  return {
    kind: failureKinds[failure.code] ?? "other",
    id: failure.code,
    detail: `Command probe returned ${failure.code}`,
  };
}
