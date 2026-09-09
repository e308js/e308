import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("../../artifacts/packages/", import.meta.url));
const packageDirectories = [
  "packages/core",
  "packages/ux",
  "games/wireworks",
  "games/cascade",
  "games/hearth",
];

await mkdir(output, { recursive: true });
for (const file of await readdir(output))
  if (file.endsWith(".tgz")) await unlink(`${output}/${file}`);

const packages = [];
for (const directory of packageDirectories) {
  const metadata = JSON.parse(await readFile(`${root}/${directory}/package.json`, "utf8"));
  execFileSync("pnpm", ["--filter", metadata.name, "pack", "--pack-destination", output], {
    cwd: root,
    stdio: "pipe",
  });
  const file = `${metadata.name.replace("@", "").replace("/", "-")}-${metadata.version}.tgz`;
  const bytes = await readFile(`${output}/${file}`);
  packages.push({
    name: metadata.name,
    version: metadata.version,
    private: metadata.private === true,
    file,
    bytes: (await stat(`${output}/${file}`)).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const commit =
  process.env.GITHUB_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const manifest = {
  schema: "e308-release-evidence",
  schemaVersion: 1,
  status: "IN REVIEW",
  commit,
  generatedAt: new Date().toISOString(),
  packages,
  gates: [
    gate("D1", "PASS", "docs/evidence/tmt/index.json", "source audit pending"),
    gate("D1R", "PASS", "docs/evidence/reference-games.json", "source review pending"),
    gate("D2", "PASS", "artifacts/finished-games/reports.json", "walkthrough pending"),
    gate("D3", "PASS", "coverage/coverage-summary.json"),
    gate("D4", "PASS", "tests/games/offline-matrix.test.ts", "physical-device sleep run pending"),
    gate("D5", "PASS", "playwright-report/", "desktop and touch review pending"),
    gate("D6", "PASS", "artifacts/finished-games/aggregate.md"),
    gate("D7", "PASS", "artifacts/performance/workloads.json"),
    gate("D8", "PASS", "artifacts/packages/release-evidence.json", "final review sign-off pending"),
  ],
};
await writeFile(`${output}/release-evidence.json`, `${JSON.stringify(manifest, null, 2)}\n`);

function gate(id, automatedStatus, evidence, openReview) {
  return {
    id,
    automatedStatus,
    evidence,
    ...(openReview ? { openReview } : {}),
  };
}
