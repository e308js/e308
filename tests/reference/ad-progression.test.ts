import { describe, expect, it } from "vitest";
import {
  beginCatchup,
  createGame,
  createGameKit,
  createSaveCodec,
  eternityNumbers,
  processCatchupChunk,
  type Resource,
} from "../../packages/core/src/index.js";
import { createAdSubject, resourceValue, subjectState } from "../../reference/ad/subject.js";
import { adState, upstreamBuyOne, upstreamTick } from "../../reference/ad/upstream.js";

function compareChallenge(
  subject: ReturnType<typeof createAdSubject>,
  upstream: ReturnType<typeof adState>,
) {
  const actual = subjectState(subject);
  expect(actual.antimatter).toBeCloseTo(upstream.antimatter, 11);
  expect(actual.challengePower).toBeCloseTo(upstream.challengePower, 12);
  actual.dimensions.forEach((value, index) => {
    expect(value).toBeCloseTo(upstream.dimensions[index] ?? 0, 11);
  });
}

describe("Antimatter Dimensions AD04-AD06", () => {
  it("AD04 performs first Infinity and retains purchased upgrades through lower resets", () => {
    const subject = createAdSubject({ antimatter: Number.MAX_VALUE, totalTimePlayedMs: 7_200_000 });
    expect(subject.game.dispatch(subject.infinity()).ok).toBe(true);
    expect(resourceValue(subject, subject.model.infinityPoints)).toBe(1);
    expect(resourceValue(subject, subject.model.infinities)).toBe(1);
    expect(subjectState(subject)).toMatchObject({ antimatter: 10, dimensions: Array(8).fill(0) });

    expect(subject.game.dispatch(subject.buyDim18Mult())).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(subject.game.dispatch(subject.buyTimeMult()).ok).toBe(true);
    subject.game.dispatch({
      id: "second-infinity-seed",
      execute: (transaction) => transaction.set(subject.model.antimatter, Number.MAX_VALUE),
    });
    expect(subject.game.dispatch(subject.infinity()).ok).toBe(true);
    expect(subject.game.dispatch(subject.buyDim18Mult()).ok).toBe(true);

    subject.game.dispatch({
      id: "boost-seed",
      execute: (transaction) => {
        transaction.set(subject.model.dimensions[3] as Resource<number>, 20);
        transaction.set(subject.model.dimensions[0] as Resource<number>, 10);
      },
    });
    expect(subject.game.dispatch(subject.dimensionBoost()).ok).toBe(true);
    expect(subject.game.getSnapshot().progression.upgrades).toEqual({
      "time-mult": true,
      "dim-18-mult": true,
    });
    subject.game.dispatch({
      id: "production-seed",
      execute: (transaction) =>
        transaction.set(subject.model.dimensions[0] as Resource<number>, 10),
    });
    subject.game.advance(100);
    const timeMultiplier = ((7_200_000 + 100) / 120_000) ** 0.15;
    expect(resourceValue(subject, subject.model.antimatter)).toBeCloseTo(
      10 + 10 * 2 * 1.4 * timeMultiplier * 0.1,
      12,
    );
  });

  it("AD05 matches NC2 and NC3 power rules and challenge completion", () => {
    for (const challenge of [2, 3] as const) {
      const initial = {
        antimatter: 1_000,
        dimensions: [10, 1, 0, 0, 0, 0, 0, 0],
        challenge,
        challengePower: challenge === 2 ? 1 : 0.01,
      };
      const upstream = adState(initial);
      const subject = createAdSubject(initial);
      if (challenge === 2) {
        expect(upstreamBuyOne(upstream, 1)).toBe(true);
        expect(subject.game.dispatch(subject.buyOne(1)).ok).toBe(true);
      }
      for (let step = 0; step < 4; step += 1) {
        upstreamTick(upstream, 100);
        subject.game.advance(100);
        compareChallenge(subject, upstream);
      }
    }

    const completed = createAdSubject({ challenge: 2, antimatter: Number.MAX_VALUE });
    expect(completed.game.dispatch(completed.completeChallenge()).ok).toBe(true);
    expect(completed.game.getSnapshot().progression.challengeCompletions.nc2).toBe(1);
    expect(completed.game.getSnapshot().progression.rewardLedger).toEqual(["challenge:nc2:1"]);
    const incomplete = createAdSubject({ challenge: 3, antimatter: 10 });
    expect(incomplete.game.dispatch(incomplete.completeChallenge())).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "no-new-tier" },
    });
    expect(() => createAdSubject().completeChallenge()).toThrow("no active challenge");
  });

  it("AD05 enforces source unlocks and autobuyer cadences", () => {
    const locked = createAdSubject({ antimatter: 1e20, dimensions: [1, 0, 0, 20, 0, 0, 0, 0] });
    expect(locked.game.dispatch(locked.enableDimensionAutobuyer(true))).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });

    const dimension = createAdSubject({
      challenge: 2,
      antimatter: Number.MAX_VALUE,
      dimensions: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    dimension.game.dispatch(dimension.completeChallenge());
    expect(dimension.game.dispatch(dimension.enableDimensionAutobuyer(true)).ok).toBe(true);
    dimension.game.advance(500);
    expect(subjectState(dimension).bought[1]).toBe(0);
    dimension.game.advance(100);
    expect(subjectState(dimension).bought[1]).toBe(10);

    const reset = createAdSubject({
      challenge: 10,
      antimatter: Number.MAX_VALUE,
      dimensions: [1, 1, 1, 20, 0, 0, 0, 0],
    });
    reset.game.dispatch(reset.completeChallenge());
    expect(reset.game.dispatch(reset.buyOne(7))).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(reset.game.dispatch(reset.enableDimBoostAutobuyer(true)).ok).toBe(true);
    reset.game.advance(3_900);
    expect(subjectState(reset).boosts).toBe(0);
    reset.game.advance(100);
    expect(subjectState(reset).boosts).toBe(1);
  });

  it("AD06 preserves controlled schedules and quantities beyond 1e308", () => {
    const scheduled = createAdSubject({
      challenge: 2,
      antimatter: Number.MAX_VALUE,
      dimensions: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    scheduled.game.dispatch(scheduled.completeChallenge());
    scheduled.game.advance(600);
    expect(subjectState(scheduled).bought[1]).toBe(0);
    scheduled.game.dispatch(scheduled.enableDimensionAutobuyer(true));
    scheduled.game.advance(600);
    expect(subjectState(scheduled).bought[1]).toBe(10);

    const kit = createGameKit({ numbers: eternityNumbers });
    const run = kit.scope("run");
    const antimatter = kit.resource("antimatter", { scope: run, initial: kit.q("1e1000") });
    const doubling = kit.steppedRule("double", {
      scope: run,
      update: (transaction) =>
        transaction.set(antimatter, transaction.numbers.mul(transaction.get(antimatter), kit.q(2))),
    });
    const game = createGame(
      kit.defineGame({
        id: "ad-large-number",
        simulationVersion: 1,
        stepMs: 100,
        resources: [antimatter],
        steppedRules: [doubling],
      }),
    );
    game.advance(300);
    const value = game.getSnapshot().resources.antimatter;
    if (!value) throw new TypeError("Missing Antimatter fixture value");
    const encoded = eternityNumbers.codec.serialize(value);
    expect(eternityNumbers.cmp(value, kit.q("7.99e1000"))).toBe(1);
    expect(eternityNumbers.cmp(value, kit.q("8.01e1000"))).toBe(-1);
    expect(eternityNumbers.codec.serialize(eternityNumbers.codec.parse(encoded))).toBe(encoded);
  });

  it("AD06 preserves enabled and disabled automation through save and offline replay", () => {
    for (const enabled of [false, true]) {
      const live = createAdSubject({
        challenge: 2,
        antimatter: Number.MAX_VALUE,
        dimensions: [1, 0, 0, 0, 0, 0, 0, 0],
      });
      live.game.dispatch(live.completeChallenge());
      if (enabled) live.game.dispatch(live.enableDimensionAutobuyer(true));
      const codec = createSaveCodec(live.model.definition, {
        stateSchemaVersion: 1,
        contentVersion: "ad-lab-s03",
        contentDigest: "ad06-save-offline",
      });
      const entitlement = {
        policyVersion: "ad06",
        enabled: true,
        capMs: null,
        excess: "discard" as const,
      };
      const loaded = codec.decode(
        codec.encode(live.game.getSnapshot(), {
          wallAnchorMs: 0,
          entitlement,
          catchup: null,
        }),
      );
      const started = beginCatchup(live.model.definition, loaded, 600, `ad06-${enabled}`);
      const replayed = processCatchupChunk(
        live.model.definition,
        createGame(live.model.definition, { snapshot: started.snapshot }),
        started.catchup as NonNullable<typeof started.catchup>,
        6,
      );
      if (!replayed.ok) throw new TypeError("Expected AD06 catch-up completion");
      live.game.advance(600);
      expect(replayed.value.snapshot.resources).toEqual(live.game.getSnapshot().resources);
      expect(replayed.value.snapshot.purchaseCounts).toEqual(
        live.game.getSnapshot().purchaseCounts,
      );
      expect(replayed.value.snapshot.progression.automation).toEqual(
        live.game.getSnapshot().progression.automation,
      );
    }
  });
});
