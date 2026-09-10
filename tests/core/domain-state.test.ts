import {
  createGame,
  createGameKit,
  createSaveCodec,
  type DomainEvent,
  type JsonValue,
  nativeNumbers,
} from "@e308/core";
import { restoreEventJournal, restoreRecords } from "../../packages/core/src/domain/state.js";

interface QueueRecord {
  readonly items: readonly string[];
  readonly revision?: number;
}

interface Notice {
  readonly message: string;
  readonly revision?: number;
}

function queue(value: unknown): QueueRecord & JsonValue {
  if (!value || typeof value !== "object" || !Array.isArray((value as QueueRecord).items)) {
    throw new TypeError("invalid queue");
  }
  const candidate = value as QueueRecord;
  if (candidate.items.some((item) => typeof item !== "string"))
    throw new TypeError("invalid queue");
  if (candidate.revision !== undefined && !Number.isSafeInteger(candidate.revision)) {
    throw new TypeError("invalid queue");
  }
  return {
    items: [...candidate.items],
    ...(candidate.revision ? { revision: candidate.revision } : {}),
  };
}

function notice(value: unknown): Notice & JsonValue {
  if (!value || typeof value !== "object" || typeof (value as Notice).message !== "string") {
    throw new TypeError("invalid notice");
  }
  const candidate = value as Notice;
  if (candidate.revision !== undefined && !Number.isSafeInteger(candidate.revision)) {
    throw new TypeError("invalid notice");
  }
  return {
    message: candidate.message,
    ...(candidate.revision ? { revision: candidate.revision } : {}),
  };
}

function fixture(
  options: {
    readonly version?: number;
    readonly retention?: number;
    readonly migrate?: boolean;
  } = {},
) {
  const version = options.version ?? 1;
  const kit = createGameKit({ numbers: nativeNumbers });
  const scope = kit.scope("town");
  const stock = kit.resource("stock", { scope, initial: 10 });
  const orders = kit.record("orders", {
    scope,
    version,
    initial: queue(version === 1 ? { items: [] } : { items: [], revision: 2 }),
    validate: queue,
    ...(options.migrate
      ? { migrate: (value: JsonValue) => ({ ...(value as unknown as QueueRecord), revision: 2 }) }
      : {}),
  });
  const announced = kit.eventType("announced", {
    version,
    validate: notice,
    ...(options.migrate
      ? { migrate: (value: JsonValue) => ({ ...(value as unknown as Notice), revision: 2 }) }
      : {}),
  });
  const definition = kit.defineGame({
    id: "domain-state",
    simulationVersion: 1,
    stepMs: 250,
    resources: [stock],
    records: [orders],
    domainEvents: [announced],
    eventRetention: options.retention ?? 2_000,
  });
  return { definition, stock, orders, announced, game: createGame(definition) };
}

const metadata = {
  wallAnchorMs: 0,
  entitlement: { policyVersion: "1", enabled: false, capMs: null, excess: "discard" as const },
  catchup: null,
};

const saveConfiguration = {
  stateSchemaVersion: 1,
  contentVersion: "domain-state-1",
  contentDigest: "domain-state-fixture",
};

