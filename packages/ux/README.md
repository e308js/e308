# @e308/ux

Optional, framework-independent views and DOM controls for e308 games. The package renders resolved
state and dispatches game-authored intents. Simulation time, saves, and economy math remain in the
game's state source.

```ts
import { nativeNumbers } from "@e308/core";
import {
  createQuantityFormatter,
  createTextResolver,
  mountView,
  type ViewDocument,
} from "@e308/ux";

const resolver = createTextResolver({
  quantities: createQuantityFormatter(nativeNumbers),
  messages: { points: "Points: {value}" },
});

const project = (state: State): ViewDocument<Intent, number> => ({
  content: [
    {
      kind: "action",
      id: "make",
      action: {
        id: "make",
        label: "Make a point",
        enabled: true,
        blockers: [],
        intent: { type: "make", expectedRevision: state.revision },
      },
    },
  ],
});

const root = document.querySelector<HTMLElement>("#game");
if (!root) throw new Error("missing game root");
const mounted = mountView(root, { source, project, resolver });

// mounted.dispose() removes the subscription and keyboard listener.
```

`ViewSource` is a three-method structural interface, so the renderer works with an e308 `Game`, a
small adapter, or another state store. Use `fromSelectableSource` for stores with selector-based
subscriptions. Controls are semantic and unstyled by default. Add the exported `starterTheme` CSS
or supply your own styles and control overrides.

Subpath exports are available for `@e308/ux/dom`, `/effects`, `/format`, `/localization`, and
`/views`. The feature gallery under `examples/gallery` demonstrates two layouts observing one
kernel, tree and grid controls, nested navigation, hotkeys, progress bars, and a durable collectible.
