// @vitest-environment happy-dom

import {
  createGame,
  createGameKit,
  nativeNumbers,
  type Snapshot,
  upgradeCommand,
} from "../../packages/core/src/index.js";
import {
  beginCatchup,
  processCatchupChunk,
  resolveEntitlement,
} from "../../packages/core/src/offline/index.js";
import { createSaveCodec } from "../../packages/core/src/persistence/index.js";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
  type ViewSource,
} from "../../packages/ux/src/index.js";

describe("TMT required cross-feature recipes", () => {
  it("lets a milestone unlock auto-upgrades during offline progress", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const income = kit.flow("income", {
      scope: run,
      rate: kit.rates.constant(10),
      produces: [[points, 1]],
    });
    const milestone = kit.milestone("automation-ready", {
      scope: run,
      when: (state) => state.get(points) >= 2,
    });
    const upgrade = kit.upgrade("automatic-upgrade", {
      scope: run,
      costs: [[points, 2]],
      prerequisiteIds: [milestone.id],
      unlocked: (state) => state.hasMilestone(milestone.id),
    });
    const automation = kit.automation("buy-upgrade", {
      scope: run,
      cadenceMs: 100,
      initiallyEnabled: true,
      unlocked: (state) => state.hasMilestone(milestone.id),
      condition: (state) => !state.hasUpgrade(upgrade.id),
      action: () => upgradeCommand(upgrade),
    });
    const definition = kit.defineGame({
      id: "tmt-offline-auto",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points],
      flows: [income],
      triggers: [milestone],
      upgrades: [upgrade],
      automation: [automation],
    });
    const game = createGame(definition);
    const codec = createSaveCodec(definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "tmt-offline-auto-1",
    });
    const entitlement = resolveEntitlement(
      {
        policyVersion: "unlimited-1",
        enabled: true,
        cap: { kind: "unlimited" },
        excess: "discard",
      },
      game.getSnapshot(),
    );
    const loaded = codec.decode(
      codec.encode(game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    const started = beginCatchup(definition, loaded, 500, "tmt-offline-auto");
    if (!started.catchup) throw new TypeError("Expected offline session");
    const offline = createGame(definition, { snapshot: started.snapshot });
    const result = processCatchupChunk(definition, offline, started.catchup, 5);

    expect(result.ok).toBe(true);
    expect(offline.getSnapshot().progression).toMatchObject({
      milestones: { "automation-ready": true },
      upgrades: { "automatic-upgrade": true },
    });
    expect(offline.getSnapshot().resources.points).toBe(3);
  });

  it("migrates a saved dynamic grid and renders its new dimensions", () => {
    const old = gridDefinition("grid-size");
    const oldGame = createGame(old.definition);
    oldGame.dispatch({ id: "resize", execute: (tx) => tx.set(old.size, 3) });
    const entitlement = resolveEntitlement(
      {
        policyVersion: "disabled-1",
        enabled: false,
        cap: { kind: "unlimited" },
        excess: "discard",
      },
      oldGame.getSnapshot(),
    );
    const oldCodec = createSaveCodec(old.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "grid-v1",
    });
    const raw = oldCodec.encode(oldGame.getSnapshot(), {
      wallAnchorMs: 0,
      entitlement,
      catchup: null,
    });

    const current = gridDefinition("grid-rows");
    const codec = createSaveCodec(
      current.definition,
      { stateSchemaVersion: 2, contentVersion: "2", contentDigest: "grid-v2" },
      {
        migrations: [
          {
            id: "rename-grid-size",
            fromVersion: 1,
            toVersion: 2,
            migrate: (envelope) => {
              const scope = envelope.state.scopes.run;
              if (!scope) throw new TypeError("Missing run scope");
              const value = scope.resources["grid-size"];
              if (!value) throw new TypeError("Missing old grid size");
              return {
                ...envelope,
                stateSchemaVersion: 2,
                content: { ...envelope.content, version: "2", digest: "grid-v2" },
                state: {
                  ...envelope.state,
                  productionTotals: { "grid-rows": value },
                  scopes: {
                    ...envelope.state.scopes,
                    run: {
                      ...scope,
                      resources: { "grid-rows": value },
                    },
                  },
                },
              };
            },
          },
        ],
      },
    );
    const restored = codec.decode(raw).snapshot;
    const source = snapshotSource(restored);
    const root = document.createElement("main");
    const mounted = mountView(root, {
      source,
      project: (snapshot) => gridView(snapshot, current.size.id),
      resolver: createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) }),
    });

    expect(root.querySelector('[role="grid"]')?.getAttribute("data-rows")).toBe("3");
    expect(root.querySelectorAll('[role="gridcell"]')).toHaveLength(6);
    mounted.dispose();
  });
});

function gridDefinition(resourceId: string) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const size = kit.resource(resourceId, { scope: run, initial: 2 });
  return {
    size,
    definition: kit.defineGame({
      id: "tmt-grid-migration",
      simulationVersion: 1,
      stepMs: 100,
      resources: [size],
    }),
  };
}

function snapshotSource(snapshot: Snapshot<number>): ViewSource<Snapshot<number>, never> {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    dispatch: () => undefined,
  };
}

function gridView(snapshot: Snapshot<number>, resourceId: string): ViewDocument<never, number> {
  const rows = snapshot.resources[resourceId] ?? 0;
  return {
    content: [
      {
        kind: "grid",
        id: "migrated-grid",
        rows,
        columns: 2,
        cells: Array.from({ length: rows * 2 }, (_, index) => ({
          id: `cell-${index}`,
          row: Math.floor(index / 2) + 1,
          column: (index % 2) + 1,
          label: `Cell ${index + 1}`,
        })),
      },
    ],
  };
}
