# S11 evidence — release candidate and parity closure

Status: **IN REVIEW**. Candidate commit
`1f8358a55374dec42e97357df0a371a73a7bdc1e` passed the complete GitHub Actions quality workflow.
All automated D1–D8 and D1R entries pass. Independent source, game/usability, physical-device, and
final review sign-offs remain open.

## Automated closure

- The TMT inventory resolves 447 entries from 28 pinned documentation/runtime sources: 366 required
  capabilities, 40 aliases, and 41 implementation mechanisms. Every T01–T37 group maps to public
  APIs or shipped recipes plus unit and interaction evidence. Automated status is 447 pass, zero
  fail, zero not-run.
- The reference-game manifest maps and passes AD01–AD06, KG01–KG06, and PC01–PC03 against pinned
  source manifests, executable comparisons, declared numeric policies, and private interactive labs.
- Wireworks, Cascade, and Hearth build as independent archive consumers, have legal winning traces,
  beginning/middle/ending saves, distinct pacing strategies, and the complete offline policy matrix.
- The developer README, public API reference, migration guide, changelog, package READMEs, and save
  schema ship with the candidate source or archives.
- The deployable site contains all three original games. Its build rejects reference-lab markers,
  and Playwright proves the reference-lab URL is absent. Deployment is manual and has not run.

## Exact-head quality results

[GitHub Actions run 34331718472](https://github.com/e308js/e308/actions/runs/34331718472)
completed successfully on Node 24.14.1. It ran:

- Biome with warnings rejected, strict TypeScript, file/function budgets, duplicate-block checks, and
  core browser-global/import boundaries.
- 312 Vitest tests in 59 files. Total coverage was 97.67% lines, 96.14% statements, 98.27%
  functions, and 89.31% branches; the per-file floor for all four measures remained 80%.
- Five packed-archive clean consumers, including every documented public subpath, emitted types,
  save schema, resolved RC dependency, package metadata, and absence of `.tsbuildinfo` files.
- Eight Playwright cases covering renderer replacement, keyboard/touch controls, reduced motion,
  browser persistence, two-tab ownership, worker equality, all three finished games, and public-site
  separation.
- The 45-row release workload matrix. Its two-core AMD EPYC CI runner was diagnostic; its slowest
  eight-hour p95 was 1,439.7 ms. The named Ryzen 9 reference-machine results are recorded in
  [s11-performance.md](s11-performance.md) and all pass the two-second budget.

## Candidate archives

The release builder currently produces:

| Package | Version | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@e308/core` | `1.0.0-rc.1` | 158,593 | `e410d7223802920a90018014d972fc1b4f89f157888e12f012aba956affff0a4` |
| `@e308/ux` | `1.0.0-rc.1` | 32,333 | `73dbc5fcfc73e4229d7afae886d30da5b1f959f2e96527dbdf03846b599c11c5` |
| `@e308/game-wireworks` | `1.0.0` private evidence | 13,492 | `abc2ef8e742a5362027a133fa52c94d77e636de1bd2a4d1cd32a7fa8f08c1c3c` |
| `@e308/game-cascade` | `1.0.0` private evidence | 16,911 | `e25c2344d1bd1dbaecc65adf17a433078ddeb20fd5d1c76186e05482b766ae3c` |
| `@e308/game-hearth` | `1.0.0` private evidence | 15,494 | `8c24b764b83cef8dc077a3abd515d87d851c764a0793869a26adc6ddb3ce55b4` |

The generated release manifest records the same hashes, exact commit, artifact paths, automated gate
statuses, and open-review fields.

## Open release evidence

The [release review procedure](release-review.md) still requires a reviewer to audit TMT and
reference-source coverage, review every consequential game choice and ending,
exercise desktop and physical-touch usability, and record a named physical-device sleep/wake run.
The reviewer may be the implementer. Those requirements also keep S10 in review. The project and
public packages use the MIT license. npm publication has not occurred. The original-games-only
Pages site is deployed at [e308js.github.io/e308](https://e308js.github.io/e308/).
