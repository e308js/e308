import { createGame, createSaveCodec } from "../../../packages/core/src/index.js";
import { subjectState as adState, createAdSubject } from "../../../reference/ad/subject.js";
import { B_UPGRADE_SPECS } from "../../../reference/array/constants.js";
import { encode, q, required } from "../../../reference/array/math.js";
import { arrayGenerators, arrayResources } from "../../../reference/array/model.js";
import { createArrayReference, importArrayReference } from "../../../reference/array/runtime.js";
import {
  assignWorkers,
  build,
  craft,
  createKittensSubject,
  kittensEntitlement,
  subjectState as kittensState,
} from "../../../reference/kittens/subject.js";
import {
  createPaperclipsReference,
  importPaperclipsReference,
  paperclipsBuyables,
  paperclipsPhase,
  paperclipsResources,
} from "../../../reference/paperclips/full/index.js";

export function mountReferenceLabs(
  adRoot: HTMLElement,
  kittensRoot: HTMLElement,
  arrayRoot: HTMLElement,
  paperclipsRoot: HTMLElement,
): void {
  mountAd(adRoot);
  mountKittens(kittensRoot);
  mountArray(arrayRoot);
  mountPaperclips(paperclipsRoot);
}

function mountAd(root: HTMLElement): void {
  let subject = createAdSubject({
    antimatter: 1_000,
    dimensions: [8, 7, 6, 5, 4, 3, 2, 1],
  });
  const frame = createFrame(root, "Antimatter Dimensions · AD01–AD06", [
    ["Tick 100 ms", () => subject.game.advance(100)],
    ["Buy tier 1", () => subject.game.dispatch(subject.buyOne(1))],
    ["Buy to ten", () => subject.game.dispatch(subject.buyUntilTen(1))],
    ["Buy max", () => subject.game.dispatch(subject.buyMax(1))],
    [
      "Reset case",
      () =>
        (subject = createAdSubject({
          antimatter: 1e12,
          dimensions: [5, 4, 3, 20, 0, 0, 0, 0],
        })),
    ],
    ["Dimension boost", () => subject.game.dispatch(subject.dimensionBoost())],
  ]);
  const wired = wireFrame(frame, () => adState(subject));
  root.prepend(
    casePicker(
      [
        "AD01 production",
        "AD02 purchases",
        "AD03 resets",
        "AD04 challenges",
        "AD05 automation",
        "AD06 save/offline",
      ],
      (index) => {
        subject =
          index === 0
            ? createAdSubject({ antimatter: 1_000, dimensions: [8, 7, 6, 5, 4, 3, 2, 1] })
            : index === 1
              ? createAdSubject({ antimatter: 100_100, dimensions: [1, 0, 0, 0, 0, 0, 0, 0] })
              : index === 2
                ? createAdSubject({ antimatter: 1e12, dimensions: [5, 4, 3, 20, 0, 0, 0, 0] })
                : createAdSubject({ antimatter: 1e30, boosts: 5, dimensions: Array(8).fill(80) });
        wired.render();
      },
    ),
  );
}

