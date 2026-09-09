import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const output = new URL("../../artifacts/packages/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("release-evidence.json", output), "utf8"));

assert(manifest.schema === "e308-release-evidence", "invalid release evidence schema");
assert(manifest.schemaVersion === 1 && manifest.status === "IN REVIEW", "invalid release status");
assert(/^[a-f0-9]{40}$/.test(manifest.commit), "release evidence needs an exact commit");
assert(manifest.packages.length === 5, "release evidence needs five archives");
assert(
  manifest.gates.map(({ id }) => id).join(",") === "D1,D1R,D2,D3,D4,D5,D6,D7,D8",
  "gate inventory mismatch",
);

for (const item of manifest.packages) {
  const archiveUrl = new URL(item.file, output);
  const archive = await readFile(archiveUrl);
  assert(
    (await stat(new URL(item.file, output))).size === item.bytes,
    `size mismatch: ${item.file}`,
  );
  assert(
    createHash("sha256").update(archive).digest("hex") === item.sha256,
    `hash mismatch: ${item.file}`,
  );
  if (item.name === "@e308/core" || item.name === "@e308/ux")
    assert(item.version === "1.0.0-rc.1" && !item.private, `invalid public RC: ${item.name}`);
  const contents = execFileSync("tar", ["-tzf", fileURLToPath(archiveUrl)], {
    encoding: "utf8",
  }).toLowerCase();
  for (const marker of ["reference/", "paperclips", "antimatter"]) {
    assert(!contents.includes(marker), `${item.file} includes internal fixture marker: ${marker}`);
  }
}
for (const item of manifest.gates) {
  assert(item.automatedStatus === "PASS", `automated gate failed: ${item.id}`);
  const path = item.evidence.endsWith("/") ? item.evidence.slice(0, -1) : item.evidence;
  await access(new URL(path, root));
}

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}
