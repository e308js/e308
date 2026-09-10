# Match Participants and Domain Events

Status: core domain records and events implemented; transport-independent match layer proposed

This specification defines two reusable additions around `@e308/core`:

1. transactional domain events for simulation occurrences; and
2. a transport-independent match layer for games with multiple controllable participants.

The proposal does not add networking to core. Colyseus, Trystero, a custom WebSocket server, a local
hot-seat host, or a test harness can all control the same match API.

## Decision summary

- One match owns one authoritative `Game` instance. Cross-participant effects occur in that single
  transactional state.
- A **seat** is a stable simulation identity. A **controller** is the replaceable human, AI, remote
  session, or local process currently issuing intents for that seat.
- Seats and their legal ownership boundaries are match concerns. Connections, accounts, presence,
  reconnection, room discovery, and state transport are host concerns.
- Clients and bots submit serializable intents. They never supply executable `Command` callbacks.
- Domain events are emitted transactionally. Rolled-back work emits nothing.
- Snapshots retain only a bounded recent event journal and cursor. A host may archive committed events
  outside the snapshot.
- A fixed-roster match may generate a definition from its lobby when play begins. Dynamic joins are a
  separate capability and are not required by the initial match layer.

## Layer boundaries

```text
game content
  economy, combat, topology, diplomacy, intent codecs, observations

@e308/match (proposed)
  seats, ownership-aware dispatch, command batches, controller cadence, projections

@e308/core
  transactions, resources, time, RNG, progression, persistence, domain events

host or transport adapter
  rooms, sockets/WebRTC, accounts, presence, reconnects, matchmaking, databases
```

`@e308/match` must not import Colyseus, Trystero, DOM APIs, sockets, storage drivers, or ambient clocks.
It receives elapsed time, authenticated seat assignments, and serializable intents from its host.

## Terminology

- **Match:** one deterministic simulation containing all interacting seats.
- **Seat:** a stable ID and capability boundary inside a match.
- **Controller:** a source of intents for a seat. Controller identity is not simulation identity.
- **Principal:** a host-authenticated account, connection, or peer identity.
- **Intent:** serializable requested game action, decoded and validated by game-owned code.
- **Command batch:** an ordered set of seat-bound intents applied at a declared simulation boundary.
- **Domain event:** a committed, typed record that something happened in the simulation.
- **Projection:** the state and events a particular seat or spectator is permitted to observe.

## Versioned domain records

Games may register scoped, JSON-compatible records for state that is structurally richer than a
numeric resource: command queues, units in transit, treaties, controller policy state, and similar
domain data. A record definition has a stable ID, owning scope, positive schema version, validated
initial value, and an optional migration from an older value.

Records are part of the same immutable snapshot and transaction as resources, RNG, progression, and
events. `transaction.getRecord` accepts only a definition owned by that game;
`transaction.setRecord` validates, normalizes, bounds, and deeply freezes its replacement value.
Failure at any later point rolls all of those changes back together. Save decoding rejects unknown,
missing, future-version, or unmigratable record state. Games that declare no records continue to load
snapshots and saves created before this facility existed.

The core deliberately does not interpret record contents or expose partial mutation. The game owns
queue ordering, treaty legality, transit resolution, and bot semantics; replacing a whole validated
record keeps those operations atomic and deterministic.

## Domain events

### Requirements

The core event facility must support occurrences such as:

- `meteor-strike`;
- `dragon-egg-matured`;
- `reactor-destroyed`;
- `shield-breached`;
- `research-completed`; and
- `seat-eliminated`.

An event type has a persistent ID, a version, and a payload codec or validator. Event payloads must be
serializable and bounded. Event definitions are immutable content and participate in the content
digest and migration rules.

```ts
interface DomainEventDefinition<P> {
  readonly id: string;
  readonly version: number;
  readonly validate: (value: unknown) => P;
}

interface DomainEvent<P = unknown> {
  readonly sequence: bigint;
  readonly atGameMs: number;
  readonly type: string;
  readonly version: number;
  readonly payload: P;
  readonly audience: EventAudience;
}

type EventAudience =
  | { readonly kind: "public" }
  | { readonly kind: "seats"; readonly seatIds: readonly string[] }
  | { readonly kind: "host" };
```

The intended authoring surface is:

```ts
const meteorStrike = kit.eventType("meteor-strike", {
  version: 1,
  validate: decodeMeteorStrike,
});

transaction.emit(meteorStrike, {
  targetId: "seat-3/reactor",
  damage: "1200",
}, { kind: "public" });
```

### Transaction semantics

- `emit` appends to transaction-local pending events.
- An event receives its final sequence only when the transaction commits.
- Failed or rejected transactions publish no events and consume no event sequence numbers.
- Events produced by a multi-step `advance` retain step-boundary game timestamps and deterministic
  order.
