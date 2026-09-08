# e308 implementation plan

Status: **ACTIVE IMPLEMENTATION**. [status.md](status.md) records accepted commits and CI evidence; this file remains the governing execution plan.

This plan implements the [definition of done](definition-of-done.md), including TMT capability parity, required Antimatter Dimensions/Kittens Game reference slices, Paperclips coverage, and three complete distinct games. Test-only clones/ports of reference mechanics are allowed. The independently implemented e308 subject must not delegate its answers to the reference runner.

## Work unit and delivery rule

A slice is a substantial, coherent capability suitable for an AI-sized commit. It can span packages, tests, fixtures, docs, and examples. There is no artificial diff-size or file-count ceiling. Its limit is behavioral coherence: the slice must work, be tested, and have an assessable result before it is called complete.

**Every implementation slice follows: implement → test locally → review → commit → push → validate that commit in CI → record evidence.** Local green tests, a pushed commit, or queued CI alone do not complete a slice. All required checks must pass on the current pushed head SHA. Fixes use follow-up commits and repeat validation; do not hide failures by force-pushing rewritten evidence.

Preparatory analysis for a later slice can proceed while CI runs. Implementation dependent on a failed/unvalidated prerequisite cannot be treated as accepted work. Cancelled, skipped, missing, or infrastructure-failed required jobs are not green. Resolve or report the block rather than moving the completion marker forward.

The [quality gates](quality-gates.md) apply to every slice, and [slice specifications](implementation-slices.md) give capability-specific tests and artifacts. Final release evidence is cumulative, not an alternative to per-slice CI.

## Planned sequence

| Slice | Coherent capability delivered | Prerequisite | Release coverage |
| --- | --- | --- | --- |
| S00 | Workspace, CI, Biome, coverage/structure gates, type fixtures and source inventories | Implementation authorized | D1/D1R inventory foundations, D8 |
| S01 | Numeric adapters, scopes/modules, transactions/snapshots, deterministic time and RNG | S00 green | D3, D5, D8 |
| S02 | Production, purchases, huge buyable counts, allocation, modifiers and curves | S01 green | T02–T03/T10–T12/T32, D3 |
| S03 | Prestige, challenges, milestones and automation; AD laboratory | S02 green | AD01–AD06, T04–T17/T28/T35 |
| S04 | Save/load, migrations and recoverable offline progress | S03 green | T01/T33–T34, D4 |
| S05 | Tasks, seasons, markets and resource management; Kittens laboratory/Paperclips mapping | S04 green | KG01–KG06, PC01–PC03, D1R |
| S06 | Headless UX, replaceable DOM renderer and TMT interaction gallery | S05 green | T18–T31/T36–T37, D5 |
| S07 | Browser lifecycle/storage ownership, worker protocol and recovery | S06 green | D4–D5 browser/worker evidence |
| S08 | Bot players, pacing reports, sweeps and regression comparisons | S07 green | D6 |
| S09 | Validated bulk advancement, explicit approximations and performance workloads | S08 green | D3/D7 |
| S10 | Three complete games, independent consumers and whole-game correctness | S09 green | D2–D6, complete reference demonstrations |
| S11 | Full parity audit, release evidence and installable candidates | S10 green | All gates including D1R/D8 |

All slices currently have status **PLANNED**. Summaries above do not themselves satisfy parity cases. Some behavioral evidence precedes browser evidence: S04 proves recovery through fault-injectable storage, while S07 proves actual browser integration. S04 cannot claim that later result.

AD06 is staged: S03 establishes controlled source tick-schedule equivalence, S04 adds save/offline integration, S09 adds performance evidence, and S10 supplies interactive demonstrations. KG05's redshift policy uses the S04 extension contract in S05. Full D1R closes only when all required artifacts exist.

The sequence is intentionally conservative. Independent slices could be integrated concurrently later, but still require the same final-head checks and prerequisite evidence. This plan does not authorize or require sub-agent delegation.

## Per-slice execution checklist

