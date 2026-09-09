import { createGame, createGameKit, nativeNumbers } from "@e308/core";
import { quoteCommands } from "@e308/core/testing";
import { describe, expect, it } from "vitest";

describe("command quote probes", () => {
  it("reports legal commands and maps failures without mutating the snapshot", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const scope = kit.scope("run");
    const points = kit.resource("points", { scope, initial: 0 });
    const definition = kit.defineGame({
      id: "quote-probe",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points],
    });
    const game = createGame(definition);
    const snapshot = game.getSnapshot();
    const quotes = quoteCommands(
      definition,
      snapshot,
      [
        { id: "legal", intent: "legal", useful: false },
        { id: "invalid", intent: "invalid", rank: 1 },
      ],
      (intent) => ({
        id: intent,
        execute: (transaction) => {
          if (intent === "invalid") transaction.reject({ code: "invalid-target", id: intent });
          transaction.add(points, 1);
        },
      }),
    );
    expect(quotes).toEqual([
      {
        id: "legal",
        revision: "0",
        intent: "legal",
        legal: true,
        useful: false,
        constraints: [],
      },
      {
        id: "invalid",
        revision: "0",
        intent: "invalid",
        legal: false,
        useful: true,
        rank: 1,
        constraints: [
          {
            kind: "other",
            id: "invalid-target",
            detail: "Command probe returned invalid-target",
          },
        ],
      },
    ]);
    expect(snapshot.resources.points).toBe(0);
  });
});
