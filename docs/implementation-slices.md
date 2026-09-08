# Capability slices and acceptance evidence

Status: **implementation active**. S00 through S02 are accepted and S03 is in progress; exact evidence lives in [status.md](status.md). Each entry inherits the complete delivery checklist in [implementation-plan.md](implementation-plan.md) and all [quality gates](quality-gates.md). These are AI-sized capability integrations, not small human-review-sized commits.

The file paths below are proposed module areas, not prescribed individual files. Modules must obey size/dependency rules and keep semantic ownership clear. Each slice includes appropriate public type declarations, implementation, tests and authoring documentation. Follow-up corrective commits are allowed; the final pushed SHA is the acceptance subject.

## S00 — Foundation, enforcement and acceptance inventory

**Deliver:** Verify/create the authorized GitHub working repository/branch; establish pinned pnpm, two ESM packages, strict TS including `exactOptionalPropertyTypes`, `tsc`, Biome, Vitest/fast-check, coverage and structure tools, archive-consumer smoke tests, and GitHub Actions/required checks. Define the slice/evidence manifest and artifact conventions. Resolve actual permissions rather than assuming organization access.

**Contract work:** Freeze TMT's leaf-level source inventory and the AD/Kittens reference-scenario IDs and dependencies. Add type-only fixture designs for numeric adapters, inference, scoped handles and public UX contracts. Implement compilable signature fixtures without pretending dummy implementations are engine features. No empty runtime stubs are exported as working APIs.

**Areas:** package/toolchain configuration, `tools/quality`, `tests/types`, `tests/reference/manifests`, CI workflows.

**Tests:** Expected rejection of each bad quality fixture; strict TS/JS package consumption for currently available type exports; source inventory covers all pinned documents with unresolved implementation leaves explicitly NOT RUN. Executable tooling meets coverage. Type-only packages have honest denominator reports.

**Commit:** `S00 establish workspace and enforced delivery gates`.

**CI evidence:** Green baseline jobs on pushed head; four-metric tool coverage, gate rejection tests, package/type artifacts, complete source inventory, repository check configuration/limitations. Exit only after an actual remote run; local setup is not enough.

## S01 — Deterministic headless foundation

**Deliver:** Native and chosen large-number adapters/codecs; factory-scoped handles; immutable definitions/module dependency resolution; scoped state; transactions/copy-on-write snapshots; stable commands/results; canonical fixed-step advancement/remainder; versioned RNG and named stream derivation.

**Areas:** `core/numbers`, `core/definitions`, `core/state`, `core/simulation`, `core/random`; public exports and consumer examples.

**Tests:** Arithmetic/codec and independently known RNG vectors; domain failures rollback; instance isolation; cross-definition rejection; dependency order; snapshot identity/no later mutation; time partitioning and remainder preservation; no browser globals or import side effects.

**Commit:** `S01 add deterministic state time and numeric foundation`.

**CI evidence:** Shared gates plus headless replay/type-consumer reports and numeric/RNG vectors. No production mechanics or persistence completeness claimed yet.

## S02 — Economic primitives and numerical purchasing

**Deliver:** Typed constant/proportional/product rates and custom stepped rules; flows and instant recipes; explicit input/output reservation; capacity/overflow; worker/power allocation budgets; production counters; modifier stages/breakdowns; buyables/sell/respec; cumulative curves and max-buy. Complete the huge-count interface before implementation: numeric-backed totals versus bounded executable iteration are distinct.

**Areas:** `core/economy`, `core/balance`, structured economic outcomes; first headless Wireworks/Cascade/Hearth kernels.

**Tests:** Independent rational flow/chain/ledger oracles; shared inputs and priority ties; mixed capacity policies; no unpaid production; discrete count domains; geometric/segmented pricing and threshold rounding; sell/refund counters; large values/counts beyond native range; modifier order; meaningful custom-rule fallback.

**Commit:** `S02 implement composable economy and scalable purchases`.

**CI evidence:** Shared gates plus economic oracle/property reports, applicable TMT leaves and three tiny scenario traces. These kernels are not complete showcase games.

## S03 — Progression and the AD reference laboratory

**Deliver:** Normal/static/custom prestige recipes; explicit reset scopes and retention; unlock order, deactivation and win state; upgrades/milestones/achievements; challenges with membership, bulk completion and reward ledger; automation schedules using validated commands. Finalize schedule/condition/action types before code. Use controlled explicit-delta traces to express AD source timing through public APIs/extensions.

**Areas:** `core/progression`, `core/automation`, reference AD subject and isolated upstream runner, Cascade progression content.

