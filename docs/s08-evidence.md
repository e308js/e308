# S08 evidence: reproducible bots and pacing diagnostics

S08 adds a player-visible, game-aware harness around the ordinary deterministic kernel.
Implementation head `5bc041d9c898a79a1caa3c9d09879cb9ef69241d` passed
[GitHub Actions run 34305644935](https://github.com/e308js/e308/actions/runs/34305644935).

## Delivered contracts

- `@e308/core/testing` exposes observation-only scripted, ranked, and goal policies. Policies select
  from legal-action quotes and cannot access snapshots, transactions, handles, or definitions.
- The harness verifies unique quote IDs and the current revision, then converts the exact quoted
  intent into the game's ordinary validated command. Missing, blocked, stale, and failed actions are
  recorded without a privileged mutation path.
- Active, idle-open, and absent schedules account separately for real, game, player, discarded, and
  banked time. Player policy runs only during active segments; actual in-game automation continues
  whenever the game advances.
- Reports retain seeds, versions, numeric adapter identity, schedule, fidelity, constraints,
  diagnostics, milestones, bounded traces and samples, and a replay command. Replay applies the
  recorded successful intents without calling the original policy.
- Outcomes distinguish reached goals, authored certified barriers, policy stalls, observed stalls,
  schedule exhaustion, and work limits. Failed policies are never promoted to impossibility.
- `@e308/core/balance` reports reached-only timing distributions with separate unreached counts,
  finite paired parameter sweeps, invalid configurations, and versioned baseline comparisons.

## Scenario and regression evidence

The `@e308/pacing-example` workspace package defines three deliberately different kernels:
Wireworks uses constrained allocation and material conversion, Cascade uses a delayed producer
chain, and Hearth combines worker allocation, capacity, and a player-triggered recipe. Scripted,
ranked, and goal policies run on every kernel with fixed game and bot seeds. All nine runs reach their
authored goal reproducibly.

`pnpm report:pacing` emits JSON and Markdown without a browser. Its paired Hearth sweep changes the
actual food cost from two to three and reports a 1000 ms, 100% regression at the `finish` milestone.
CI uploads the reports under `artifacts/pacing/` with the other SHA-keyed quality evidence.

## Validation

The accepted suite passed 254 Vitest tests and four Playwright tests. Aggregate coverage was 96.01%
statements, 89.00% branches, 98.00% functions, and 97.67% lines; every executable production file
passed 80% for all four metrics. Strict TypeScript, Biome with warnings rejected, file/function/
duplication/import-boundary checks, builds, frozen installation, packed-package consumers, report
generation, replay cases, reference suites, and browser tests passed on the exact pushed head.

The preceding run exposed a browser-fixture race in which a live host could advance between worker
snapshot capture and revision capture. The accepted head takes both from one immutable snapshot and
passed twenty consecutive single-worker Playwright repetitions before the complete local and remote
gates. The failed run remains visible as CI history rather than being erased.
