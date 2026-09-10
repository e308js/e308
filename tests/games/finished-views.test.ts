// @vitest-environment happy-dom

import { nativeNumbers } from "@e308/core";
import {
  cascadeBuyables,
  cascadeKit,
  cascadeScenario,
  cascadeView,
  createCascade,
} from "@e308/game-cascade";
import { createHearth, hearthScenario, hearthView } from "@e308/game-hearth";
import {
  createWireworks,
  wireworksProjects,
  wireworksScenario,
  wireworksTerminalView,
  wireworksView,
} from "@e308/game-wireworks";
import { createQuantityFormatter, createTextResolver, mountView } from "@e308/ux";
import { describe, expect, it } from "vitest";
import { researchPanel } from "../../games/cascade/src/view-research.js";
import { driveScenario } from "../helpers/finished-games.js";

const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });

describe("finished-game view states", () => {
  it("renders Wireworks at every era, both doctrines, failures, and the ending", () => {
    const game = createWireworks();
    const root = document.createElement("main");
    document.body.append(root);
    const mount = mountView(root, { source: game, project: wireworksView, resolver });
    expect(root.textContent).toContain("Workshop sales");
    expect(game.dispatch({ type: "project", id: "missing" }).ok).toBe(false);
    expect(game.dispatch({ type: "sell", band: "volume", quantity: 1_000 }).ok).toBe(false);

    buyUntil(game, "price-model");
    expect(root.textContent).toContain("Powered industry");
    while ((game.getSnapshot().resources.cash ?? 0) < 100) {
      game.dispatch({ type: "advance", milliseconds: 20_000 });
      game.dispatch({ type: "sell", band: "premium", quantity: 5 });
    }
    expect(game.dispatch({ type: "project", id: "throughput-drive" }).ok).toBe(true);
    expect(JSON.stringify(wireworksView(game.getSnapshot()))).toContain("throughput");
    expect(game.dispatch({ type: "project", id: "durable-drive" }).ok).toBe(false);

    game.dispatch({ type: "advance", milliseconds: 200_000 });
    while ((game.getSnapshot().resources.demand ?? 0) >= 20) {
      game.dispatch({ type: "sell", band: "premium", quantity: 5 });
    }
    expect(game.dispatch({ type: "sell", band: "premium", quantity: 5 }).ok).toBe(false);
    mount.dispose();

    const completed = driveScenario(wireworksScenario(), {
      cadenceMs: 20_000,
      maximumDecisions: 2_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot();
    expect(JSON.stringify(wireworksView(completed))).toContain("ending");
    expect(JSON.stringify(wireworksTerminalView(completed))).not.toContain("project-");
    const sparse = {
      ...completed,
      resources: {},
      progression: { ...completed.progression, won: false },
    };
    const wireScenario = wireworksScenario();
    expect(wireScenario.observe(sparse).cash).toBe(0);
    expect(wireScenario.sample(sparse).matter).toBe("0");
    expect(wireScenario.quote(sparse).some((quote) => !quote.legal)).toBe(true);
    expect(wireScenario.goals[0]?.evaluate(sparse)).toMatchObject({ kind: "pending" });
  });

  it("renders Cascade before progress, during challenges, and after its theorem", () => {
    const initial = createCascade();
    const initialView = JSON.stringify(cascadeView(initial.getSnapshot()));
    expect(initialView).toContain("ending-boundary");
    expect(initialView).toContain("Speed multiplies all production");
    expect(initialView).toContain("Tier 1 autobuyer");
    const sixtyOwned = {
      ...initial.getSnapshot(),
      purchaseCounts: {
        ...initial.getSnapshot().purchaseCounts,
        [cascadeBuyables[0]?.id ?? ""]: cascadeKit.q(60),
      },
    };
    const renderedSixty = JSON.stringify(cascadeView(sixtyOwned));
    expect(renderedSixty).toContain("×64 production");
    expect(renderedSixty).not.toContain("64.000000001");
    expect(initial.dispatch({ type: "automation", id: "dimension", enabled: true }).ok).toBe(false);
    expect(initial.dispatch({ type: "research", target: "speed", amount: 1 }).ok).toBe(false);
    expect(initial.dispatch({ type: "respec" }).ok).toBe(true);

    const scenario = cascadeScenario();
    const challenge = driveScenario(scenario, {
      cadenceMs: 60_000,
      maximumDecisions: 2_000,
      stop: (snapshot) => snapshot.progression.activeChallenges.length > 0,
    }).getSnapshot();
    expect(JSON.stringify(cascadeView(challenge))).toContain('"label":"active"');

    const ending = driveScenario(scenario, {
      cadenceMs: 60_000,
      maximumDecisions: 5_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot();
    expect(JSON.stringify(cascadeView(ending))).toContain("Cascade is complete");
    const { "final-research": _final, ...upgrades } = ending.progression.upgrades;
    const ready = {
      ...ending,
      resources: { ...ending.resources, "eternity-points": cascadeKit.q(1) },
      progression: { ...ending.progression, upgrades, won: false },
    };
    expect(JSON.stringify(cascadeView(ready))).toContain('"enabled":true');
    const speed = researchPanel(ready).find((node) => node.id === "research-speed");
    if (speed?.kind !== "range-input") throw new TypeError("speed research input missing");
    expect(speed.intent(2)).toEqual({ type: "research", target: "speed", amount: 2 });
  }, 30_000);

  it("renders Hearth's warning, shortage, recovery, busy projects, and ending", () => {
    const initial = createHearth();
    expect(JSON.stringify(hearthView(initial.getSnapshot()))).toContain("Winter will test");
    const scenario = hearthScenario("research-first");
    const shortage = driveScenario(scenario, {
      cadenceMs: 1_000,
      maximumDecisions: 2_000,
      stop: (snapshot) => Boolean(snapshot.progression.achievements["winter-shortage"]),
    }).getSnapshot();
    expect(JSON.stringify(hearthView(shortage))).toContain("Food ran out");
    const recovered = driveScenario(scenario, {
      cadenceMs: 1_000,
      maximumDecisions: 2_500,
      stop: (snapshot) => Boolean(snapshot.progression.achievements["shortage-recovered"]),
    }).getSnapshot();
    expect(JSON.stringify(hearthView(recovered))).toContain("recovered from winter");
    const ending = driveScenario(scenario, {
      cadenceMs: 1_000,
      maximumDecisions: 3_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot();
    expect(JSON.stringify(hearthView(ending))).toContain("Hearth is complete");
    const sparse = { ...ending, resources: {}, allocations: {}, calendars: {}, tasks: {} };
    const sparseView = JSON.stringify(hearthView(sparse));
    expect(sparseView).toContain("spring, year 1");
    expect(scenario.observe(sparse)).toMatchObject({ season: "spring", food: 0, morale: 0 });
    expect(scenario.sample(sparse)).toMatchObject({ food: "0", science: "0" });
    expect(scenario.milestones(sparse)).toContain("ending");
    expect(scenario.diagnostics(sparse, sparse)).toEqual({
      overflow: 0,
      resetRecoveries: 0,
      taskBlocks: 0,
    });
  });
});

function buyUntil(game: ReturnType<typeof createWireworks>, projectId: string): void {
  while (!game.getSnapshot().progression.upgrades[projectId]) {
    game.dispatch({ type: "advance", milliseconds: 20_000 });
    game.dispatch({ type: "sell", band: "premium", quantity: 5 });
    const next = wireworksProjects.find(
      (project) =>
        project.id !== "durable-drive" &&
        project.id !== "throughput-drive" &&
        !game.getSnapshot().progression.upgrades[project.id],
    );
    if (next) game.dispatch({ type: "project", id: next.id });
  }
}