**Tests:** Queued command invalidation; pre-reset reward calculation; multiple layers/retained scopes; challenge combinations and conflicts; once-only bulk rewards; stale previews; scheduled priority/cadence; independent prestige math. Run AD01–AD05 and the controlled tick/numeric portions of AD06; TMT formula differentials and interactions.

**Commit:** `S03 implement progression and verify AD mechanics`.

**CI evidence:** Shared gates plus upstream/e308 normalized traces and source-valid fixtures. Save/offline/browser portions remain assigned to S04/S07/S10, not falsely passed here. Reference code cannot be imported by the e308 subject.

## S04 — Durable state and recoverable offline processing

**Deliver:** Concrete save JSON schemas/validators, module/numeric migrations, version transitions, saved entitlement, catch-up planning/ledger, cancel/resume, report aggregation, custom offline policy hook, transactional storage port and a fault-injectable adapter. Define command/result and event delivery idempotency boundaries. Complete non-null save examples and update tests before implementation.

**Areas:** `core/storage`, `core/offline`, migration fixtures and fault harness.

**Tests:** Round-trip all introduced state; 30-hour absence/eight-hour cap once-only; disabled/dynamic/unlimited policies; negative/invalid clocks; crash at every commit boundary; numerical codec mismatch; corrupt/future saves; pending-session update and compensation idempotency; RNG/remainders; retained pending time on work limits. Finish AD06 save integration.

**Commit:** `S04 add saves migrations and recoverable offline progress`.

**CI evidence:** Shared gates plus fault matrix and offline reports. Browser ownership/sleep are still NOT RUN until S07.

## S05 — Tasks, calendars, markets and Kittens parity

**Deliver:** Paid tasks with fixed/current-rate work modes; escrow, queues, completion/refund policies; calendar phases and source-defined effects; fixed/changing-price market quotes/trades; custom policy support for Kittens redshift; data needed for story transitions. Finalize task/calendar persisted types before code. Extend public APIs to accommodate source rules rather than embedding game-ID exceptions.

**Areas:** `core/tasks`, `core/calendar`, `core/markets`, Kittens reference subject/runner, Wireworks/Hearth kernels.

**Tests:** Paid output/no double delivery, blocked completion, cancellation overflow, scope reset/task interactions; seasonal boundary ledger; price/fee/volume rounding; stock/payment atomicity; KG01–KG06 reference traces including source redshift policy; PC01–PC03 mapping and original game oracles.

**Commit:** `S05 add timed economies and verify Kittens mechanics`.

**CI evidence:** Shared gates plus both reference suites, independent seasonal/market ledgers, Paperclips mapping. Interactive slice demos can wait for S06/S10; arithmetic parity cannot.

## S06 — Independent UX and renderer breadth

**Deliver:** Concrete view/quote/failure/localization unions; selector subscriptions; formatter/backend compatibility; tagged ETAs; action/reset/offline/save views; unstyled DOM controls and optional starter theme; game-owned composition and override contracts. Add TMT gallery coverage for tree nodes/branches, grids, nested tabs, bars, infoboxes, marks, hotkeys and particles/collectibles. Visual clocks never own game state.

**Areas:** `ux/views`, `ux/format`, `ux/dom`, `ux/effects`, feature gallery, two differently composed views over one kernel.

**Tests:** No copied economy math; accurate blockers/previews; non-core mock source; hidden-content filtering; stale commands; keyboard/touch behavior; keyed focus retention; repeated mount/dispose; all tree/grid/bar variants; reduced-motion behavior; collectible once-only claims across navigation. Add Playwright renderer coverage here; lifecycle coverage expands in S07.

**Commit:** `S06 deliver optional UX and TMT interaction gallery`.

**CI evidence:** Shared gates including first-party UX coverage, required browser interaction jobs, gallery screenshots/interaction traces and clean UX consumer. Screenshots alone do not prove behavior.

## S07 — Real browser host and worker transport

**Deliver:** Explicit browser lifecycle clock reconciliation, IndexedDB transactional adapter, autosave/import/export, single-writer ownership, secondary-view behavior, and worker host. Define versioned message/result/error unions, request IDs/revisions, transfer codecs, cancellation acknowledgments and race behavior before implementing transport.

**Areas:** `core/browser`, `core/worker`, browser integration fixtures.

**Tests:** Two-tab writer contention and transfer; hidden/reload/suspension recovery; save failures; cancellation just before/after chunk commit; stale worker responses; worker/main-thread equality; deterministic clock injection plus identified real-device sleep checks. Exercise all three kernel saves through the browser host.

