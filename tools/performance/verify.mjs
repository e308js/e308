import { readFile } from "node:fs/promises";

const report = JSON.parse(
  await readFile(new URL("../../artifacts/performance/workloads.json", import.meta.url), "utf8"),
);
const expectedGames = ["wireworks", "cascade", "hearth"];
const expectedCheckpoints = ["beginning", "middle", "ending"];
const expectedDurations = ["1 minute", "1 hour", "8 hours", "1 day", "30 days"];

assert(report.schema === "e308-workloads" && report.schemaVersion === 1, "invalid report schema");
assert(report.workloads.length === 45, "expected 45 workload rows");
for (const game of expectedGames) {
  for (const checkpoint of expectedCheckpoints) {
    for (const duration of expectedDurations) {
      const row = report.workloads.find(
        (item) =>
          item.scenario === game && item.checkpoint === checkpoint && item.duration === duration,
      );
      assert(row, `missing ${game}/${checkpoint}/${duration}`);
      assert(row.cold.mode === "exact" && row.warm.mode === "exact", "approximate workload found");
      if (duration === "8 hours") {
        assert(row.cold.repetitions >= 10, "eight-hour cold sample count below ten");
        assert(row.warm.repetitions >= 10, "eight-hour warm sample count below ten");
        assert(row.cold.elapsed.p95Ms <= 2_000, "eight-hour cold p95 exceeds two seconds");
        assert(row.warm.elapsed.p95Ms <= 2_000, "eight-hour warm p95 exceeds two seconds");
        assert(row.cold.pendingMs === 0 && row.warm.pendingMs === 0, "eight-hour work incomplete");
      }
      if (duration === "30 days") {
        assert(row.cold.repetitions >= 1 && row.warm.repetitions >= 1, "30-day timing missing");
        assert(row.cold.pendingMs === row.warm.pendingMs, "30-day backlog changed by warm-up");
      }
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}
