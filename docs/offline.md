# Offline progress: proposed contract

Status: core persistence and catch-up semantics implemented in S04; browser ownership and worker
integration remain assigned to S07, and optimized advancement remains assigned to S09.

The [resolved contracts](contracts.md) specify canonical production behavior and update compatibility in greater detail.

The [interface decisions](interfaces.md#rng-and-save-representation) choose the PRNG and illustrate the JSON save envelope. Complete JSON validators and pending-session fixtures remain a gate before persistence implementation.

## Four independent controls

| Control | Meaning | Example |
| --- | --- | --- |
| Offline entitlement | How much absence the game credits | Unlimited, disabled, 8 hours, upgrade-dependent |
| Work budget | How much computation to do before yielding | A bounded number of steps or milliseconds per chunk |
| Simulation fidelity | How credited time is evaluated | Canonical steps, validated shortcut, explicit approximation |
| Resource capacity | How much of a resource can be stored | 1,000 wood, with overflow discarded |

A work limit must not silently turn into a reward cap. Unlimited entitlement means all valid elapsed time is eligible; it cannot promise instant exact evaluation of arbitrary game logic.

## Developer policy

Illustrative configuration:

```ts
const offline = {
  enabled: true,
  cap: { kind: 'unlimited' },
  // Alternatives:
  // cap: { kind: 'duration', milliseconds: hours(8) }
  // cap: { kind: 'dynamic', at: 'absence-start', resolve: state => ... }
  excess: 'discard', // explicit alternative: bank time as a game mechanic
  fidelity: 'canonical',
  automation: 'enabled-rules-only',
  onChoice: 'pause-dependent-systems',
};
```

Require the developer to declare an entitlement policy when enabling offline support. Do not impose a genre-wide eight-hour default. The cap is measured in real elapsed time before applying game-speed mechanics. Efficiency penalties, per-system policies, time banking, and unlock-dependent caps are optional explicit mechanics.

For a dynamic cap, resolve the policy from the state at the last coherent saved checkpoint and persist that value alongside the state and clock anchor. Freeze it for the resulting absence and catch-up session. An upgrade gained during catch-up does not retroactively restore discarded absence. Other behavior requires an explicit game-authored policy migration.

An absence is one continuous interval without authoritative foreground reconciliation, not each computation chunk or hidden-tab timer callback. Applying the cap independently to every chunk would let implementation details change rewards. Persist the absence/session identifier and resolved policy.

## Clock model

The host owns wall-clock sampling; the simulation consumes durations. Active play uses monotonic timing and a saved substep remainder. Return processing compares the persisted wall-clock anchor with the current wall time. Track which intervals have already been accounted for so focus changes, browser suspension, and reloads cannot credit them twice.

Use finite, validated timestamp and duration values. Negative elapsed time earns zero and produces a clock-anomaly record. Choose an explicit re-anchoring policy; a simple default is to retain the future anchor until wall time catches up, while active monotonic progress continues. If the game instead re-anchors to the current wall clock, document the different behavior and prevent duplicate accounting within the session.

No offline-only client can reliably distinguish deliberate clock editing from every legitimate clock correction. Authoritative time requires a trusted external service and a different trust model. This is an architectural limit, not a reason to require a server for local single-player games.

Paused, hidden, closed, and offline-without-network are distinct states. The browser host should make hidden/suspended catch-up follow the same declared entitlement policy as closing the game unless the developer explicitly chooses otherwise.

## Accounting example

A player returns after 30 hours to a game with an eight-hour cap:

```text
observed absence:   30 hours
eligible duration:   8 hours
discarded duration: 22 hours
simulated so far:    0 hours
pending duration:    8 hours
```

Freeze the return timestamp as the end of that absence. If a work chunk finishes only two eligible hours, commit two simulated hours and six pending hours. Do not replace pending time with a new `now − savedAt` calculation, reapply the cap, or credit the original 30 hours again.

Advance the wall-clock accounting anchor past the full observed absence, including discarded time, while retaining the eligible pending duration separately. Otherwise reloading could recover time intentionally excluded by the cap. A saved pending record also needs its policy version, simulation version, RNG/scheduler state, and processed cursor.

Time spent computing catch-up is another interval. Record it separately and reconcile it at a defined transition back to live play; do not grow the current batch's endpoint continuously. If processing is persistently slower than real time, expose the backlog and use supported optimizations or an explicit game policy. Never silently stop counting time to make the loading screen disappear.

## Recovery and idempotency

If installed rules differ from the save, use the [update contract](contracts.md#6-updates-during-absence): migrate before processing new absence, preserve its saved entitlement, and explicitly transition any pending session. Missing compatibility leaves the original session intact and paused. Already committed rewards are not recalculated.

1. Obtain exclusive ownership of the save slot.
2. Load and validate the save, preserving a prior valid version.
3. Resume an existing catch-up session if present.
4. Otherwise resolve a new absence and persist its anchor, policy, and pending duration.
5. Advance a private candidate through a bounded chunk.
6. Commit resulting state, RNG/scheduler position, and remaining duration together.
7. Publish progress and repeat until complete, paused, or cancelled.
8. Persist completion and the report, then reconcile subsequent time and resume live play.

After a crash before step 6, replay the uncommitted chunk from its previous state; after a crash after step 6, continue from the new cursor. Deterministic RNG ensures replay does not reroll rewards. Reports and external notifications need stable event IDs or a delivery cursor so replay cannot repeatedly announce the same event.

The browser implementation should use a transactional record update, such as IndexedDB, under single-writer ownership. A lock coordinates live actors; it does not by itself make several storage writes atomic. Read-only secondary tabs can subscribe to updates and offer an explicit ownership transfer. Unsupported lock environments need a documented fallback with its own conflict handling, not an assertion that a heartbeat alone is race-free.

Cancellation means “pause with remaining progress preserved” by default. Discarding pending time is a separately named action. Approximate completion is available only if the game defines and enables it. Do not label discarding rewards as “skip animation.”

## Why one large tick fails

These examples are mathematical counterexamples, not measured behavior of every referenced game.

**Changing production:** let a higher generator increase lower generators by one per second, starting with zero lower generators. Each lower generator produces one currency per second. In a continuous model, after ten seconds the lower quantity is 10 and currency is 50. Multiplying the initial currency rate by ten gives zero. A discrete fixed-step model has its own result; optimize that recurrence if that is the model the game chose.

**Limited inputs:** a converter uses two ore to make one ingot per second, with five ore initially and no ore income. It can make at most 2.5 ingots in a divisible model. A full ten-second production award followed by clamping ore to zero would create unpaid output. A discrete recipe can make only two and must retain the unused ore.

**Competing consumption and capacity:** wood starts at 9 with capacity 10, production of two/sec, and consumption of one/sec. Over two seconds of a continuous simultaneous-flow model, wood reaches 10. Producing first, clamping, then subtracting two gives 8. Rate allocation and boundary order are game semantics.

**Autobuyers:** production is one coin/sec, and an enabled automation buys a multiplier for five coins. It should buy at its scheduled eligible boundary during the interval. Waiting until the end applies the multiplier too late; buying at the beginning applies it too early.

**Discrete rounding:** at 0.2 items/sec, five one-second steps with independent flooring yield zero items; one five-second step yields one. Persist fractional progress or model task completion events.

**Seasonal effects:** summer production cannot be extrapolated across winter. A valid shortcut must stop at the next calendar boundary and reevaluate rates.

## Baseline and optimization

The baseline replays the canonical fixed steps, preserving the remainder between calls. At a 50 ms step, a day contains 1,728,000 steps and 30 days contain 51,840,000. Merely moving that loop to a worker preserves responsiveness but does not reduce its computational cost.

Add optimized cases in this order:

| Case | Possible optimization | Conditions |
| --- | --- | --- |
| Constant independent rates | Direct integration and capacity boundary calculation | No intervening rate/action changes |
| Linear producer chains | Closed form for the declared recurrence or continuous system | Constant coefficients, known semantics |
| Piecewise constrained flows | Advance to earliest depletion/capacity boundary | Correct shared-resource allocation and stable rates |
| Scheduled automation/tasks | Advance to next due event | Stable ordering and preserved cooldown phase |
| Complex custom systems | Canonical steps, then optional game-authored approximation | Explicit support and measured differences |

The scheduler considers purchases, unlocks, task completions, caps, depleted inputs, calendar changes, and choices. It cannot derive every threshold from opaque JavaScript. Custom rules must supply safe boundary information or fall back to the canonical step. Zero-duration event loops must fail with a useful diagnostic rather than hang.

Analytical integration of a continuous chain differs from Euler-stepped production. Do not market both as interchangeable “exact” solutions. Canonical exactness requires agreement with the specified numerical result, including rounding behavior; algebraic equivalence alone is insufficient. Approximate modes need named settings, measured errors, and a report flag; universal error guarantees for arbitrary callbacks are not credible. Event shortcuts must preserve canonical boundary quantization and ordering.

## Randomness and story

Seeded randomness alone is insufficient if larger batches consume a different number of draws. Canonical replay must preserve event ordering and draw count. Aggregate sampling can preserve a distribution without preserving an individual replay; only use it as an explicit game-authored shortcut.

Story events need durable discovery records. A player should be able to read what unlocked while away. Required choices cannot be guessed. The game declares whether they pause the whole simulation, only dependent systems, or queue for later without stopping production. If some systems continue, maintain one global timeline with paused-system state rather than resimulating independent full absence windows that exchange shared resources incorrectly.

## Required report

```ts
interface OfflineReport<Quantity> {
  sessionId: string;
  elapsedRealMs: number;
  eligibleRealMs: number;
  processedRealMs: number;
  pendingRealMs: number;
  discardedRealMs: number;
  advancedGameMs: number;
  fidelity: 'canonical' | 'validated-bulk' | 'approximate' | 'custom-reward';
  resources: Array<{
    id: string;
    before: Quantity;
    after: Quantity;
    produced?: Quantity;
    consumed?: Quantity;
    overflow?: Quantity;
  }>;
  milestones: Array<{ id: string; atGameMs: number }>;
  stopReason?: 'choice' | 'cancelled' | 'error';
}
```

Duration arithmetic must have a documented supported range; enormous economic quantities do not require using the same representation for wall-clock timestamps. Separate real and game time allows speed effects without hiding credited absence.

## Acceptance cases

- Same initial state, seed, commands, and elapsed duration produce the same canonical result regardless of render frequency and catch-up chunking.
- A cap applies once to an absence, including across reloads and upgrades gained during catch-up.
- Crashes at every commit boundary neither duplicate nor erase committed rewards or pending time.
- Zero/negative time, invalid timestamps, long gaps, storage errors, future save versions, and clock changes have defined outcomes.
- Fractional remainders survive save/load.
- Depletion, capacity, automation, reset, calendar, and choice boundaries behave as specified.
- Two tabs cannot both authoritatively commit the same interval.
- Approximate results are visibly identified and compared with canonical fixtures.
- The same saved scenario runs in Node and a worker without importing a renderer.

The motivating source comparisons are documented in [research.md](research.md).
