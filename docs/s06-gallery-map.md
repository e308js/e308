# S06 TMT interaction gallery map

The gallery maps the pinned TMT 2.7 presentation capabilities to independent e308 contracts and
interactive cases. It establishes component behavior through public UX exports; it does not claim
pixel compatibility or Vue source compatibility.

| Parity group | Gallery/public surface | Automated evidence |
| --- | --- | --- |
| T18 grids | Dynamic rows/columns, hidden cells, square/round cells, click/hold actions and marks | Vitest DOM grid/hold cases; Playwright Grid tab action |
| T19–T20 trees | Positioned ordinary/side/ghost nodes, styled branches, node actions, marks and highlights | Vitest tree variants; Playwright tree composition |
| T21–T22 composition | Keyed nested tabs, hidden/disabled tabs, rows, stacks, inserted components and overrides | Vitest nested navigation/override/lifecycle; Playwright Work/Grid tabs |
| T23 rich content | Text, token, emphasis, strong, code, break, safe link, image and trusted custom slot | Catalog and DOM tests, including rejected script link |
| T24 inputs | Text, range, select and toggle intents | Vitest input dispatch; Playwright keyed text input |
| T25 bars | Horizontal/vertical and four fill directions, clamping, optional motion | Vitest variants; Playwright normal/reduced motion |
| T26 infoboxes | Dynamic title/body and retained local disclosure state | Vitest disclosure rerender case |
| T27–T28 styles/marks | Typed style metadata, images, marks, notifications and prestige/notification highlights | Vitest gallery; Playwright screenshot |
| T29 hotkeys | Modifiers, active scope, unlock flag, typing suppression and descriptions | Vitest hotkey matrix; Playwright `m` action |
| T30–T31 particles | Text/image particles, position/size/velocity/gravity/rotation/fade/lifetime, reduced motion, click/hover/leave intents and once-only claim suppression | Vitest injected-clock/effect cases; Playwright collectible and reduced-motion cases |
| T36 selectors/extensions | Generic observable source, selector equality, exact intents and custom DOM slot | Non-core source tests and override/custom-slot lifecycle tests |
| T37 setup | Workspace example builds against public `@e308/ux` exports | Package build, archive consumer and Playwright gallery |

The full leaf-by-leaf reconciliation remains a release task in S11. S06 supplies the concrete
components and executable interaction evidence needed by these groups.
