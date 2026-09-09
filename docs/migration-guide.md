# Migration guide

e308 has no earlier stable release. This guide defines the compatibility process for release
candidates and for games upgrading their own content after launch.

## Upgrade the packages

Upgrade `@e308/core` and `@e308/ux` together, rebuild with strict TypeScript, and run the game through
its package-archive consumer test. Use only documented package exports. A removed or renamed export
is a package migration even when it does not affect saves.

Review release notes for changes to fixed-step ordering, command failures, numerical evaluation,
offline accounting, and save format. Changing labels, view composition, or CSS does not require a
state migration. Changing economic timing or rounding requires a new `simulationVersion` and replay
evidence.

## Change persistent content safely

Resource, scope, buyable, allocation, upgrade, challenge, automation, task, calendar, market, and RNG
stream IDs are persistent. Keep an ID when its meaning remains compatible. When an ID changes or a
saved field is added, increment `stateSchemaVersion` and register an ordered `SaveMigration`:

```ts
import { createSaveCodec, type SaveMigration } from "@e308/core/persistence";

const renameOre: SaveMigration = {
  id: "rename-ore-to-iron-v2",
  fromVersion: 1,
  toVersion: 2,
  migrate: (save) => {
    const run = save.state.scopes.run;
    if (run?.resources.ore === undefined) throw new TypeError("missing run/ore");
    const { ore, ...resources } = run.resources;
    return {
      ...save,
      stateSchemaVersion: 2,
      state: {
        ...save.state,
        scopes: { ...save.state.scopes, run: { ...run, resources: { ...resources, iron: ore } } },
      },
    };
  },
};

const codec = createSaveCodec(
  definition,
  {
    stateSchemaVersion: 2,
    contentVersion: "1.1.0",
    contentDigest: "sha256-of-content",
  },
  { migrations: [renameOre] },
);
```

The decoder applies migrations sequentially, records their stable IDs, validates the result, and
rejects unknown state instead of silently deleting it. Preserve the original imported save until
the migrated replacement commits successfully. Test the oldest supported fixture, each intermediate
version, malformed data, retry behavior, and a current round trip.

If a removed scope owns queued tasks, escrow, allocations, automation clocks, or pending references,
the migration must convert or deliberately retire all of them. A schema version bump without that
accounting is incomplete.

## Change rules during offline catch-up

A saved catch-up session freezes entitlement and records the simulation version for already
processed and pending segments. When new rules can change pending results, increment
`simulationVersion` and provide a `PendingSessionTransition`. The transition converts state,
remainders, tasks, scheduler positions, RNG streams, and pending work as one explicit operation.

If no compatible transition exists, loading preserves the save and pauses catch-up with a
compatibility error. Shipping the old definition long enough to finish the session is valid.
Resetting the remainder, applying the new rules silently, or crediting the gap again is invalid.

Cap policy changes do not retroactively reduce a previously saved entitlement. A deliberate grant or
reduction needs a versioned compensation rule with an idempotency ID and an atomic storage commit.

## Change numeric backend

The save envelope records the numeric codec ID. Switching from native numbers to
`break_eternity.js`, changing a codec, or changing canonical evaluation is a simulation and save
migration. Convert every numeric resource, count, escrow value, capacity, report accumulator, and
remainder. Then compare boundary fixtures and exact discrete outcomes before accepting the backend.

Do not parse huge saved quantities through JavaScript `number` as an intermediate. Use the old
codec's parser and the new adapter's serializer so values above `1e308` remain representable.

## Verify a migration

For every release that changes persistent behavior:

1. Decode untouched saves from every supported schema and content version.
2. Run the migration twice through crash/retry boundaries and confirm each migration ID applies once.
3. Compare canonical continuation before and after a save boundary using the same commands, seed,
   and elapsed-time partitions.
4. Exercise an interrupted offline session before and after each chunk commit.
5. Export, import, reload, and race two browser writers against the migrated save.
6. Install packed package archives in a clean consumer and compile emitted public types.

Keep the fixtures and expected state with the release evidence. If a required fixture cannot be
converted without guessing, reject it with an actionable error and retain the original bytes.
