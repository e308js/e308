# Quality gates for implementation slices

Status: enforced since S00. These gates implement the user's requirements for 80% minimum coverage, Biome lint/format enforcement, manageable files, DRY domain logic, good DX, and tested/committed/pushed/CI-validated capability slices.

## Coverage

Require **at least 80% statements, branches, functions, and lines** for each public package and each first-party executable source file. First-party game logic and runtime tools have their own test projects with the same gate, so a well-tested core cannot hide untested examples. Include unimported files through explicit source include patterns; test discovery must not determine the denominator.

Include numerical adapters, custom mechanics, serializers, migrations, offline processors, UX controllers and browser/worker hosts. Test host behavior through instrumentable integration seams; Playwright walkthroughs do not automatically contribute to Vitest coverage. Exclude tests, declaration-only files, generated outputs, inert data, and unchanged third-party reference sources identified in a manifest. Authored reference wrappers, e308 ports/clones, runtime tools and hand-written fixture logic remain first-party. Directory names such as `examples` or `fixtures` are not blanket exemptions.

Check aggregate and per-file coverage explicitly using the pinned Vitest configuration/report reader. Do not assume one setting enforces both. Vitest exposes thresholds for all four metrics and per-file checks. [Vitest CLI reference](https://vitest.dev/guide/cli.html).

The gate applies from the first runtime-bearing slice, including S00's executable quality tooling. A genuinely type-only project reports “no executable source” with its source inventory, not synthetic 100%. Empty coverage fails when executable source exists. A dedicated expected-failure fixture must prove insufficient coverage is rejected.

Critical payment, reset, numerical, RNG, migration and crash paths also need named positive/negative/boundary tests irrespective of percentage. Eighty percent is a floor, not proof of correctness. Mocks isolate environmental effects; they must not replace the domain logic under test.

No threshold lowering, broad exclusions, ignored assertions or empty tests to make a slice green. Coverage configuration changes must explain denominator changes. Disable automatic threshold updates initially so validation cannot unexpectedly rewrite config. Every CI artifact includes per-project and per-file summaries.

## Biome

Biome owns formatting, linting and import organization for formats supported by the pinned version. CI uses nonmutating checks, warnings treated as errors, and enforced import assists. Developers apply fixes locally before validation; CI does not auto-commit changes. [Biome CLI](https://biomejs.dev/reference/cli/) documents its nonmutating CI checks.

Use recommended correctness rules plus suitable project-specific rules. Where Biome lacks a needed restriction, add a focused type/static check instead of claiming Biome enforces it. Examples include unsafe economic conversions and transitive browser imports. Rule suppression requires a narrow rationale; no blanket disable to finish a slice.

Markdown links, workflow YAML and other unsupported formats receive separate validation. No second JS/TS formatter is introduced. Immutable third-party reference source remains unchanged and explicitly excluded; its first-party harness still follows Biome.

## Module size and structure

AI-sized commits can be large; individual modules remain focused. Enforce these proposed hard budgets in a dedicated structure checker:

| File kind | Maximum | Guidance |
| --- | --- | --- |
| Production TS/JS/TSX, host adapters, game logic and executable scripts | 350 physical lines | Prefer 100–250; one cohesive responsibility |
| Test/spec files and executable fixtures | 500 physical lines | Group by behavior; share genuine setup |
| First-party stylesheets | 350 physical lines | Split by control/theme responsibility |
| Export barrels | 80 physical lines | Public exports only, no hidden work |
| Production function/method bodies | 80 physical lines | Separate meaningful stages |

Count after formatting, including comments/blanks; use a parser for function boundaries. Biome's file-scanning byte limit is not this structural gate. Generated outputs, lockfiles, immutable third-party source and nonexecuting data are classified exclusions. Hand-written logic cannot be labeled generated to escape limits. Documentation receives readability review rather than code-size budgets.

Split content catalogs by module/era/category even when data is exempt. Avoid enormous snapshots concealing expected behavior. Exceptions for a genuinely indivisible algorithm require a visible record naming path, reason, evidence, reviewer and removal condition; none exist initially. Exceptions do not count as ordinary compliance and must appear in the slice report.

Do not split into `part1.ts`/`part2.ts`, circular imports or forwarding wrappers simply to satisfy line counts. Each resulting module must have an understandable name, owner and contract. Large integration commits do not relax module budgets.

## DRY

There is one production owner for each economic rule: costs/affordability, input allocation, resets, modifiers, time accounting, save decoding and failure projection. Manual clicks, automation and bots share the validated action path. UIs never copy economic math. Hosts share the simulation and codecs rather than creating alternate engines.

Add a required first-party duplicate-block report with a detector/version/configuration pinned in S00. Flag repeats of at least 50 normalized tokens spanning at least 6 lines. Every new finding is removed or explicitly classified. A small global duplication percentage must not excuse copied payment/reset logic. A planted duplicate proves the checker works.

Acceptable repetition can include independent oracle/reference calculations, small straightforward code, domain data of similar shape and repeated expected values in tests. Record reasons for significant findings. Sharing an oracle implementation with the tested algorithm destroys independence: do not “DRY” those together.

Extract abstractions when they express shared rules or boundaries, not just similar syntax. Avoid giant configurable base classes and catch-all `utils.ts` files. Shared abstractions need real consumers or a demonstrated public extension role. Remove dead exports and unnecessary indirection during slice review.

## Developer experience

Examples compile against packed exports in clean plain-JS and strict-TS consumers. Type fixtures prove factory inference, module composition and useful invalid-input errors. Runtime owner tokens reject cross-definition handles even when their TypeScript representations match.

Normal authoring must not require `as any`, private imports, non-null assertions or manual construction of internal state. Escape hatches are named, documented, typed and demonstrated. Public APIs state time/count units, ownership/lifecycle, numeric capabilities and structured failures. Include runnable examples with the slice that introduces the API.

Package imports perform no simulation/storage activity. Headless imports cannot transitively load DOM or framework dependencies; the explicit browser subpath is separately allowed. Enforce both static graphs and Node smoke tests. Module-import cycles fail; economic feedback graphs are a different concept and remain supported where declared.

Comments explain mathematical derivations, ordering and invariants. Player-facing errors identify useful public blockers without leaking hidden content. Public API changes update examples/types/migration notes together.

## Gate self-tests and evidence

S00 includes isolated expected-failure fixtures for bad Biome formatting/lint, invalid types, oversized files/functions, duplicate domain blocks, forbidden transitive browser imports and insufficient coverage. Checker tests assert rejection; the main CI run remains green. Do not prove the machinery by committing a deliberately broken branch as the accepted slice.

Every completion report names full pushed SHA/branch, CI check URLs, four coverage metrics, per-file violations (must be zero), Biome result, size/DRY/dependency results, relevant artifacts and remaining future gates. An exception is visible rather than silently treated as compliance.

Pending, unexpectedly skipped, cancelled or wrong-SHA CI cannot pass. GitHub/Actions/device unavailability can leave a slice implemented or locally validated, but incomplete. Report the concrete blocker. Later CI/config/exclusion changes receive review and full applicable checks; quality policy cannot be weakened unnoticed in the failing feature change.
