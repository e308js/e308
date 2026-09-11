import type { TextResolver } from "../localization/types.js";
import type { InputView } from "../view/nodes.js";
import { keyed } from "./elements.js";
import { bindEvent } from "./events.js";

export function renderInput<Intent, N>(
  document: Document,
  view: InputView<Intent, N>,
  resolver: TextResolver<N>,
  dispatch: (intent: Intent) => unknown,
  idPrefix: string,
): HTMLElement {
  const label = keyed(document, "label", view.id);
  label.className = "e308-input";
  label.dataset.inputKind = view.kind;
  if (view.tooltip) label.title = resolver.text(view.tooltip);
  const caption = document.createElement("span");
  caption.className = "e308-input-label";
  caption.textContent = resolver.text(view.label);
  label.append(caption);
  if (view.kind === "toggle-input") return renderToggle(document, view, label, dispatch, idPrefix);
  if (view.kind === "select-input")
    return renderSelect(document, view, label, resolver, dispatch, idPrefix);
  const input = document.createElement("input");
  input.id = view.domId ?? `${idPrefix}-${view.id}`;
  input.dataset.e308Key = `${view.id}:control`;
  input.type = view.kind === "text-input" ? "text" : "range";
  input.value = String(view.value);
  if (view.kind === "range-input") {
    input.min = String(view.min);
    input.max = String(view.max);
    input.step = String(view.step);
    const output = document.createElement("output");
    output.className = "e308-input-value";
    output.value = String(view.value);
    output.textContent = `${view.value} of ${view.max}`;
    const allowedMax = Math.min(view.max, view.allowedMax ?? view.max);
    input.dataset.allowedMax = String(allowedMax);
    bindEvent<InputEvent>(input, "input", (event) => {
      const control = event.currentTarget as HTMLInputElement;
      if (control.valueAsNumber > allowedMax) control.value = String(allowedMax);
      const currentOutput = control.closest("label")?.querySelector("output");
      if (currentOutput) {
        currentOutput.value = control.value;
        currentOutput.textContent = `${control.value} of ${view.max}`;
      }
    });
    const ticks = view.showTicks ? createTicks(document, idPrefix, view) : undefined;
    if (ticks) input.setAttribute("list", ticks.id);
    bindEvent<Event>(input, "change", (event) =>
      dispatch(view.intent((event.currentTarget as HTMLInputElement).valueAsNumber)),
    );
    label.append(input, output);
    if (ticks) label.append(ticks);
    return label;
  }
  if (view.kind === "text-input")
    bindEvent<InputEvent>(input, "input", (event) =>
      dispatch(view.intent((event.currentTarget as HTMLInputElement).value)),
    );
  label.append(input);
  return label;
}

function createTicks<Intent, N>(
  document: Document,
  idPrefix: string,
  view: Extract<InputView<Intent, N>, { kind: "range-input" }>,
): HTMLDataListElement {
  const list = document.createElement("datalist");
  list.id = `${idPrefix}-${view.id}-ticks`;
  for (let value = view.min; value <= view.max; value += view.step) {
    const option = document.createElement("option");
    option.value = String(value);
    list.append(option);
  }
  return list;
}

function renderToggle<Intent, N>(
  document: Document,
  view: Extract<InputView<Intent, N>, { kind: "toggle-input" }>,
  label: HTMLElement,
  dispatch: (intent: Intent) => unknown,
  idPrefix: string,
): HTMLElement {
  label.classList.add("e308-toggle");
  const input = document.createElement("input");
  input.id = view.domId ?? `${idPrefix}-${view.id}`;
  label.setAttribute("for", input.id);
  input.type = "checkbox";
  input.checked = view.value;
  input.dataset.e308Key = `${view.id}:control`;
  bindEvent<Event>(input, "change", (event) =>
    dispatch(view.intent((event.currentTarget as HTMLInputElement).checked)),
  );
  label.prepend(input);
  return label;
}

function renderSelect<Intent, N>(
  document: Document,
  view: Extract<InputView<Intent, N>, { kind: "select-input" }>,
  label: HTMLElement,
  resolver: TextResolver<N>,
  dispatch: (intent: Intent) => unknown,
  idPrefix: string,
): HTMLElement {
  const select = document.createElement("select");
  select.id = view.domId ?? `${idPrefix}-${view.id}`;
  label.setAttribute("for", select.id);
  select.dataset.e308Key = `${view.id}:control`;
  for (const option of view.options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = resolver.text(option.label);
    select.append(element);
  }
  select.value = view.value;
  bindEvent<Event>(select, "change", (event) =>
    dispatch(view.intent((event.currentTarget as HTMLSelectElement).value)),
  );
  label.append(select);
  return label;
}