describe("transactional records and domain events", () => {
  it("commits validated immutable records and typed events together", () => {
    const { game, orders, announced } = fixture();
    expect(game.getSnapshot().records?.orders?.value).toEqual({ items: [] });
    const result = game.dispatch({
      id: "queue-and-announce",
      execute: (transaction) => {
        transaction.setRecord(orders, { items: ["robot"] });
        transaction.emit(
          announced,
          { message: "robot queued" },
          { kind: "seats", seatIds: ["b", "a"] },
        );
      },
    });
    expect(result.ok).toBe(true);
    expect(game.getSnapshot().records?.orders?.value).toEqual({ items: ["robot"] });
    expect(game.readDomainEvents()).toMatchObject({
      kind: "events",
      events: [
        {
          sequence: 1n,
          type: "announced",
          payload: { message: "robot queued" },
          audience: { kind: "seats", seatIds: ["a", "b"] },
        },
      ],
      nextSequence: 2n,
    });
    expect(Object.isFrozen(game.getSnapshot().records?.orders?.value)).toBe(true);
  });

  it("rolls back resources, records, RNG, and events after a late failure", () => {
    const { game, stock, orders, announced } = fixture();
    const before = game.getSnapshot();
    const rejected = game.dispatch({
      id: "late-failure",
      execute: (transaction) => {
        transaction.add(stock, 5);
        transaction.setRecord(orders, { items: ["should-rollback"] });
        transaction.random(["fault"]).nextUint32();
        transaction.emit(announced, { message: "should-rollback" });
        throw new Error("late phase failed");
      },
    });
    expect(rejected).toMatchObject({ ok: false, error: { code: "transaction-failed" } });
    expect(game.getSnapshot()).toEqual(before);
    game.dispatch({
      id: "next-event",
      execute: (transaction) => transaction.emit(announced, { message: "first committed" }),
    });
    expect(game.readDomainEvents()).toMatchObject({ events: [{ sequence: 1n }] });
  });

  it("rejects foreign handles, invalid payloads, and unregistered event types", () => {
    const local = fixture();
    const foreign = fixture();
    const values: readonly (() => unknown)[] = [
      () =>
        local.game.dispatch({
          id: "foreign-record",
          execute: (tx) => tx.setRecord(foreign.orders, { items: [] }),
        }),
      () =>
        local.game.dispatch({
          id: "foreign-event",
          execute: (tx) => tx.emit(foreign.announced, { message: "no" }),
        }),
      () =>
        local.game.dispatch({
          id: "invalid-record",
          execute: (tx) => tx.setRecord(local.orders, { items: [1] }),
        }),
      () =>
        local.game.dispatch({
          id: "invalid-event",
          execute: (tx) => tx.emit(local.announced, { message: 1 }),
        }),
    ];
    for (const invoke of values) expect(invoke()).toMatchObject({ ok: false });
  });

  it("rejects non-JSON, cyclic, oversized, and invalid audience payloads", () => {
    const { game, announced } = fixture();
    const rawKit = createGameKit({ numbers: nativeNumbers });
    const rawScope = rawKit.scope("raw");
    const rawStock = rawKit.resource("raw-stock", { scope: rawScope, initial: 0 });
    const rawEvent = rawKit.eventType("raw-event", {
      version: 1,
      validate: (value) => value as JsonValue,
    });
    const rawGame = createGame(
      rawKit.defineGame({
        id: "raw-domain",
        simulationVersion: 1,
        stepMs: 250,
        resources: [rawStock],
        domainEvents: [rawEvent],
      }),
    );
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const [id, payload] of [
      ["cycle", cycle],
      ["nan", { bad: Number.NaN }],
      ["large", { message: "x".repeat(70_000) }],
    ] as const) {
      expect(
        rawGame.dispatch({
          id,
          execute: (transaction) => transaction.emit(rawEvent, payload),
        }),
      ).toMatchObject({ ok: false });
    }
    expect(
      game.dispatch({
        id: "audience",
        execute: (transaction) =>
          transaction.emit(announced, { message: "x" }, { kind: "seats", seatIds: [] }),
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("event delivery, retention, and persistence", () => {
  it("preserves event order and step-boundary timestamps across multi-step advancement", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const scope = kit.scope("clock");
    const stock = kit.resource("clock-stock", { scope, initial: 0 });
    const boundary = kit.eventType("boundary", {
      version: 1,
      validate: (value) => notice(value),
    });
    const rule = kit.steppedRule("announce-boundary", {
      scope,
      update: (transaction) =>
        transaction.emit(boundary, { message: String(transaction.gameTimeMs()) }),
    });
    const game = createGame(
      kit.defineGame({
        id: "event-clock",
        simulationVersion: 1,
        stepMs: 250,
        resources: [stock],
        domainEvents: [boundary],
        steppedRules: [rule],
      }),
    );
    game.advance(750);
    expect(game.getSnapshot().domainEventJournal?.events).toMatchObject([
      { sequence: 1n, atGameMs: 250, payload: { message: "250" } },
      { sequence: 2n, atGameMs: 500, payload: { message: "500" } },
      { sequence: 3n, atGameMs: 750, payload: { message: "750" } },
    ]);
  });

  it("preserves step timestamps and delivers a complete oversized batch before pruning", () => {
    const { game, announced } = fixture({ retention: 2_000 });
    const batches: (readonly DomainEvent[])[] = [];
    game.subscribeDomainEvents((events) => batches.push(events));
    const result = game.dispatch({
      id: "large-batch",
      execute: (transaction) => {
        for (let index = 0; index < 2_001; index += 1) {
          transaction.emit(announced, { message: String(index) });
        }
      },
    });
    expect(result.ok).toBe(true);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2_001);
    expect(game.getSnapshot().domainEventJournal?.events).toHaveLength(2_000);
    expect(game.readDomainEvents(0n)).toEqual({
      kind: "gap",
      firstRetainedSequence: 2n,
      nextSequence: 2_002n,
    });
    expect(game.readDomainEvents(1n)).toMatchObject({ kind: "events", nextSequence: 2_002n });
    expect(() => game.readDomainEvents(-1n)).toThrow("negative");
  });

  it("isolates subscribers and blocks synchronous event-driven mutation", () => {
    const { game, stock, announced } = fixture();
    let nested: unknown;
    const stopFailure = game.subscribeDomainEvents(() => {
      throw new Error("observer failed");
    });
    const stopNested = game.subscribeDomainEvents(() => {
      nested = game.dispatch({ id: "nested", execute: (transaction) => transaction.add(stock, 1) });
    });
    expect(
      game.dispatch({ id: "emit", execute: (tx) => tx.emit(announced, { message: "ok" }) }).ok,
    ).toBe(true);
    expect(nested).toMatchObject({
      ok: false,
      error: { message: "Cannot mutate during domain event delivery" },
    });
    expect(game.getSnapshot().resources.stock).toBe(10);
    stopFailure();
    stopNested();
  });

  it("round-trips records and journals through the public save codec", () => {
    const subject = fixture();
    subject.game.dispatch({
      id: "persist",
      execute: (transaction) => {
        transaction.setRecord(subject.orders, { items: ["saved"] });
        transaction.emit(subject.announced, { message: "saved" }, { kind: "host" });
      },
    });
    const codec = createSaveCodec(subject.definition, saveConfiguration);
    const loaded = codec.decode(codec.encode(subject.game.getSnapshot(), metadata));
    expect(loaded.snapshot.records).toEqual(subject.game.getSnapshot().records);
    expect(loaded.snapshot.domainEventJournal).toEqual(
      subject.game.getSnapshot().domainEventJournal,
    );
    expect(createGame(subject.definition, { snapshot: loaded.snapshot }).getSnapshot()).toEqual(
      loaded.snapshot,
    );
  });

  it("migrates versioned records and retained event payloads without replaying effects", () => {
    const old = fixture();
    old.game.dispatch({
      id: "old-state",
      execute: (transaction) => {
        transaction.setRecord(old.orders, { items: ["old"] });
        transaction.emit(old.announced, { message: "old" });
      },
    });
    const raw = createSaveCodec(old.definition, saveConfiguration).encode(
      old.game.getSnapshot(),
      metadata,
    );
    const current = fixture({ version: 2, migrate: true });
    const loaded = createSaveCodec(current.definition, saveConfiguration).decode(raw);
    expect(loaded.snapshot.records?.orders).toEqual({
      version: 2,
      value: { items: ["old"], revision: 2 },
    });
    expect(loaded.snapshot.domainEventJournal?.events[0]).toMatchObject({
      version: 2,
      payload: { message: "old", revision: 2 },
    });
    expect(loaded.snapshot.domainEventJournal?.nextSequence).toBe(2n);
    const withoutMigrations = fixture({ version: 2 });
    expect(() =>
      createSaveCodec(withoutMigrations.definition, saveConfiguration).decode(raw),
    ).toThrow("migration");
  });

  it("rejects malformed restored record and journal state", () => {
    const { definition } = fixture();
    expect(() => restoreRecords(definition, { unknown: { version: 1, value: null } })).toThrow(
      "Unknown saved record",
    );
    expect(() => restoreRecords(definition, {})).toThrow("Missing saved record");
    expect(() =>
      restoreRecords(definition, { orders: { version: 0, value: { items: [] } } }),
    ).toThrow("Invalid saved record version");
    expect(() =>
      restoreEventJournal(
        definition,
        { nextSequence: 0n, firstRetainedSequence: 1n, events: [] },
        0,
      ),
    ).toThrow("journal cursor");
    expect(() =>
      restoreEventJournal(
        definition,
        {
          nextSequence: 2n,
          firstRetainedSequence: 1n,
          events: [
            {
              sequence: 1n,
              atGameMs: 0,
              type: "unknown",
              version: 1,
              payload: null,
              audience: { kind: "public" },
            },
          ],
        },
        0,
      ),
    ).toThrow("retained domain event");
    expect(() =>
      restoreEventJournal(
        definition,
        { nextSequence: 2n, firstRetainedSequence: 1n, events: [] },
        0,
      ),
    ).toThrow("journal sequence");
  });
});