- Ordering is the order of successful `emit` calls after the engine's existing priority and ID
  ordering has been applied.
- Subscriber exceptions cannot roll back a committed game transaction.
- Event handlers cannot synchronously mutate the game. They may submit a later intent through the
  ordinary host queue.

### Retention and delivery

The snapshot stores:

```ts
interface EventJournal {
  readonly nextSequence: bigint;
  readonly firstRetainedSequence: bigint;
  readonly events: readonly DomainEvent[];
}
```

Retention is a definition-level count or byte budget. Removing old retained entries never rewinds
`nextSequence`. A reconnecting consumer presents its last observed cursor:

- if the cursor is retained, return subsequent visible events;
- if it predates `firstRetainedSequence`, return a gap response and a fresh projection;
- if it is current, return no events.

The bounded journal supports UI notifications, reconnect catch-up, and debugging. Permanent analytics,
moderation, or narrative history belongs in a host-owned append-only archive. Canonical replay normally
uses the starting snapshot, accepted intent log, root seed, content digest, and simulation version;
derived events need not be duplicated in the replay input.

Event visibility is enforced by projection. Hidden events must not be sent and then concealed by the
client. Hosts may archive the complete authoritative stream.

### Migration

- Renaming an event type or changing its payload shape requires an explicit migration.
- Old retained payloads must either migrate, remain readable through their versioned decoder, or be
  deliberately retired with a recorded migration.
- Event migration must not re-run event effects. Events describe committed effects; they are not an
  imperative recovery log.

## Match seats

The initial match layer supports a fixed set of seats after match creation.

```ts
interface SeatDefinition {
  readonly id: string;
  readonly controlledScopeIds: readonly string[];
}

interface MatchDefinition<N, I, O> {
  readonly game: GameDefinition<N>;
  readonly seats: readonly SeatDefinition[];
  readonly decodeIntent: (seatId: string, input: unknown) => I;
  readonly commandFor: (seatId: string, intent: I, snapshot: Snapshot<N>) => Command<N>;
  readonly observe: (seatId: string, snapshot: Snapshot<N>) => O;
  readonly observeEvents: (seatId: string, events: readonly DomainEvent[]) => readonly DomainEvent[];
}
```

Seat IDs are persistent match-local IDs such as `seat-0`; they are not account IDs, Colyseus session
IDs, or Trystero peer IDs. Game content may use seat-prefixed scopes and resources, for example
`seat-0/matter` and `seat-0/reactor`.

The match layer guarantees unique seat IDs and disjoint controlled scopes unless the game explicitly
declares a shared-control capability. The initial version rejects shared control.

Presence, display names, readiness, controller kind, network identity, and reconnect tokens live in
room metadata outside the core snapshot. If a controller change affects game rules, the host submits a
game-authored intent such as `enable-autopilot`; it does not mutate match state out of band.

### Fixed and dynamic rosters

For the initial tactical use case:

1. the host collects humans and AI controllers in a lobby;
2. Start locks the roster and topology;
3. game content generates an immutable definition with namespaced state for every seat; and
4. one match runtime is created from that definition.

An arbitrary pre-match player count is supported subject to declared performance limits. Joining an
active match requires one of the following future policies and is outside version 1:

- preallocated dormant seats;
- a registered definition/state migration; or
- dynamic keyed entity state in core.

## Ownership-aware intents

The public match API accepts data, not commands:

```ts
interface SeatIntentEnvelope<I> {
  readonly seatId: string;
  readonly clientSequence: number;
  readonly intent: I;
  readonly expectedScopeGenerations?: Readonly<Record<string, bigint>>;
}
```

The host determines `seatId` from its authenticated principal-to-seat assignment. It must ignore any
seat identity claimed inside a client payload. Game-owned decoding rejects unknown fields, invalid
numbers, illegal targets, and oversized payloads before constructing a command.

`dispatchAs(seatId, intent)` constructs commands through the match definition and enforces the seat's
scope capabilities. Core commands remain available to trusted game and test code but are not exposed
on a remote protocol.

Client sequence numbers provide per-controller deduplication. Core revisions describe committed game
state and are not a substitute for network retry IDs. Exact global revision fencing is optional for
latency-tolerant actions; scope-generation fencing remains appropriate when a reset or elimination
would invalidate an action.

## Tick and batch semantics

A host drives a match with explicit elapsed time. A recommended real-time cycle is:

1. collect human and AI intents until the next command boundary;
2. validate and deduplicate envelopes;
3. sort them by the match's declared deterministic ordering;
4. commit the command batch;
5. advance one or more canonical simulation steps;
6. publish seat projections and newly committed events.

The match definition declares whether a batch is:

- **ordered:** each command observes prior successful commands in deterministic order; or
- **simultaneous:** all commands are validated against the same source revision and their game-owned
  merge policy produces one atomic transaction.

