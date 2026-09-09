# Release review procedure

The automated release candidate remains in review until a reviewer records the checks below. The
reviewer may be the implementer. Use the exact candidate commit and attach the completed record to
the SHA-keyed release evidence. A failed item reopens its gate; do not sign around it.

## Candidate identity

- Commit:
- Reviewer:
- Review date and timezone:
- Desktop device, OS, browser, and browser version:
- Touch device, OS, browser, and browser version:

## TMT and reference-source audit

Check out the pinned sources named in `docs/evidence/tmt/index.json` and
`docs/evidence/reference-games.json`.

1. Sample every T01–T37 group and inspect every alias and implementation-mechanism disposition.
2. Compare the JSON Lines entries with the cited source lines, including nested options and
   behavioral prose around each extracted item.
3. Confirm that each required leaf's public surface and cited unit/interaction evidence implements
   the observable capability; record any group-level citation that is too broad.
4. Inspect AD01–AD06, KG01–KG06, and PC01–PC03 against their pinned manifests and source selections.
5. Record missed entries, incorrect dispositions, source discrepancies, or easier substituted cases.

Result: `PASS` / `FAIL`

Findings and evidence attachment:

## Three-game completion and distinctness

Use the original-games page. Reference laboratories must not appear on that page or in the deployed
site artifact.

For Wireworks, exercise price and demand, separate stock and cash, the industrial power allocation,
both doctrine choices across separate saves, the retired workshop controls, the terminal projection,
and the final expansion ending.

For Cascade, exercise all eight tiers, buy-one and buy-max behavior, normal/static/higher resets,
respec, a compatible combined challenge, multiple challenge completions, automation, a value above
`1e308`, the progression tree, and the final theorem ending.

For Hearth, reassign all four jobs, cross all four seasons, hit a storage constraint, queue and
complete a paid task, craft and research, trigger the designed shortage, recover legally, and reach
the great-hall ending.

Confirm that each game exposes meaningful blockers and instructions, and that their dominant
decision loops and layouts are materially different. Save, reload, export, import, and start a new
save in each game.

Result: `PASS` / `FAIL`

Findings and evidence attachment:

## Desktop and touch usability

On desktop, complete the significant actions above using the keyboard as well as pointer input.
Confirm visible focus, readable costs and blockers, stable focus after rerenders, and no accidental
duplicate command on hold/click. Resize the window through narrow and wide layouts.

On a physical touch device, exercise each game's primary navigation, explanations, allocations,
purchase/reset actions, and save controls. Confirm targets are usable, content does not require hover,
and no control is hidden by overflow or the on-screen keyboard.

Result: `PASS` / `FAIL`

Findings and evidence attachment:

## Physical sleep and wake

On the named touch device, save a game with offline progress enabled, record its wall time and game
time, put the operating system to sleep for at least two minutes, then wake and reopen the same tab.
Record the pre-sleep save, post-wake offline report, credited/processed/pending/discarded durations,
and resulting game time. Reload once more and confirm the absence is not credited twice.

Repeat with an eight-hour cap boundary using an injected clock or a longer real absence, clearly
labeling which portion is physical and which is injected. Confirm the cap is applied once and any
bounded pending work resumes without duplicate rewards.

Result: `PASS` / `FAIL`

Findings and evidence attachment:

## Final sign-off

- TMT source coverage: `PASS` / `FAIL`
- Reference-game source coverage: `PASS` / `FAIL`
- Game completion and distinctness: `PASS` / `FAIL`
- Desktop usability: `PASS` / `FAIL`
- Physical touch usability: `PASS` / `FAIL`
- Physical sleep/wake recovery: `PASS` / `FAIL`
- Overall release review: `PASS` / `FAIL`
- Reviewer signature or account identity:
