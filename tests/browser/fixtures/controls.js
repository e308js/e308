import { mountView, starterTheme } from "/packages/ux/dist/index.js";

document.querySelector("#theme").textContent = starterTheme;
const listeners = new Set();
let value = "practice";
const source = {
  getSnapshot: () => value,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  dispatch(next) {
    value = next;
    for (const listener of listeners) listener(value);
  },
};
const resolver = { text: String, argument: String };
for (const id of ["first", "second"]) {
  mountView(document.getElementById(id), {
    source,
    resolver,
    project: (selected) => ({
      content: [
        {
          kind: "select-input",
          id: "mode",
          ...(id === "first" ? { domId: "custom-mode" } : {}),
          label: "Play mode",
          value: selected,
          options: [
            { value: "practice", label: "Practice against a computer" },
            { value: "online", label: "Online with friends" },
          ],
          intent: (next) => next,
        },
      ],
    }),
  });
}
