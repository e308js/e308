# S06 evidence: independent UX and renderer breadth

S06 adds optional, framework-independent view contracts and a semantic DOM renderer. Implementation
commit `ab93cbd64ad7cd6c4283bc0dc576781d734e259d` passed
[GitHub Actions run 34299737625](https://github.com/e308js/e308/actions/runs/34299737625).

## Delivered contracts

- `ViewSource<State, Intent, Result>` keeps rendering independent from core. A source owns state and
  validation; projections resolve visible data and exact revision-bound intents without copying
  economy calculations into the UX package.
- Typed views cover actions and blockers, resources, quotes, tagged ETAs, reset previews, offline
  reports, save state, rich descriptions, trees, grids, nested tabs, progress bars, infoboxes,
  marks, notifications, inputs, hotkeys, trusted custom slots, and particle layers.
- Localization uses keys with validated named scalar, quantity, and duration arguments. Rich text
  uses an ordered node union and a restricted link policy rather than HTML strings.
- Numeric formatting consumes a game adapter’s codec and supports named plain, scientific, and
  engineering formats without converting large values through native-number arithmetic.
- `mountView` renders semantic unstyled DOM, supports game-owned component overrides, preserves
  keyed focus and text selection, retains local navigation/disclosure state, suppresses hidden
  content, and removes subscriptions, listeners, timers, frames, and custom slots on disposal.
- Hold actions persist across synchronous source rerenders. Scoped hotkeys avoid typing controls.
  Particle motion uses only an injected visual clock; reduced motion disables it, and durable claim
  state remains owned by the source.
- The optional `starterTheme` is an exported CSS string. Public subpaths expose `/dom`, `/effects`,
  `/format`, `/localization`, and `/views` from packed ESM archives.

## Gallery and browser evidence

The independent gallery mounts one observable kernel into a positioned tree and a panel/grid
composition at the same time. Playwright verifies synchronized keyboard and touch actions, keyed
focus after rerender, hidden tab content, grid navigation, a once-only collectible across both
views, normal motion, and reduced motion. Passing runs attach a full-page screenshot and a JSON
interaction trace to the Playwright report. [The gallery map](s06-gallery-map.md) ties the S06 cases
to TMT groups T18–T31 and T36–T37.

Vitest separately covers a non-core source, exact stale-command dispatch, selector equality,
blockers and previews, all tree/grid/bar directions and variants, safe content, every input type,
hold repetition, scoped hotkeys, focus/disclosure retention, repeated mount/dispose, control
overrides, custom-slot cleanup, particle callbacks and claim suppression, and injected visual time.

## Validation and limits

The implementation-head suite passed 211 Vitest tests and two Playwright tests with 96.16%
statements, 88.91% branches, 98.55% functions, and 97.68% lines. Every executable production file
passed the 80% thresholds for all four metrics. Strict TypeScript, Biome with warnings rejected,
production file/function limits, the 500-line test-file limit, builds, and archive consumers passed
locally and in exact-head CI.

This slice proves renderer interactions and component breadth. S07 remains responsible for wall
clock reconciliation, IndexedDB storage, autosave/import/export execution, writer ownership,
workers, hidden-tab catch-up, cancellation races, and two-tab behavior. The full TMT leaf audit and
complete interactive reference games remain assigned to S10–S11.
