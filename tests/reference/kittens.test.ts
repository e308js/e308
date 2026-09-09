import { describe, expect, it } from "vitest";
import {
  beginCatchup,
  createGame,
  createSaveCodec,
  processCatchupChunk,
  recipeCommand,
  upgradeCommand,
} from "../../packages/core/src/index.js";
import {
  applyKittensRedshift,
  assignWorkers,
  build,
  craft,
  createKittensSubject,
  kittensEntitlement,
  subjectState,
} from "../../reference/kittens/subject.js";
import {
  kittensState,
  redshiftDays,
  sourceAssign,
  sourceBuild,
  sourceCraft,
  sourceRedshift,
  sourceReset,
  sourceTick,
} from "../../reference/kittens/upstream.js";

function expectResourcesClose(
  actual: ReturnType<typeof subjectState>,
  expected: ReturnType<typeof kittensState>,
) {
  for (const key of ["catnip", "wood", "minerals", "science", "beam"] as const)
    expect(actual.resources[key]).toBeCloseTo(expected.resources[key], 9);
  expect(actual).toMatchObject({
    kittens: expected.kittens,
    workers: expected.workers,
    season: expected.season,
    seasonTicks: expected.seasonTicks,
    year: expected.year,
    barns: expected.barns,
    huts: expected.huts,
    researchedConstruction: expected.researchedConstruction,
    paragon: expected.paragon,
  });
}

