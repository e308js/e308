# S07 evidence: browser persistence, lifecycle, and workers

S07 connects the deterministic kernel to real browser clocks, storage, ownership, and workers.
Implementation commit `a71a4b96980e83dcd0e9b747c75a3a5d77ad6620` passed
[GitHub Actions run 34303068893](https://github.com/e308js/e308/actions/runs/34303068893).

## Delivered contracts

- `@e308/core/browser` exposes separate wall and monotonic clocks, lifecycle binding, serialized
  autosaves, validated import/export/reset, observable host events, and bounded offline catch-up.
  Fractional `performance.now()` deltas accumulate in the host and enter the canonical kernel only
  as whole milliseconds.
- The active loop uses monotonic deltas. Hidden/pagehide transitions reconcile active time before
  saving. Visible/pageshow/reload transitions derive absence only from the durable wall anchor, so
  the same interval is not added from two clocks.
- `IndexedDbSaveStore` performs revision comparison, backup rotation, and replacement in one
  read/write transaction. Request, transaction, blocked-open, and storage failures reject.
- `WebLockOwnership` gives one tab the write lock and broadcasts committed revisions to secondary
  views. Explicit handoff waits for the existing owner to release. Browsers without Web Locks use
  optimistic ownership; revision broadcasts demote peers and compare-and-swap conflicts prevent a
  stale overwrite.
- `@e308/core/worker` defines version-1 initialize, advance, dispatch, catch-up, cancel, snapshot,
  and dispose messages. Request IDs are retry-idempotent, mutations require the current revision,
  intents and snapshots use a game-owned structured-clone codec, and stale responses cannot replace
  newer client state.
- Worker catch-up commits only complete engine chunks. Cancellation is observed between chunks and
  acknowledges the last committed revision and snapshot. The same public command validation path is
  used on the main thread and worker.

## Automated evidence

Vitest covers deterministic clock injection, fractional clock carry, hidden/show and pagehide/
pageshow reconciliation, wall-clock anomalies, serialized concurrent saves, autosave cancellation,
secondary write rejection, takeover, imports, resets, storage conflicts/faults, real IndexedDB
transactions/backups, Web Lock contention/fallback, lifecycle binding, protocol rejection,
idempotent replies, stale revisions, invalid intents, worker/main-thread equality, and cancellation
after a committed chunk. Wireworks, Cascade, and Hearth each round-trip through `BrowserHost`.

Playwright uses browser-native IndexedDB, BroadcastChannel, Web Locks, and a module worker. Two pages
prove one-writer behavior, read-only secondary behavior, revision propagation, explicit ownership
transfer, and save transfer in both directions. A separate case advances an actual worker and
reloads the durable browser save. These run alongside the S06 keyboard, touch, focus, collectible,
and reduced-motion gallery cases. The two-tab case attaches its revision/state trace to the report.

The implementation-head suite passed 232 Vitest tests and four Playwright tests. Coverage was
96.02% statements, 88.92% branches, 98.06% functions, and 97.66% lines; every executable production
file passed 80% for all four metrics. Strict TypeScript, Biome with warnings rejected, file/function/
duplication/import-boundary gates, builds, frozen installation, and packed-package consumers passed
locally and in exact-head CI. CI uploaded coverage, package builds, Playwright reports, screenshots,
traces, and test results under the SHA-keyed
`quality-a71a4b96980e83dcd0e9b747c75a3a5d77ad6620` artifact.

## Open device evidence

Operating-system sleep on a named physical device/browser is **NOT RUN**. Injected-clock suspension,
browser reload, page lifecycle, and hidden-state rules are automated, but they do not prove a real
OS sleep/wake sequence. The corresponding D4 real-device row remains open for S10/S11 release
closure. S08 remains responsible for bot and pacing diagnostics; S10 expands the browser recovery
matrix over the three finished games.
