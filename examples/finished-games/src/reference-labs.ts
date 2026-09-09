import { createGame, createSaveCodec } from "../../../packages/core/src/index.js";
import { subjectState as adState, createAdSubject } from "../../../reference/ad/subject.js";
import {
  assignWorkers,
  build,
  craft,
  createKittensSubject,
  kittensEntitlement,
  subjectState as kittensState,
} from "../../../reference/kittens/subject.js";

export function mountReferenceLabs(adRoot: HTMLElement, kittensRoot: HTMLElement): void {
  mountAd(adRoot);
  mountKittens(kittensRoot);
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
