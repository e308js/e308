import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  defineGame,
  type GameDefinition,
  nativeNumbers,
  type Snapshot,
} from "../../packages/core/src/index.js";
import { scopeRegistry } from "../../packages/core/src/persistence/registry.js";
import { restoreSnapshot } from "../../packages/core/src/state/restore.js";
import { persistenceFixture } from "../helpers/persistence-fixture.js";

function changed<N>(snapshot: Snapshot<N>, patch: Partial<Snapshot<N>>): Snapshot<N> {
  return { ...snapshot, ...patch };
}

describe("snapshot restoration validation", () => {
  it("rejects incomplete definitions and invalid clock fields", () => {
    const fixture = persistenceFixture();
    const snapshot = fixture.game.getSnapshot();
    expect(() =>
      restoreSnapshot(
        defineGame({
          id: "plain",
          simulationVersion: 1,
          stepMs: 100,
        }) as unknown as GameDefinition<number>,
        snapshot,
      ),
    ).toThrow("incomplete");
    expect(() =>
      scopeRegistry(defineGame({ id: "plain", simulationVersion: 1, stepMs: 100 })),
    ).toThrow("game-kit definition");
    expect(() => restoreSnapshot(fixture.definition, changed(snapshot, { revision: -1n }))).toThrow(
      "revision",
    );
    expect(() =>
      restoreSnapshot(fixture.definition, changed(snapshot, { gameTimeMs: -1 })),
    ).toThrow("clock");
    expect(() =>
      restoreSnapshot(fixture.definition, changed(snapshot, { remainderMs: 100 })),
    ).toThrow("remainder");
  });

  it("rejects missing, unknown, non-finite, and out-of-cap resources", () => {
    const fixture = persistenceFixture();
    const snapshot = fixture.game.getSnapshot();
    expect(() =>
      restoreSnapshot(fixture.definition, changed(snapshot, { resources: { points: 10 } })),
    ).toThrow("Missing saved resource");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { resources: { ...snapshot.resources, extra: 1 } }),
      ),
    ).toThrow("Unknown saved resource");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { resources: { ...snapshot.resources, points: Number.NaN } }),
      ),
    ).toThrow("Invalid saved resource");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, {
          productionTotals: { ...snapshot.productionTotals, points: Number.NaN },
        }),
      ),
    ).toThrow("Invalid production total");

    const kit = fixture.kit;
    const capped = kit.resource("capped", { scope: fixture.run, initial: 0, capacity: 10 });
    const definition = kit.defineGame({
      id: "capacity-restore",
      simulationVersion: 1,
      stepMs: 100,
      resources: [capped],
    });
    const initial = fixture.game.getSnapshot();
    const capacitySnapshot = {
      ...initial,
      resources: { capped: 11 },
      purchaseCounts: {},
      allocations: {},
      productionTotals: { capped: 0 },
      progression: {
        ...initial.progression,
        upgrades: {},
        milestones: {},
        achievements: {},
        activeChallenges: [],
        challengeCompletions: {},
        automation: {},
      },
    };
    expect(() => restoreSnapshot(definition, capacitySnapshot)).toThrow("exceeds capacity");
  });

  it("rejects invalid purchase, allocation, and progression records", () => {
    const fixture = persistenceFixture();
    const snapshot = fixture.game.getSnapshot();
    expect(() =>
      restoreSnapshot(fixture.definition, changed(snapshot, { purchaseCounts: { machine: 0.5 } })),
    ).toThrow("purchase count");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { allocations: { workers: { unknown: 1 } } }),
      ),
    ).toThrow("allocation target");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { allocations: { workers: { factory: -1 } } }),
      ),
    ).toThrow("saved allocation");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, {
          progression: { ...snapshot.progression, upgrades: { unknown: true } },
        }),
      ),
    ).toThrow("upgrade flag");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, {
          progression: { ...snapshot.progression, activeChallenges: ["unknown"] },
        }),
      ),
    ).toThrow("challenge");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, {
          progression: {
            ...snapshot.progression,
            automation: { idle: { enabled: true, nextRunMs: -1 } },
          },
        }),
      ),
    ).toThrow("automation schedule");
  });

  it("rejects invalid scope generations and random roots", () => {
    const fixture = persistenceFixture();
    const snapshot = fixture.game.getSnapshot();
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { scopeGenerations: { ...snapshot.scopeGenerations, unknown: 0n } }),
      ),
    ).toThrow("scope generation");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { scopeGenerations: { ...snapshot.scopeGenerations, run: -1n } }),
      ),
    ).toThrow("cannot be negative");
    expect(() =>
      restoreSnapshot(
        fixture.definition,
        changed(snapshot, { random: { ...snapshot.random, rootSeed: "00" } }),
      ),
    ).toThrow("does not match");
  });

  it("retains scopes owned only by executable mechanics", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const economy = kit.scope("economy");
    const systems = kit.scope("systems");
    const points = kit.resource("points", { scope: economy, initial: 0 });
    const heartbeat = kit.steppedRule("heartbeat", { scope: systems, update: () => undefined });
    const definition = kit.defineGame({
      id: "mechanic-scopes",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points],
      steppedRules: [heartbeat],
    });
    const snapshot = createGame(definition).getSnapshot();
    expect(snapshot.scopeGenerations).toEqual({ economy: 0n, systems: 0n });
    expect(restoreSnapshot(definition, snapshot).scopeGenerations).toEqual(
      snapshot.scopeGenerations,
    );
  });

  it("validates and deeply freezes progression events on direct restore", () => {
    const fixture = persistenceFixture();
    fixture.game.advance(100);
    const snapshot = fixture.game.getSnapshot();
    const restored = restoreSnapshot(fixture.definition, snapshot);
    expect(Object.isFrozen(restored.progression.events[0])).toBe(true);
    expect(() =>
      restoreSnapshot(fixture.definition, {
        ...snapshot,
        progression: {
          ...snapshot.progression,
          events: [{ sequence: 0n, kind: "win", id: "game", atGameMs: 100 }],
        },
      }),
    ).toThrow("event ledger");
  });
});
