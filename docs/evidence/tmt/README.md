# TMT leaf evidence inventory

This directory records the automated source-to-evidence audit for the pinned The Modding Tree
baseline. The index freezes the upstream commit, source hashes, denominator, shared runtime, and
review state. Each source document has a compact JSON Lines ledger so no evidence file becomes a
large generated blob. `groups.jsonl` maps every T01–T37 capability group to its public e308 surface,
unit evidence, required interaction evidence, and comparison policy.

The inventory contains 447 resolved source entries: 366 required capabilities, 40 aliases, and 41
documented implementation mechanisms. Automated checks verify that every entry has a unique stable
ID, a resolved disposition, a passing status, an intact pinned-source hash, and evidence files that
exist in this checkout. Runtime entries cover the loop, offline behavior, save/options code, cached
derived state, helper queries, component dispatch, and endgame handling in the pinned source.

Fields shared by every leaf are stored once in `index.json`. Source path, SHA-256, and upstream
commit come from the matching document entry. Runtime, reviewer, review date, and expected result
come from `inheritedEvidence`. Public surface, unit and interaction evidence, and comparison policy
come from the leaf's capability group in `groups.jsonl`. A leaf record supplies its source line,
stable key, group, disposition, and executed status.

The extraction and implementation audit are complete, but independent source-review sign-off is
still pending. A reviewer must compare the ledgers with the pinned Markdown and runtime sources,
check semantic grouping and alias/mechanism dispositions, and record any missed behavioral prose.
Until that happens, D1 remains in review even though the automated denominator is fully passing.
