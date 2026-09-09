import {
  createGame,
  eternityNumbers,
  type GameDefinition,
  nativeNumbers,
  type SaveCodec,
  type Snapshot,
} from "@e308/core";
import {
  type BrowserHost,
  bindBrowserLifecycle,
  browserClock,
  browserScheduler,
  IndexedDbSaveStore,
  openBrowserHost,
  WebLockOwnership,
} from "@e308/core/browser";
import {
  type CascadeIntent,
  cascadeCommand,
  cascadeDefinition,
  cascadeSaveCodec,
  cascadeView,
} from "@e308/game-cascade";
import {
  type HearthIntent,
  hearthCommand,
  hearthDefinition,
  hearthSaveCodec,
  hearthView,
} from "@e308/game-hearth";
import {
  wireworksCommand,
  wireworksDefinition,
  wireworksSaveCodec,
  wireworksView,
} from "@e308/game-wireworks";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  starterTheme,
  type ViewMount,
} from "@e308/ux";
import { HostSource } from "./host-source.js";

type Session = {
  readonly id: string;
  readonly host: BrowserHost<unknown>;
  readonly mount: () => ViewMount;
};

const instanceId = new URL(location.href).searchParams.get("run") ?? "manual";

const root = required<HTMLElement>("game");
const status = required<HTMLOutputElement>("host-status");
const saveData = required<HTMLTextAreaElement>("save-data");
const style = document.createElement("style");
style.textContent = starterTheme;
document.head.append(style);

const sessions = new Map<string, Session>();
let active = await session(document.body.dataset.game ?? "wireworks");
let mounted = active.mount();
show(active);

const developerTools = document.querySelector<HTMLDetailsElement>("#developer-tools");
developerTools?.addEventListener("toggle", () => {
  document.body.classList.toggle("debug-open", developerTools.open);
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-game]")) {
  button.addEventListener("click", async () => {
    const id = button.dataset.game;
    if (!id) return;
    mounted.dispose();
    active = await session(id);
    mounted = active.mount();
    show(active);
  });
}
required<HTMLButtonElement>("save").addEventListener("click", async () => {
  status.value = (await active.host.saveNow()) ? "Saved locally" : "Save unavailable";
});
required<HTMLButtonElement>("export").addEventListener("click", async () => {
  saveData.value = await active.host.exportSave();
  status.value = "Exported current save";
});
required<HTMLButtonElement>("import").addEventListener("click", async () => {
  status.value = (await active.host.importSave(saveData.value))
    ? "Imported save"
    : "Import unavailable";
});
required<HTMLButtonElement>("reset").addEventListener("click", async () => {
  status.value = (await active.host.reset()) ? "Started a new save" : "Reset unavailable";
});

async function session(id: string): Promise<Session> {
  const existing = sessions.get(id);
  if (existing) return existing;
  const created =
    id === "cascade"
      ? await cascadeSession()
      : id === "hearth"
        ? await hearthSession()
        : await wireworksSession();
  sessions.set(id, created);
  return created;
}

async function wireworksSession(): Promise<Session> {
  const host = await hostFor("wireworks", wireworksDefinition, wireworksSaveCodec);
  const source = new HostSource(host, wireworksCommand);
  const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });
  return {
    id: "wireworks",
    host: host as BrowserHost<unknown>,
    mount: () =>
      mountView(root, {
        source,
        project: wireworksView,
        resolver,
        onDispatchResult: showDispatchResult,
      }),
  };
}

async function cascadeSession(): Promise<Session> {
  const host = await hostFor("cascade", cascadeDefinition, cascadeSaveCodec);
  const source = new HostSource<ReturnType<typeof eternityNumbers.fromNumber>, CascadeIntent>(
    host,
    (_snapshot, intent) => cascadeCommand(intent),
  );
  const resolver = createTextResolver({
    quantities: createQuantityFormatter(eternityNumbers, {
      scientific: { notation: "scientific", significantDigits: 5 },
    }),
  });
  return {
    id: "cascade",
    host: host as BrowserHost<unknown>,
    mount: () =>
      mountView(root, {
        source,
        project: cascadeView,
        resolver,
        onDispatchResult: showDispatchResult,
      }),
  };
}

async function hearthSession(): Promise<Session> {
  const host = await hostFor("hearth", hearthDefinition, hearthSaveCodec);
  const source = new HostSource<number, HearthIntent>(host, (_snapshot, intent) =>
    hearthCommand(intent),
  );
  const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeNumbers) });
  return {
    id: "hearth",
    host: host as BrowserHost<unknown>,
    mount: () =>
      mountView(root, {
        source,
        project: hearthView,
        resolver,
        onDispatchResult: showDispatchResult,
      }),
  };
}

async function hostFor<N>(
  id: string,
  definition: GameDefinition<N>,
  codec: SaveCodec<N>,
): Promise<BrowserHost<N>> {
  const initial = createGame(definition).getSnapshot();
  const host = await openBrowserHost({
    definition,
    codec,
    store: new IndexedDbSaveStore({ databaseName: `e308-finished-${id}-${instanceId}` }),
    slot: "main",
    initial: {
      snapshot: initial,
      metadata: {
        wallAnchorMs: Date.now(),
        entitlement: {
          policyVersion: `${id}-browser-1`,
          enabled: true,
          capMs: id === "wireworks" ? 8 * 60 * 60_000 : null,
          excess: "bank",
        },
        catchup: null,
      },
    },
    clock: browserClock,
    scheduler: browserScheduler,
    ownership: new WebLockOwnership({ lockName: `e308-finished-${id}-${instanceId}-owner` }),
    tickMs: 250,
    autosaveMs: 30_000,
    catchupStepsPerChunk: 20_000,
  });
  bindBrowserLifecycle(host);
  return host;
}

function show(value: Session): void {
  root.className = `game-shell ${value.id}`;
  status.value = `${value.id}: ${value.host.ownership}; offline progress enabled`;
}

function showDispatchResult(result: unknown): void {
  if (!isRecord(result) || typeof result.ok !== "boolean") return;
  if (result.ok) {
    status.value = "Action applied";
    return;
  }
  const error = isRecord(result.error) ? result.error : {};
  status.value =
    error.code === "allocation-exceeded"
      ? "All workers are assigned. Lower another job before raising this one."
      : `Action blocked: ${typeof error.code === "string" ? error.code : "requirements"}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function required<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new TypeError(`Missing #${id}`);
  return value as T;
}

declare global {
  interface Window {
    e308Finished?: { readonly session: () => string; readonly snapshot: () => Snapshot<unknown> };
  }
}
window.e308Finished = { session: () => active.id, snapshot: () => active.host.game.getSnapshot() };