**Commit:** `S07 integrate browser persistence lifecycle and workers`.

**CI evidence:** Shared gates plus browser matrix and worker/fault traces. Record separate manual/device results honestly; missing required device evidence keeps the corresponding release case open.

## S08 — Bot players, balance sweeps and pacing reports

**Deliver:** Concrete bot observations/legal quotes; seeded scripted/ranked/goal policies; active/away schedules; action replay; parameter sweeps; version-baseline comparison; JSON and readable reports; trace/sample bounds. Freeze reporting statistics and unreachable-goal terminology before implementation.

**Areas:** `core/testing`, `core/balance`, report renderer, scenario catalogs and CLI.

**Tests:** Same legal action path as player; no bot decisions during absence; no hidden-state access; reproducible seeds/schedules; poor-policy stall versus certified barrier; conditional-success statistics with unreached counts; known cost change shifts milestone time; bounded reports and explanatory constraint records. Run policies over all three current games.

**Commit:** `S08 add reproducible bots and pacing diagnostics`.

**CI evidence:** Shared gates plus scenario matrix, replay commands, baseline difference reports and sweep results. Readable report generation must not depend on a running browser.

## S09 — Optimized time advancement and limits

**Deliver:** Checked constant-rate and chain/event shortcuts, fallback rules, optional explicitly labeled approximations, backlog handling and profilers. Complete bulk-capability/precondition types before code. Canonical numerical identity and approximation remain different modes.

**Areas:** focused simulation optimizers, reference/property tests, benchmark fixtures and reports.

**Tests:** Independent recurrence values, canonical/optimized equivalence at boundaries, numeric precision/rounding, automation/caps/resets/calendar invalidation, custom callback fallback, random draw preservation, operational bounds preserving pending work. Run all reference and scenario suites again.

**Commit:** `S09 optimize advancement with validated correctness bounds`.

**CI evidence:** Shared gates plus optimized/reference comparisons and workload reports. Freeze reference-machine details before measuring; CI microbenchmarks do not replace D7's hardware-specific budget evidence. No default approximate speedup to rescue failed canonical targets.

## S10 — Three finished games and clean-consumer proof

**Deliver:** Complete Wireworks, Cascade and Hearth to D2's content/ending requirements, including consequential choices, instructions, accessible distinct layouts, saves and offline summaries. Package each as an independent archive consumer. Provide interactive AD/Kittens parity laboratories; test-only cloning/ports are allowed, with attribution and separate oracle implementations.

**Areas:** three game content/view modules, independent consumer projects, authored tests/oracles and completion traces.

**Tests:** From-new-save legal winning scripts without debug grants; beginning/middle/end saves; all required policies/absences; complete D4 recovery matrix; at least two strategies with differing consequences; all source-parity slices in interactive form; two renderers over identical state; game logic coverage stays above threshold.

**Commit:** `S10 complete three games and end-to-end engine evidence`.

**CI evidence:** Shared gates plus full completion traces, human-reviewed walkthrough records, clean-consumer builds, D7 rerun on final game content and D1R interactive results. New modules or mechanics introduced here require the same earlier-type/oracle standards; being game content is not an exemption.

## S11 — Release candidate and parity closure

**Deliver:** Reconcile every TMT source leaf, required reference case and D1–D8/D1R requirement to actual evidence; resolve missing features rather than mark them N/A. Replace the planning-era root README with ordinary developer documentation covering installation, a runnable first game, core concepts, package/API maps, renderer integration, testing and compatibility. Finish public API/reference docs, migration guides, examples and package archives. Independently review test-source mapping and game distinctness/usability.

**Tests:** Clean checkout and immutable installation; entire type/lint/structure/coverage/package/browser/reference/property/scenario suite; complete workload matrix on release SHA; no unknown/missing/skipped required evidence. Validate emitted public types and exports from the actual archive, not workspace aliases.

**Commit:** `S11 close parity gates and produce release candidate`.

**CI evidence:** Green current pushed head plus SHA-keyed evidence manifest, installable archives and review results. The report states precise parity scope, runtime/backend support, all four coverage metrics and remaining nonrelease scope. npm publication is a separate action; a release candidate archive is enough for the completion gate.

## Completion record

Each slice gets a record with: ID, status, prerequisite SHAs, current accepted SHA/branch, CI URLs/job conclusions, artifact hashes/paths, coverage summaries, Biome/structure results, accepted exception records if any, source cases passed, and outstanding future cases. Until evidence exists, status remains PLANNED or IN PROGRESS; local success is never relabeled as remote validation.
