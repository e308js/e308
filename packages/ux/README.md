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
root.classList.add("e308-root");
const mounted = mountView(root, { source, project, resolver });

// mounted.dispose() removes the subscription and keyboard listener.
```

`ViewSource` is a three-method structural interface, so the renderer works with an e308 `Game`, a
small adapter, or another state store. Use `fromSelectableSource` for stores with selector-based
subscriptions. Controls are semantic and unstyled by default. Add the exported `starterTheme` CSS
and the `e308-root` class for the baseline theme, or supply your own styles and control overrides.

Subpath exports are available for `@e308/ux/dom`, `/effects`, `/format`, `/localization`, and
`/views`. The feature gallery under `examples/gallery` demonstrates two layouts observing one
kernel, tree and grid controls, nested navigation, hotkeys, progress bars, and a durable collectible.

## Accessible baseline primitives

The public `ViewNode` union includes semantic layout and interaction primitives in addition to basic
inputs and actions:

- `infobox` uses native details/summary and retains the user's open/closed state across live
  updates, including synchronous input dispatch before the browser delivers its queued toggle event.
- `help` renders a named, keyboard- and touch-operable disclosure. Its `popover` presentation closes
  with Escape and returns focus to the trigger when focus was inside; `expanded` keeps help in the document reading order.
  Set `preview: true` to open popover help after 120 ms over the actual info trigger (not its
  surrounding layout box), or immediately on keyboard focus. `previewDelayMs` overrides the mouse
  delay. Passing across the trigger cancels pending help. A small arrow indicates click/tap pinning.
  Moving away closes an
  unpinned preview; clicking, tapping, Enter, or Space pins it open. Activate again or press Escape
  to dismiss. Escape also closes hover previews while focus is elsewhere, preserving that focus.
  For brief, noninteractive game hints, opt into `previewMoveDismissPx: 24` to dismiss a mouse-opened
  mouse preview after that much displacement from its opening position, even over the popup itself.
  Small pointer jitter is ignored. Dismissed previews stay closed until the trigger is re-entered;
  mouse-pinned help also closes; keyboard and touch help are unaffected. This is a deliberate alternative to persistent
  hoverable content, not the default accessibility policy; avoid it for long or interactive help.
  Preview and pinned state survive live renders. Popovers fit the viewport, scroll long content,
  reposition on scroll/resize, and avoid covering the focused control. The starter theme retains
  44px triggers and visible focus; `preview` is ignored for expanded help.
  Put structured `description`, `quantities`, and other view nodes in its content instead of relying
  on a native `title` attribute.
- `command-feedback` associates `pending`, `success`, or `failure` state with a stable action/form
  `targetId`. Success and pending use `role="status"`; failures use `role="alert"`. Error summaries
  can link to controls with public `domId` values, and `focusOnError` opts into one-time error focus.
  `banner` and `toast` presentations remain viewport-visible for asynchronous Worker or network
  results.
- `section` provides `plain`, `card`, and sticky `status-strip` variants. `fieldset` provides a real
  fieldset and legend for related controls.

`ActionView.blockers` and `actionFromQuote()` remain the canonical availability model. Unavailable
actions use `aria-disabled` rather than native `disabled`, remain focusable, and expose a visible,
structured reason list through `aria-describedby`. A game may instead leave an action enabled and
render contextual rejection with `command-feedback`; legality and blocker authority always belong
to the game. `ActionView.state` distinguishes pending, successful, and rejected commands, while
`tone` selects primary, secondary, or destructive hierarchy.

## Starter-theme layout classes

Public `ViewStyle.className` composes the baseline classes. Use `e308-action-group` on a row for a
wrapping action hierarchy. The rendered section variants provide `e308-section-card` and
`e308-section-status-strip`; tabs scroll within their tablist at narrow widths. Inputs and action
targets are at least 44 CSS pixels, toggle checkboxes remain compact inside their larger label target,
and all controls receive visible focus. The theme also constrains narrow content, maintains dark-theme
contrast, and disables nonessential animation when `prefers-reduced-motion` is active.
