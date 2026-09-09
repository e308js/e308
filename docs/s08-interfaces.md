# S08 harness, policy, and report contracts

Status: frozen before runtime implementation.

## Visibility and legal actions

A `HarnessScenario` is the only game-aware boundary. It creates the ordinary `Game`, projects a
player-visible observation, produces revision-bound `LegalActionQuote` values, converts a quoted
intent into the same validated `Command` used by the game, evaluates authored goals, and projects
bounded diagnostic samples. Bot policies receive only the observation and quotes. They never
receive a `Snapshot`, definition, transaction, resource handle, or hidden unlock data.

A policy selects a quote ID or waits. The runner finds that ID in the current quote set and dispatches
its exact intent through the scenario command adapter. A missing, blocked, or stale selection is an
attempt with a structured result; it is not applied through a privileged mutation path. In-game
automation remains engine state and continues during all time advancement. Bot decisions occur only
in `active` schedule segments, never in `idle-open` or `absent` segments.

Scripted policies consume an explicit action-ID sequence. Ordered policies hold each action until its
quote becomes legal and useful, which represents purchase routes and unlock plans. Random-legal
policies sample uniformly from current legal useful quotes with the seeded bot RNG. Ranked policies
select the highest game-authored rank, with seeded tie resolution. Goal policies use a game-authored
scorer that sees the same observation and quotes. Policy ID, version, seed, and decision cadence are
report identity fields.

Strategy analysis represents conditional plans as finite trees. Complexity is the total number of
reachable alternative edges beyond the first edge at each decision node after impossible branches
are pruned. A fixed action route has complexity zero. A minimum-winning-complexity claim requires a
bounded exhaustive search over the declared observation, action, time, and state limits. Other reports
label the result as the lowest-complexity winning plan found. Reports retain tree hash, branch count,
action count, success rate, and conditional completion-time distribution.

## Outcomes and causal language

The target goal evaluation is one of `reached`, `pending`, or `certified-barrier`. A barrier requires
a game-authored certificate with a stable ID, proof scope, assumptions, and current constraint
evidence. The harness never promotes a lack of legal actions or a failed policy to impossibility.

Unreached runs use one of these reasons:

- `policy-stall`: a useful legal action existed at the end, but the policy did not reach the goal;
- `observed-stall`: no useful legal action was quoted, with no barrier certificate;
- `schedule-ended`: the declared schedule ended without either stall condition;
- `work-limit`: the configured decision/action bound stopped the run;
- `invalid-configuration`: scenario or parameter validation rejected the run.

Diagnostics come from actual quotes, dispatch failures, and scenario samples. An optional
counterfactual changes one named constraint and records its result as intervention evidence, never
as proof of a unique cause.

## Time, traces, and statistics

Schedules are ordered positive-duration `active`, `idle-open`, or `absent` segments. Active and idle
time use the canonical game advance path. A scenario may provide an absent-time adapter backed by
the save/offline subsystem; otherwise the report labels the fallback `canonical`. Reports separately
record real elapsed, advanced game, active-player, idle-open, absent, discarded-cap, and banked time.

The trace keeps at most `maximumTraceEntries`; samples keep at most `maximumSamples` at an explicit
cadence. Bounds are required positive safe integers. The report always retains aggregate action,
wait, constraint, overflow, reset-recovery, task-block, and milestone counters even when detailed
entries are truncated. A trace is replayed without invoking the original bot.

Aggregates report total, reached, and every unreached reason. Completion-time statistics are
conditional on reached runs only. They contain count, minimum, arithmetic mean, nearest-rank p50,
nearest-rank p95, and maximum; an empty reached set produces `null`, not zero. Unreached runs are
listed and never averaged into success timing.

## Sweeps, baselines, and artifacts

A sweep is a finite, explicitly ordered parameter case list crossed with the same ordered seed and
policy matrix. Invalid parameter cases remain separate results. Paired comparison is true only when
both runs share seed, policy, schedule, start identity, and compatible random-path identity.

Baseline comparison reports absolute and relative milestone-time changes, action-burden changes,
newly reached/unreached outcomes, and new stalls. Relative change is `null` for a zero or absent
baseline. Threshold findings reference a versioned developer baseline; the reporter does not decide
whether an intentional balance change is acceptable.

JSON output is the frozen report data. Markdown output is a deterministic projection of that data
and requires no DOM or browser. Each artifact includes a replayable scenario ID, content/simulation
versions, numeric backend, game/bot seeds, policy version, schedule, fidelity, limits, and the command
needed to regenerate it.
