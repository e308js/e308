# S10 evidence — finished games and clean consumers

Status: **IN REVIEW**. Candidate commit
`3005bca0b7a10d43ea57b01a60ef910a5acf3664` passed the complete GitHub Actions quality workflow.
Acceptance still requires a recorded walkthrough on desktop and touch layouts. The reviewer may be
the implementer.

## Delivered scope

- `@e308/game-wireworks`: a three-era market and automation game with separate manufacturing and
  sales, mutually exclusive doctrine choices, a terminal projection, and a visible ending.
- `@e308/game-cascade`: an eight-tier break-eternity game with three reset layers, compatible and
  composite challenges, allocation/respec decisions, automation, values above `1e308`, and a visible
  ending.
- `@e308/game-hearth`: a seasonal settlement game with workforce allocation, capacity pressure,
  crafting, research, paid tasks, shortage/recovery events, and a visible ending.
- A browser host using public core and UX contracts, IndexedDB persistence, ownership, offline
  reconciliation, save import/export/reset, and game-owned layouts.
- Interactive bounded AD01–AD06 and KG01–KG06 laboratories for private parity review. These carry
  attribution and do not claim full-game parity.

The public project site boundary is explicit: it will launch all three original games and will not
publish the reference laboratories or cloned/reference games.

## Automated local evidence

`pnpm quality` passed on September 8, 2026 with the pinned workspace toolchain:

- Biome checked 272 files with warnings treated as errors.
- Strict TypeScript, package boundaries, file/function size, duplicate-block, and DOM/timer/storage
  isolation gates passed.
- Vitest ran 56 files and 307 tests. Every production file remained above 80% for statements,
  branches, functions, and lines; the three game packages aggregate to 96.14% statements, 89.31%
  branches, 98.27% functions, and 97.67% lines.
- The finished-game matrix covered beginning, middle, and end checkpoints across 0, 1 minute, 1 hour,
  8 hours, 1 day, and 30 days under disabled, fixed-eight-hour, dynamic, and unlimited offline
  policies, including exact interruption/resume behavior.
- Twenty-seven pacing runs covered three bot policies and active, intermittent, and long-absence
  schedules for every game. All authored goals were reached.
- Clean temporary consumers installed packed core, UX, and all three game archives and advanced each
  game without workspace aliases.
- Playwright ran six browser cases covering the renderer gallery, browser host, three game layouts,
  reference labs, save workflows, 44-pixel touch targets, and the browser long-task assertion.

Generated evidence is written below `artifacts/finished-games/`. It includes JSON and Markdown pacing
reports, encoded beginning/middle/end checkpoint saves, and final-content workload measurements.
The final-content workload run used a Ryzen 9 8945HS and Node 24.14.1; measured warm p95 times for an
eight-hour absence were approximately 119 ms for Wireworks, 1,262 ms for Cascade, and 75 ms for
Hearth. Thirty-day work remains bounded and preserves its pending backlog after the configured
200,000-step work limit.

## Open acceptance evidence

- Record a walkthrough of every consequential choice and ending.
- Record desktop and touch interaction review, including the distinct layouts and Wireworks terminal
  projection.

Until those items exist, this slice remains IN REVIEW rather than ACCEPTED.

## Pushed evidence

- Candidate: `3005bca0b7a10d43ea57b01a60ef910a5acf3664`
- Branch: `main`
- Workflow: [quality run 34314774684](https://github.com/e308js/e308/actions/runs/34314774684)
- Conclusion: success, including SHA-keyed artifact upload
