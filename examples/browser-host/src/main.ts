import { createSaveCodec } from "@e308/core";
import {
  bindBrowserLifecycle,
  browserClock,
  browserScheduler,
  IndexedDbSaveStore,
  openBrowserHost,
  WebLockOwnership,
} from "@e308/core/browser";
import {
  messageEndpoint,
  WorkerClient,
  type WorkerRequest,
  type WorkerResponse,
} from "@e308/core/worker";
import { type FixtureIntent, fixtureGame } from "./game.js";

const fixture = fixtureGame();
const codec = createSaveCodec(fixture.definition, {
  stateSchemaVersion: 1,
  contentVersion: "1.0.0",
  contentDigest: "browser-fixture-v1",
});
const ownership = new WebLockOwnership({ lockName: "e308-browser-fixture-owner" });
const host = await openBrowserHost({
  definition: fixture.definition,
  codec,
  store: new IndexedDbSaveStore({ databaseName: "e308-browser-fixture" }),
  slot: "main",
  initial: {
    snapshot: fixture.game.getSnapshot(),
    metadata: {
      wallAnchorMs: Date.now(),
      entitlement: { policyVersion: "1", enabled: true, capMs: 60_000, excess: "discard" },
      catchup: null,
    },
  },
  clock: browserClock,
  scheduler: browserScheduler,
  ownership,
  tickMs: 100,
  autosaveMs: 60_000,
  catchupStepsPerChunk: 100,
});

const owner = element("owner");
const points = element("points");
const storage = element("storage");
function render(): void {
  owner.textContent = host.ownership;
  points.textContent = String(host.game.getSnapshot().resources.points);
  storage.textContent = host.storageRevision ?? "none";
}
host.subscribe(render);
bindBrowserLifecycle(host);
document.querySelector("#add")?.addEventListener("click", () => {
  addPoint();
});
document.querySelector("#save")?.addEventListener("click", () => void save());
document.querySelector("#take")?.addEventListener("click", () => void takeOwnership());
document.querySelector("#worker")?.addEventListener("click", () => void runWorker());
render();

async function runWorker(): Promise<void> {
  const worker = new Worker("/examples/browser-host/dist/worker.js", { type: "module" });
  const client = new WorkerClient<FixtureIntent, string>(
    messageEndpoint<WorkerResponse<string>, WorkerRequest<FixtureIntent, string>>(worker),
  );
  const initial = fixture.transfer.encodeSnapshot(host.game.getSnapshot());
  await client.request({ protocol: 1, kind: "initialize", requestId: "init", snapshot: initial });
  const result = await client.request({
    protocol: 1,
    kind: "advance",
    requestId: "advance",
    sourceRevision: host.game.getSnapshot().revision.toString(),
    elapsedMs: 1_000,
  });
  element("worker-result").textContent =
    result.kind === "result"
      ? String(fixture.transfer.decodeSnapshot(result.snapshot).resources.points)
      : result.kind;
  client.dispose();
  worker.terminate();
}

function element(id: string): HTMLOutputElement {
  const found = document.querySelector(`#${id}`);
  if (!(found instanceof HTMLOutputElement)) throw new TypeError(`Missing output ${id}`);
  return found;
}

function addPoint(): boolean {
  const result = host.dispatch(fixture.command(1));
  element("worker-result").textContent = result.ok ? "added" : result.error.code;
  render();
  return result.ok;
}

async function save(): Promise<boolean> {
  const saved = await host.saveNow();
  render();
  return saved;
}

async function takeOwnership(): Promise<boolean> {
  const acquired = await host.requestOwnership();
  render();
  return acquired;
}

Object.assign(window, { e308BrowserHost: { host, addPoint, save, takeOwnership, runWorker } });