describe("Kittens Game bounded parity", () => {
  it("KG01 matches the early settlement resource ledger and capacities", () => {
    const initial = kittensState({
      resources: { catnip: 4_999, wood: 199.99, minerals: 249.9, science: 99.98, beam: 0 },
      kittens: 4,
      workers: { farmer: 1, woodcutter: 1, miner: 1, scholar: 1 },
    });
    const subject = createKittensSubject(initial);
    sourceTick(initial);
    subject.game.advance(200);
    expectResourcesClose(subjectState(subject), initial);
  });

  it("KG02 matches reassignment, upkeep, worker limits, and food shortage", () => {
    const upstream = kittensState({
      resources: { catnip: 0.2, wood: 0, minerals: 0, science: 0, beam: 0 },
      kittens: 2,
    });
    const subject = createKittensSubject(upstream);
    expect(sourceAssign(upstream, "farmer", 1)).toBe(true);
    assignWorkers(subject, { farmer: 1 });
    sourceTick(upstream);
    subject.game.advance(200);
    expectResourcesClose(subjectState(subject), upstream);
    expect(sourceAssign(upstream, "miner", 2)).toBe(false);
    const revision = subject.game.getSnapshot().revision;
    const result = subject.game.dispatch({
      id: "over-assign",
      execute: (tx) => tx.setAllocation(subject.model.workers.id, "miner", 2),
    });
    expect(result).toMatchObject({ ok: false, error: { code: "allocation-exceeded" } });
    expect(subject.game.getSnapshot().revision).toBe(revision);
    sourceAssign(upstream, "farmer", 0);
    assignWorkers(subject, { farmer: 0 });
    sourceTick(upstream);
    subject.game.advance(200);
    expect(subjectState(subject).resources.catnip).toBe(0);
  });

  it("KG03 matches one full deterministic calendar year and seasonal rates", () => {
    const upstream = kittensState({
      kittens: 1,
      workers: { farmer: 1, woodcutter: 0, miner: 0, scholar: 0 },
    });
    const subject = createKittensSubject(upstream);
    for (let season = 0; season < 4; season += 1) {
      sourceTick(upstream, 1_000);
      subject.game.advance(200_000);
      expectResourcesClose(subjectState(subject), upstream);
    }
    expect(
      subject.game.getSnapshot().calendars.year?.boundaries.map((entry) => entry.phaseId),
    ).toEqual(["summer", "autumn", "winter", "spring"]);
  });

  it("KG04 matches barn/hut construction, storage, refinement, and researched crafting", () => {
    const initial = kittensState({
      resources: { catnip: 100, wood: 50, minerals: 0, science: 10, beam: 0 },
    });
    const subject = createKittensSubject(initial);
    expect(build(createKittensSubject(), "hut")).toBe(false);
    expect(craft(createKittensSubject(), "beam")).toBe(false);
    expect(sourceBuild(initial, "barn")).toBe(true);
    expect(build(subject, "barn")).toBe(true);
    initial.resources.wood = 179;
    subject.game.dispatch({
      id: "post-barn-production",
      execute: (transaction) => transaction.set(subject.model.resources.wood, 179),
    });
    expect(sourceBuild(initial, "hut")).toBe(true);
    expect(build(subject, "hut")).toBe(true);
    expect(subject.game.dispatch(upgradeCommand(subject.model.construction)).ok).toBe(true);
    initial.resources.science -= 10;
    initial.researchedConstruction = true;
    expect(sourceCraft(initial, "wood")).toBe(true);
    expect(craft(subject, "wood")).toBe(true);
    expect(sourceCraft(initial, "beam")).toBe(true);
    const beamResult = subject.game.dispatch(
      recipeCommand(subject.model.recipes.craftBeam, { mode: "exact", count: 1 }),
    );
    if (!beamResult.ok) throw new Error(JSON.stringify(beamResult.error));
    expectResourcesClose(subjectState(subject), initial);
    subject.game.dispatch({
      id: "fill",
      execute: (tx) => tx.set(subject.model.resources.wood, 400),
    });
    expect(subject.game.getSnapshot().resources.wood).toBe(400);
  });

  it("seeds an explicit source calendar position", () => {
    const subject = createKittensSubject(kittensState({ season: 1, seasonTicks: 2, year: 3 }));
    expect(subjectState(subject)).toMatchObject({ season: 1, seasonTicks: 2, year: 3 });
  });

  it("KG05 applies source redshift rounding, dynamic caps, order, and negative-catnip policy", () => {
    expect(redshiftDays(4_999, false)).toBe(0);
    expect(redshiftDays(5_000, false)).toBe(3);
    expect(redshiftDays(99_000_000, false)).toBe(4_000);
    expect(redshiftDays(99_000_000, true)).toBe(16_000);
    const upstream = kittensState({
      resources: { catnip: 50, wood: 0, minerals: 0, science: 0, beam: 0 },
      kittens: 2,
      workers: { farmer: 0, woodcutter: 1, miner: 0, scholar: 0 },
    });
    const subject = createKittensSubject(upstream);
    const entitlement = kittensEntitlement(subject);
    const codec = createSaveCodec(subject.model.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "kg05",
    });
    const checkpoint = codec.decode(
      codec.encode(subject.game.getSnapshot(), { wallAnchorMs: 0, entitlement, catchup: null }),
    );
    const started = beginCatchup(subject.model.definition, checkpoint, 99_000_000, "kg05");
    const session = started.catchup;
    if (!session) throw new Error("expected catchup");
    const game = createGame(subject.model.definition, { snapshot: started.snapshot });
    const result = processCatchupChunk(subject.model.definition, game, session, 100_000, {
      kind: "custom-reward",
      apply: applyKittensRedshift({ ...subject, game }),
    });
    if (!result.ok) throw new Error("expected redshift");
    sourceRedshift(upstream, entitlement.capMs as number);
    expectResourcesClose(subjectState({ ...subject, game }), upstream);
    expect(result.value.session).toMatchObject({
      eligibleRealMs: 8_000_000,
      discardedRealMs: 91_000_000,
      report: { fidelity: "custom-reward" },
    });
  });

  it("KG06 preserves research through save/load and paragon through settlement reset", () => {
    const subject = createKittensSubject(
      kittensState({
        resources: { catnip: 10, wood: 175, minerals: 0, science: 10, beam: 0 },
        paragon: 3,
      }),
    );
    subject.game.dispatch(upgradeCommand(subject.model.construction));
    const entitlement = kittensEntitlement(subject);
    const codec = createSaveCodec(subject.model.definition, {
      stateSchemaVersion: 1,
      contentVersion: "1",
      contentDigest: "kg06",
    });
    const loaded = codec.decode(
      codec.encode(subject.game.getSnapshot(), { wallAnchorMs: 1, entitlement, catchup: null }),
    );
    const restored = createGame(subject.model.definition, { snapshot: loaded.snapshot });
    expect(restored.getSnapshot().progression.upgrades.construction).toBe(true);
    expect(craft({ ...subject, game: restored }, "beam")).toBe(true);
    expect(kittensEntitlement({ ...subject, game: restored }).capMs).toBe(32_000_000);
    restored.dispatch({
      id: "reset",
      execute: (tx) => tx.reset({ clear: [subject.model.settlement] }),
    });
    expect(restored.getSnapshot().resources).toMatchObject({ catnip: 0, paragon: 3 });
    const upstream = kittensState({ paragon: 3, researchedConstruction: true });
    sourceReset(upstream);
    expect(subjectState({ ...subject, game: restored }).paragon).toBe(upstream.paragon);
  });
});
