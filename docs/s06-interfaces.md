# S06 interface decisions

This document freezes the public UX boundary before the S06 renderer implementation. The UX
package may consume core types, but its source and renderer contracts do not require a core game.

## Source and command boundary

`ViewSource<State, Intent, Result>` exposes `getSnapshot`, one committed-snapshot subscription, and
`dispatch`. A projector turns the current snapshot into resolved `ViewNode<Intent, Quantity>` data.
The renderer dispatches the exact intent stored on a control; it never reconstructs costs, rewards,
reset gain, or eligibility. Games can therefore bind revision-checked core commands, while tests and
other state libraries can provide the same small contract.

Subscriptions publish committed snapshots. A mount owns exactly one source subscription and one
keyboard listener, and `dispose` removes both. Renders preserve focus and text selection by stable
view keys. Tabs and disclosures are renderer-local presentation state and cannot change simulation
time or durable game state.

## Text and localization

Visible text is either a literal string or `{ key, args }`. Named arguments are strings, finite
numbers, booleans, typed quantities, or typed game/real durations. Catalog lookup validates missing
and extra arguments before interpolation. Missing messages have an explicit fallback policy.

Rich descriptions are ordered text, message, emphasis, strong, code, line-break, and link nodes.
Links allow `https:`, `http:`, `mailto:`, hash, or same-origin relative targets. The renderer never
accepts HTML strings. A custom DOM slot is an explicit trusted game callback with a disposal hook.

## Resolved views

The public unions cover resources, costs, actions, reset previews, offline summaries, save status,
tree nodes and styled branches, dynamic grids, nested tabs, all four progress fill directions,
infoboxes, marks/highlights, inputs, hotkeys, notifications, custom slots, and particle layers.
Hidden nodes are omitted from DOM and accessibility output. Locked controls receive only the
revealed blockers supplied by the projector.

Failure views include insufficient, capacity-blocked, locked, cooldown, invalid-count,
allocation-exceeded, stale-revision, invalid-target, disabled, budget-exceeded, numeric-fault, and
transaction-failed. Extensions use `{ kind: "extension", namespace, code, fallbackKey, details }`.
Quantities remain in the game backend until a formatter renders them.

ETAs are tagged as finite game time, finite real time, blocked, capacity-unreachable, or unknown.
Capacity-unreachable includes its assumptions and proof scope and is a forecast diagnosis rather
than an automatic command failure.

## Renderer and effects

`mountView` takes a root element, source, projector, catalog/formatter options, and optional control
overrides. The default renderer uses semantic, unstyled DOM. The starter theme is an exported CSS
string that a host may opt into. An override receives the resolved node and renderer context and may
return a replacement element; state and command ownership stay with the source.

Particles are ephemeral definitions keyed by ID. Motion uses injected visual-clock functions and
is disabled when reduced motion is requested. Interactive particles dispatch authored intents.
Collectible claim IDs are suppressed locally after the first dispatch and must also be represented
as claimed in the next source snapshot for durable once-only behavior across remounts or navigation.
The visual clock never advances a game or calculates an offline award.

## S06 evidence limits

Vitest exercises projections, formatting, localization, DOM lifecycle, accessibility, focus,
overrides, effects, and the non-core source contract. Playwright exercises the built gallery in
Chromium with keyboard and pointer input. S07 remains responsible for browser lifecycle clock
reconciliation, IndexedDB ownership, autosave, workers, hidden-tab catch-up, and two-tab races.
