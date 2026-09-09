import type { TextResolver } from "../localization/types.js";
import type { InputView } from "../view/nodes.js";
import { keyed } from "./elements.js";

export function renderInput<Intent, N>(
  document: Document,
  view: InputView<Intent, N>,
  resolver: TextResolver<N>,
  dispatch: (intent: Intent) => unknown,
): HTMLElement {
  const label = keyed(document, "label", view.id);
  label.className = "e308-input";
  label.append(document.createTextNode(resolver.text(view.label)));
  if (view.kind === "toggle-input") return renderToggle(document, view, label, dispatch);
  if (view.kind === "select-input") return renderSelect(document, view, label, resolver, dispatch);
  const input = document.createElement("input");
  input.dataset.e308Key = `${view.id}:control`;
  input.type = view.kind === "text-input" ? "text" : "range";
  input.value = String(view.value);
  if (view.kind === "range-input") {
    input.min = String(view.min);
    input.max = String(view.max);
    input.step = String(view.step);
  }
  input.addEventListener("input", () => {
    dispatch(
      view.kind === "text-input" ? view.intent(input.value) : view.intent(input.valueAsNumber),
    );
  });
  label.append(input);
  return label;
}

function renderToggle<Intent, N>(
  document: Document,
  view: Extract<InputView<Intent, N>, { kind: "toggle-input" }>,
  label: HTMLElement,
  dispatch: (intent: Intent) => unknown,
): HTMLElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = view.value;
  input.dataset.e308Key = `${view.id}:control`;
  input.addEventListener("change", () => dispatch(view.intent(input.checked)));
  label.prepend(input);
  return label;
}

function renderSelect<Intent, N>(
  document: Document,
  view: Extract<InputView<Intent, N>, { kind: "select-input" }>,
  label: HTMLElement,
  resolver: TextResolver<N>,
  dispatch: (intent: Intent) => unknown,
): HTMLElement {
  const select = document.createElement("select");
  select.dataset.e308Key = `${view.id}:control`;
  for (const option of view.options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = resolver.text(option.label);
    select.append(element);
  }
  select.value = view.value;
  select.addEventListener("change", () => dispatch(view.intent(select.value)));
  label.append(select);
  return label;
}
