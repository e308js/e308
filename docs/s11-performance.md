# S11 release-machine performance evidence

Status: named release-machine matrix **PASS**; release-candidate CI validation **PASS** in
[run 34320192794](https://github.com/e308js/e308/actions/runs/34320192794), followed by successful
exact-head documentation validation in
[run 34320913345](https://github.com/e308js/e308/actions/runs/34320913345).

The declared reference system is Linux x64, Node 24.14.1, an AMD Ryzen 9 8945HS, 16 logical CPUs,
and 65,048,330,240 bytes of memory. Measurements use the final Wireworks, Cascade, and Hearth
content and their generated beginning, middle, and ending saves. Each run creates a fresh game from
the saved snapshot. Cold groups run before an explicit fixture warm-up; warm groups immediately
follow with the same fresh-game isolation.

Every eight-hour row uses exact advancement, completes with no pending work, and has ten cold plus
ten warm measurements. The local p95 results in milliseconds were:

| Game | Checkpoint | Cold p95 | Warm p95 |
| --- | --- | ---: | ---: |
| Wireworks | beginning | 119.5 | 114.0 |
| Wireworks | middle | 101.5 | 99.7 |
| Wireworks | ending | 98.3 | 101.4 |
| Cascade | beginning | 1,475.4 | 1,300.3 |
| Cascade | middle | 1,350.2 | 1,331.3 |
| Cascade | ending | 1,303.3 | 1,295.5 |
| Hearth | beginning | 71.2 | 76.8 |
| Hearth | middle | 71.0 | 74.0 |
| Hearth | ending | 70.9 | 67.8 |

All nine cold and warm p95 values are below the frozen two-second budget. The complete report has
45 rows: five absence lengths for each game and checkpoint. The nine 30-day rows retain their
timings and preserve 2,392,000,000 ms as pending work after the declared 200,000-step bound. No
approximate advancement mode is used.

`pnpm verify:performance` always rejects missing matrix rows, fewer than ten eight-hour
measurements, approximate modes, incomplete eight-hour work, or inconsistent 30-day backlogs. It
enforces the two-second p95 only when the recorded CPU is the named reference machine; arbitrary CI
hardware remains diagnostic. GitHub Actions uploads the generated JSON and Markdown reports inside
its SHA-keyed quality artifact.