function mountKittens(root: HTMLElement): void {
  let subject = createKittensSubject({
    resources: { catnip: 100, wood: 200, minerals: 0, science: 10, beam: 0 },
    kittens: 4,
  });
  const frame = createFrame(root, "Kittens Game · KG01–KG06", [
    [
      "Assign four jobs",
      () => assignWorkers(subject, { farmer: 1, woodcutter: 1, miner: 1, scholar: 1 }),
    ],
    ["Tick 200 ms", () => subject.game.advance(200)],
    ["Build barn", () => build(subject, "barn")],
    ["Refine wood", () => craft(subject, "wood")],
    ["Craft beam", () => craft(subject, "beam")],
    ["Save round-trip", () => saveRoundTrip()],
  ]);
  const wired = wireFrame(frame, () => kittensState(subject));
  root.prepend(
    casePicker(
      [
        "KG01 ledger",
        "KG02 allocation",
        "KG03 calendar",
        "KG04 crafting",
        "KG05 redshift",
        "KG06 retention",
      ],
      (index) => {
        subject = createKittensSubject({
          resources: {
            catnip: index === 1 ? 0.2 : 100,
            wood: index === 3 ? 200 : 50,
            minerals: 0,
            science: 10,
            beam: 0,
          },
          kittens: 4,
          ...(index === 2 ? { season: 3, seasonTicks: 999 } : {}),
          ...(index === 5 ? { paragon: 3, researchedConstruction: true } : {}),
        });
        wired.render();
      },
    ),
  );

  function saveRoundTrip(): string {
    const codec = createSaveCodec(subject.model.definition, {
      stateSchemaVersion: 1,
      contentVersion: "lab-1",
      contentDigest: "kittens-interactive-lab",
    });
    const raw = codec.encode(subject.game.getSnapshot(), {
      wallAnchorMs: 1_000,
      entitlement: kittensEntitlement(subject),
      catchup: null,
    });
    subject = {
      ...subject,
      game: createGame(subject.model.definition, { snapshot: codec.decode(raw).snapshot }),
    };
    return `restored ${raw.length} bytes`;
  }
}

function mountArray(root: HTMLElement): void {
  let subject = arrayLabCase(0);
  const frame = createFrame(root, "Array Game · A/B progression", [
    [
      "Buy A1 generator",
      () => subject.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "max" }),
    ],
    ["Advance 16 ms", () => subject.advance(16)],
    ["Advance one minute", () => subject.advanceAway(60_000)],
    ["Prestige for B", () => subject.dispatch({ type: "prestige-b" })],
    [
      "Buy B1 generator",
      () => subject.dispatch({ type: "buy-generator", family: "B", tier: 1, mode: "max" }),
    ],
    ["Save round-trip", () => (subject = importArrayReference(subject.exportSave(1_000)))],
  ]);
  const wired = wireFrame(frame, () => arrayLabState(subject));
  root.prepend(
    casePicker(["A opening", "B economy", "B-era endpoint"], (index) => {
      subject = arrayLabCase(index);
      wired.render();
    }),
  );
}

function arrayLabCase(index: number): ReturnType<typeof createArrayReference> {
  const subject = createArrayReference();
  if (index === 0) return subject;
  subject.game.dispatch({
    id: "array-lab-case",
    execute: (transaction) => {
      transaction.set(arrayResources.A, q(index === 1 ? "1e30" : "1e180"));
      transaction.set(arrayResources.B, q(index === 1 ? "1000" : "1e10"));
      transaction.setProgress("milestone", "array-b-unlocked");
      arrayGenerators.A.amounts.forEach((resource, tier) => {
        transaction.set(resource, q(index === 1 ? String(5 - tier) : "1e20"));
      });
      arrayGenerators.B.amounts.forEach((resource, tier) => {
        transaction.set(resource, q(index === 1 ? String(5 - tier) : "1e10"));
      });
      if (index === 2)
        B_UPGRADE_SPECS.forEach((upgrade) => {
          transaction.setProgress("upgrade", upgrade.id);
        });
    },
  });
  return subject;
}

function arrayLabState(subject: ReturnType<typeof createArrayReference>) {
  const snapshot = subject.getSnapshot();
  const values = (family: "A" | "B") =>
    arrayGenerators[family].amounts.map((resource) =>
      encode(required(snapshot.resources[resource.id], resource.id)),
    );
  return {
    A: encode(required(snapshot.resources["array-a"], "array-a")),
    B: encode(required(snapshot.resources["array-b"], "array-b")),
    generators: { A: values("A"), B: values("B") },
    upgrades: Object.keys(snapshot.progression.upgrades),
    gameTimeMs: snapshot.gameTimeMs,
  };
}

function mountPaperclips(root: HTMLElement): void {
  let subject = paperclipsLabCase(0);
  const frame = createFrame(root, "Universal Paperclips · implementation slice", [
    ["Make 100 clips", () => subject.dispatch({ type: "make-clip", count: 100 })],
    ["Advance one second", () => subject.advance(1_000)],
    ["Buy AutoClipper", () => subject.dispatch({ type: "buy", id: "auto-clipper" })],
    ["Enter next universe", () => subject.dispatch({ type: "project", id: "universe-next-door" })],
    ["Save round-trip", () => (subject = importPaperclipsReference(subject.exportSave(1_000)))],
  ]);
  const wired = wireFrame(frame, () => paperclipsLabState(subject));
  root.prepend(
    casePicker(["Retail opening", "Powered industry", "Probe expansion", "Ending"], (index) => {
      subject = paperclipsLabCase(index);
      wired.render();
    }),
  );
}

function paperclipsLabCase(index: number): ReturnType<typeof createPaperclipsReference> {
  const subject = createPaperclipsReference();
  if (index === 0) return subject;
  subject.game.dispatch({
    id: "paperclips-lab-case",
    execute: (transaction) => {
      transaction.setProgress("milestone", "industry-phase");
      transaction.set(paperclipsResources.clips, index === 1 ? 1e24 : 5e31);
      if (index >= 2) {
        transaction.setProgress("milestone", "space-phase");
        transaction.set(paperclipsResources.probeTrust, 20);
        transaction.set(paperclipsResources.probes, 1e9);
      }
      if (index === 3) {
        transaction.setProgress("upgrade", "accept-exile");
        transaction.set(paperclipsResources.operations, 300_000);
      }
    },
  });
  return subject;
}

function paperclipsLabState(subject: ReturnType<typeof createPaperclipsReference>) {
  const snapshot = subject.getSnapshot();
  return {
    phase: paperclipsPhase(snapshot),
    clips: snapshot.resources.clips,
    funds: snapshot.resources.funds,
    wire: snapshot.resources.wire,
    probes: snapshot.resources.probes,
    factories: snapshot.purchaseCounts[paperclipsBuyables.factory.id] ?? 0,
    projects: Object.keys(snapshot.progression.upgrades).length,
    gameTimeMs: snapshot.gameTimeMs,
  };
}

type LabAction = readonly [string, () => unknown];

function createFrame(root: HTMLElement, title: string, actions: readonly LabAction[]) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  const controls = document.createElement("div");
  controls.className = "lab-controls";
  for (const [label, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      controls.dispatchEvent(new CustomEvent("lab-action", { detail: action() }));
    });
    controls.append(button);
  }
  const result = document.createElement("output");
  result.setAttribute("aria-live", "polite");
  const state = document.createElement("pre");
  state.setAttribute("aria-label", `${title} normalized state`);
  root.append(heading, controls, result, state);
  return { controls, result, state };
}

function wireFrame(frame: ReturnType<typeof createFrame>, read: () => unknown) {
  const render = () => {
    frame.state.textContent = JSON.stringify(read(), null, 2);
  };
  frame.controls.addEventListener("lab-action", (event) => {
    const value = (event as CustomEvent<unknown>).detail;
    frame.result.value = outcome(value);
    render();
  });
  render();
  return { render };
}

function casePicker(labels: readonly string[], choose: (index: number) => void): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = "Source case ";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Source case");
  labels.forEach((text, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = text;
    select.append(option);
  });
  select.addEventListener("change", () => choose(select.selectedIndex));
  label.append(select);
  return label;
}

function outcome(value: unknown): string {
  if (typeof value === "boolean") return value ? "legal action applied" : "blocked by requirements";
  if (value && typeof value === "object" && "ok" in value)
    return (value as { readonly ok: boolean }).ok
      ? "legal action applied"
      : "blocked by requirements";
  return typeof value === "string" ? value : "state updated";
}
