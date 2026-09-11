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
          kind: "help",
          id: "mode-help",
          label: "About play mode",
          preview: id === "first",
          previewMoveDismissPx: new URLSearchParams(location.search).has("moving") ? 24 : undefined,
          targetId: id === "first" ? "custom-mode" : undefined,
          content: [
            {
              kind: "description",
              id: "explanation",
              content: [
                {
                  kind: "text",
                  value:
                    `Current mode: ${selected}. Practice lets you learn at your own pace. Online connects you with friends. `.repeat(
                      new URLSearchParams(location.search).has("long") ? 30 : 1,
                    ),
                },
                {
                  kind: "link",
                  href: "#first",
                  children: [{ kind: "text", value: "Mode settings" }],
                },
              ],
            },
          ],
        },
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

Object.assign(window, { refreshControls: () => source.dispatch(value) });
