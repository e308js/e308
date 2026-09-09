# S11 evidence — release candidate and parity closure

Status: **IN REVIEW**. Candidate commit
`8655ad2f74669e16686c20d1fd8d1bec5136bb5c` passed the complete GitHub Actions quality workflow.
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

[GitHub Actions run 34320192794](https://github.com/e308js/e308/actions/runs/34320192794)
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

The SHA-keyed CI artifact `quality-8655ad2f74669e16686c20d1fd8d1bec5136bb5c` contains:

| Package | Version | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@e308/core` | `1.0.0-rc.1` | 157,758 | `3ab2fcc57d528607e8948a32c76f48ecc5bafb44af83b590087d9ec4cbfb167e` |
| `@e308/ux` | `1.0.0-rc.1` | 31,241 | `71553ce12962b34abab66efc759756802a0af8a345dbd6874f3bbb347f955639` |
| `@e308/game-wireworks` | `1.0.0` private evidence | 12,769 | `5cfd2fba60af73bb179774935846fa84615ceabc9f3dd3e410b12983d6568ec8` |
| `@e308/game-cascade` | `1.0.0` private evidence | 16,172 | `114b9b105e0391014dc081592718dd9ff9fa026ac79f817f048d71c2a72e3547` |
| `@e308/game-hearth` | `1.0.0` private evidence | 14,759 | `1f5a8a2ae31ed88326d35416f0a6b68783b6de85610ee93985f669bb51fb6539` |

The generated release manifest records the same hashes, exact commit, artifact paths, automated gate
statuses, and open-review fields.

## Open release evidence

The [release review procedure](release-review.md) still requires a person other than the implementer
to audit TMT and reference-source coverage, review every consequential game choice and ending,
exercise desktop and physical-touch usability, and record a named physical-device sleep/wake run.
Those requirements also keep S10 in review. The repository has no project license yet; a license is
an owner decision required before public npm publication. npm publication and Pages deployment have
not occurred.