1. **Establish scope.** Inspect worktree/instructions; verify prerequisite SHAs/checks; list acceptance cases and public interfaces affected. Preserve unrelated user edits. Freeze relevant reference outcomes before implementing the feature.
2. **Deliver the capability.** Include public types, implementation, tests, examples/docs, and migrations where applicable. Do not advertise placeholder APIs as working features.
3. **Check locally.** Run the complete quality command and relevant browser/reference suites. Inspect coverage, size, duplication and dependency reports, not only exit codes.
4. **Review.** Check single ownership of domain math, public API ergonomics, structured errors, numeric conversions, mutation boundaries, source attribution, and compatibility changes. Refactor excess file/function size along meaningful boundaries.
5. **Commit.** Stage intended files explicitly. Use a descriptive title containing the slice ID, with behavior, validation, and limitations in the body. One large coherent commit is acceptable; corrections remain part of that slice.
6. **Push.** Push to the configured authorized repository/working branch and record the full head SHA. Do not assume the GitHub organization exists or invent a remote. S00 establishes the actual remote, branch and permissions. No npm publication is implied.
7. **Validate remotely.** Wait for required CI on that SHA, inspect failures/artifacts, fix and repeat. An earlier green SHA is invalid evidence after a new commit. Integration/merge-queue checks also apply if that workflow is used.
8. **Record completion.** Record slice ID, SHA, remote URL, CI URLs, quality/coverage summary, acceptance artifacts, and remaining release work. Only then label the slice complete.

CI evidence belongs in artifacts keyed to the input SHA. Avoid a recursive “commit the CI URL, changing the SHA that the URL proves” loop: the current run stores its attestation externally; later docs may reference it and receive their own checks. A modified worktree is not covered by a previous commit's CI.

## Repository and command contract for S00

Use a pnpm workspace with two public ESM packages, `@e308/core` and `@e308/ux`, with explicit host/numeric subpaths. Pin the package manager, TypeScript, testing/coverage tools and Biome. Start with `tsc` for builds/declarations. Verify exact versions at implementation time.

| Planned command | Responsibility |
| --- | --- |
| `pnpm format` | Apply Biome formatting/import fixes locally |
| `pnpm lint` | Nonmutating Biome CI check; warnings fail; enforce import assists |
| `pnpm typecheck` | Strict TS and consumer inference/type-error fixtures |
| `pnpm check:structure` | File/function budgets, duplication and static dependency boundaries |
| `pnpm test:coverage` | Unit/property/integration tests with full source inclusion and coverage thresholds |
| `pnpm build` | ESM/declarations and package archives |
| `pnpm test:packages` | Install archives in clean TS/JS consumers; test exports and headless imports |
| `pnpm test:reference` | Introduced reference cases plus source-inventory reconciliation |
| `pnpm test:browser` | Introduced browser contract cases |
| `pnpm quality` | Full formatting/lint/types/structure/coverage/build/package validation |
| `pnpm verify:slice -- Sxx` | Shared quality plus the slice's reference/browser/evidence jobs |

These scripts do not exist yet. An unintroduced suite is marked accordingly in the slice manifest; introduced required suites cannot become successful no-ops. Browser/source suites supplement coverage, rather than masking missing unit tests.

## CI policy

S00 creates GitHub Actions for pushes and PRs using immutable lockfile installation. A required aggregate `quality` check validates every job required by the slice manifest. Enable repository rules requiring checks where permissions allow; a workflow is not itself branch protection.

Baseline jobs: Biome, types, structure/DRY/dependencies, coverage, builds and package-consumer tests. Reference, browser and scenario jobs join when their slices introduce them and remain required thereafter. Docs-only changes can use a declared narrower set, but shared CI/quality configuration changes trigger the full applicable set.

Required runs have timeouts and preserve diagnostics. Reruns cannot erase an unexplained failed attempt. A flaky test affecting a required contract blocks acceptance until fixed. Scheduled long runs provide early warnings; the required complete release workload must also run on the release candidate SHA.

Artifacts include coverage JSON/HTML, test reports, minimized property failures/seeds, parity manifests/traces, browser failure traces, package archives and scenario/benchmark results, all with SHA/environment metadata. Local hooks are conveniences; CI is authoritative.

## Earlier milestone references

S00–S11 replace the former six milestones. Foundation maps to S00–S02; persistence to S04/S07; progression/economies to S03/S05; harness to S08; optimization to S09; UX to S06/S07; release to S10/S11. Interface gates are mapped to slice IDs in [interfaces.md](interfaces.md).

## Scope of this action

The original revision of this plan created documentation only; implementation now follows the slices above. Cloud accounts, monetization, multiplayer, automatic graph layout, a general visual editor and npm publication remain outside initial engine acceptance work.
