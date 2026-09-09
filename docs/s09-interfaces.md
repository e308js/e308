# S09 optimized advancement contracts

Status: frozen before optimizer implementation.

## Modes and fidelity

Optimized advancement is an explicit operation over an ordinary `Game`. `canonical` mode executes
only fixed steps. `exact` mode may use a built-in or registered `validated-bulk` plan whose planner
has checked the current immutable snapshot, definition, requested step count, numeric adapter, and
declared dependencies. `approximate` mode additionally admits plans carrying a stable method ID and
declared absolute/relative error bounds. Approximate work is never selected by the default mode.

A bulk plan applies in one ordinary transaction through `advanceCustom`. Failure preserves the last
committed snapshot. The driver records every canonical or bulk segment with source/result revisions,
steps, elapsed game time, fidelity, capability identity, and approximation declaration. The report's
overall fidelity is the least exact segment used.

## Built-in affine shortcut

The built-in shortcut recognizes nonnegative, no-input flows whose inspectable rates are constant,
allocated constants, proportional to one resource, or products containing at most one proportional
factor. It is canonical only for the native adapter when the step duration and every intermediate
value are safe integers. It advances the affine recurrence by checked exponentiation and refuses the
shortcut on overflow, capacities, contention, custom rates/rules, tasks, calendars, triggers, win
callbacks, challenges, or dynamic scope activation.

Automation is an explicit event boundary. The affine shortcut stops before the next scheduled
automation boundary; that boundary runs canonically, after which eligibility and coefficients are
checked again. This preserves commands, resets, unlock effects, and random draws. Definitions with
other stateful boundaries fall back to canonical steps.

## Registered capabilities and event bounds

A registered capability is a build-time planner, not a runtime plugin lifecycle. It declares ID,
version, fidelity, dependencies, and a `plan` function. The function either returns an ineligible
reason or a bounded plan with a transaction callback. Approximate capabilities must include their
error declaration. An event-bound wrapper can reduce a plan to the last step strictly before a
game-authored boundary, forcing the boundary itself through canonical simulation.

Capabilities are ordered explicitly. Planner exceptions and rejected plans are diagnostics and
cause fallback; they never corrupt the current game. Capability IDs must be unique.

## Work budgets and backlog

`maximumWork` is a positive operation budget. One canonical step or one committed bulk batch costs
one unit. When the budget is exhausted, the result is `pending` and returns the exact unprocessed
real duration. A backlog owns that duration, accepts bounded additions, and refuses overflow without
changing the queue. Processing removes only committed duration. No mode discards economic time.

The driver also bounds bulk batches and rejects unsafe elapsed-time arithmetic. Zero-step trailing
time may be committed as remainder without consuming simulation work. Reports distinguish completed,
pending, failed, and backlog-overflow outcomes.

## Profiling and evidence

Profiling uses an injected monotonic clock. Results include fixture/version identity, mode, cold/warm
label, repetitions, median, nearest-rank p95, maximum elapsed time, processed game duration,
throughput, longest batch, canonical steps, bulk steps, and pending duration. Hardware/runtime
metadata belongs to the CLI artifact rather than the headless core.

CI compares optimized and canonical snapshots at recurrence and event boundaries, runs the complete
reference/scenario suites, and uploads workload JSON/Markdown. CI timings are diagnostic. Release
performance claims require the separately named reference-machine procedure in the definition of
done.