Version 1 may provide ordered batches only, but it must record the ordering rule. Arrival time alone
must not be a replay contract. A typical ordering key is command boundary, seat ID, client sequence,
then intent type.

Symmetric combat should compute before it mutates: read all attackers, shields, targets, and modifiers;
compute aggregate outcomes; then write every result. Iterating seats while alternately reading and
writing creates an order advantage and violates simultaneous-combat expectations.

## AI controllers

AI is a controller, not a special kind of seat.

```ts
interface SeatPolicy<O, I> {
  readonly id: string;
  readonly version: string;
  decide(input: {
    readonly seatId: string;
    readonly observation: O;
    readonly gameTimeMs: number;
    readonly random: () => number;
  }): I | { readonly kind: "wait" };
}
```

A controller runner schedules decisions at explicit game-time boundaries and submits resulting intents
through `dispatchAs`. Policies receive only their seat projection, legal action descriptions, a named
bot RNG stream, and declared metadata. They cannot inspect another seat's private state or mutate the
game directly.

Live timers, worker pools, process concurrency, and remote model calls belong to the host. The match
layer owns only deterministic decision boundaries, ordering, policy identity, and replay metadata. A
multi-agent testing harness should run the same policies without a network and report wins, duration,
decision counts, stalls, and deterministic replay inputs.

## Transport adapters

### Colyseus

A Colyseus room is the authoritative host. It maps each authenticated session to a seat, turns client
messages into intent envelopes, drives elapsed time, and publishes projections or schema mirrors.
Colyseus state is a network projection, not a second independently mutable simulation model.

### Trystero

A Trystero room transports intents, projections, and events among peers. A game must additionally
choose an authority policy: elected host, dedicated always-on peer, deterministic lockstep, or another
consensus mechanism. Version 1 recommends an elected host for trusted friend rooms. Host migration,
partition recovery, and adversarial cheat resistance are transport-adapter concerns and are not
promised by the match layer.

### Local and test hosts

Hot-seat, CLI, browser-worker, and headless tournament hosts implement the same adapter boundary. This
is required evidence that match semantics do not depend on a particular networking library.

## Persistence and recovery

An authoritative checkpoint binds together:

- the core save envelope;
- match definition/content digest;
- seat and topology manifest;
- last accepted client sequence per seat;
- event journal cursor;
- policy IDs, versions, seeds, and next decision boundaries for deterministic bots; and
- the host's durable archive position when one exists.

Room membership and reconnect credentials are stored separately by the host. Restoring a checkpoint
must not duplicate accepted intents or archived events. A crash between game commit and external
archive commit requires an idempotent archive key based on match ID and event sequence.

## Security boundary

- Networking libraries authenticate or identify principals; the host maps principals to seats.
- The match layer validates seat capabilities and game legality.
- The core validates numeric and transactional invariants.
- Clients never advance authoritative game time, select their own seat, supply commands, or receive
  hidden projections.
- Core deterministic RNG is gameplay RNG, not a source of secrets, tokens, or unpredictable room IDs.

Peer-hosted games cannot provide the same cheat resistance as a trusted authoritative server. That is
a deployment property, not a difference in deterministic game rules.

## Non-goals

The proposal does not define:

- room discovery, matchmaking, chat, accounts, or social graphs;
- socket/WebRTC protocols;
- a database product or schema;
- arbitrary join-in-progress;
- distributed consensus or peer anti-cheat;
- game-specific diplomacy, teams, topology, or combat;
- an unbounded event store; or
- client prediction and rollback netcode.

## Acceptance matrix

Implementation is incomplete until tests cover:

- two seats cannot dispatch against each other's private scopes;
- human and AI controllers can occupy interchangeable seats;
- identical roster, seed, elapsed-time sequence, and intent envelopes produce identical snapshots and
  event sequences;
- duplicate client sequences are idempotent;
- a rejected command emits no events and consumes no event sequence;
- multi-step advancement preserves event timestamp and ordering;
- bounded journal truncation produces an explicit cursor gap;
- public, seat-private, and host-only events project correctly;
- simultaneous combat is invariant under seat declaration order;
- save/restore preserves seats, bot decision boundaries, RNG, dedupe state, and event cursors;
- a host archive retry cannot duplicate an event;
- fixed lobbies with 2, 8, 32, and a declared maximum number of seats meet performance budgets; and
- local, headless, Colyseus, and Trystero hosts can consume the same match intents and projections.

## Proposed delivery order

1. Add typed transactional domain events and bounded journal persistence to core.
2. Add ownership-aware fixed seats and ordered intent batches in `@e308/match`.
3. Add a multi-agent headless harness using the same seat policies.
4. Build the tactical incremental prototype with a local host.
5. Add a Colyseus authoritative adapter.
6. Add an optional Trystero elected-host adapter and document its trust model.
7. Consider dynamic seats only after a concrete join-in-progress game requires them.
