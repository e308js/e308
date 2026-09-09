import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const source = new URL("../../examples/finished-games/", import.meta.url);
const output = new URL("../../site-dist/", import.meta.url);

await rm(output, { recursive: true, force: true });
await Promise.all([
  mkdir(new URL("src/", output), { recursive: true }),
  mkdir(new URL("dist/", output), { recursive: true }),
]);

const html = await readFile(new URL("index.html", source), "utf8");
if (html.includes("reference-lab") || html.includes("ad-lab") || html.includes("kittens-lab")) {
  throw new TypeError("Public game page includes a reference laboratory");
}

await Promise.all([
  writeFile(new URL("index.html", output), html),
  copyFile(new URL("src/style.css", source), new URL("src/style.css", output)),
  copyFile(new URL("dist/app.js", source), new URL("dist/app.js", output)),
]);
