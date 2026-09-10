import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

const workspace = new URL("../../", import.meta.url);
const output = new URL("site-dist/", workspace);
const games = [
  {
    id: "wireworks",
    title: "Wireworks",
    summary: "Build a compact factory, choose its direction, and complete the final assembly.",
  },
  {
    id: "cascade",
    title: "Cascade",
    summary: "Grow a chain of dimensions through resets, challenges, and final research.",
  },
  {
    id: "hearth",
    title: "Hearth",
    summary: "Guide a settlement through the seasons and raise its great hall.",
  },
];

await rm(output, { recursive: true, force: true });
await Promise.all([
  mkdir(new URL("assets/", output), { recursive: true }),
  mkdir(new URL("docs/", output), { recursive: true }),
  mkdir(new URL("examples/", output), { recursive: true }),
  ...games.map(({ id }) => mkdir(new URL(`examples/${id}/`, output), { recursive: true })),
]);

const pages = [
  ["index.html", landingPage()],
  ["docs/index.html", docsPage()],
  ["examples/index.html", examplesPage()],
  ...games.map(({ id, title }) => [`examples/${id}/index.html`, gamePage(id, title)]),
];
for (const [path, html] of pages) {
  assertPublicPage(html);
  await writeFile(new URL(path, output), html);
}
await Promise.all([
  copyFile(new URL("site/style.css", workspace), new URL("assets/style.css", output)),
  copyFile(
    new URL("examples/finished-games/dist/app.js", workspace),
    new URL("assets/game.js", output),
  ),
]);

function page(title, description, active, main, depth = "../") {
  const links = [
    ["home", `${depth}`, "Home"],
    ["docs", `${depth}docs/`, "Docs"],
    ["examples", `${depth}examples/`, "Examples"],
  ];
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${description}" />
    <title>${title} · e308</title>
    <link rel="stylesheet" href="${depth}assets/style.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="wordmark" href="${depth}" aria-label="e308 home">e308</a>
      <nav aria-label="Main navigation">
        ${links.map(([id, href, label]) => `<a href="${href}"${id === active ? ' aria-current="page"' : ""}>${label}</a>`).join("\n        ")}
        <a href="https://github.com/e308js/e308">GitHub</a>
      </nav>
    </header>
    ${main}
    <footer><span>e308</span><span>MIT licensed</span><a href="https://github.com/e308js/e308">Source on GitHub</a></footer>
  </body>
</html>\n`;
}

function landingPage() {
  return page(
    "Incremental game toolkit",
    "e308 is a TypeScript toolkit for incremental and idle games.",
    "home",
    `<main class="landing">
      <section class="hero">
        <p class="eyebrow">TypeScript toolkit for incremental and idle games</p>
        <h1>Build incremental games in TypeScript.</h1>
        <p class="lede">e308 provides deterministic simulation, composable game mechanics, durable saves, offline progress, pacing tools, and adaptable interfaces.</p>
        <div class="actions"><a class="primary" href="./docs/">Read the docs</a><a href="./examples/">Play the examples</a></div>
      </section>
      <section class="package-band" aria-label="Packages">
        <div><code>@e308/core</code><p>Simulation, mechanics, saves, offline progress, and headless tools.</p></div>
        <div><code>@e308/ux</code><p>View models, accessible DOM controls, formatting, themes, and effects.</p></div>
      </section>
    </main>`,
    "./",
  );
}

function docsPage() {
  return page(
    "Docs",
    "Install e308 and define an incremental game in TypeScript.",
    "docs",
    `<main class="docs-page">
      <header><p class="eyebrow">Documentation</p><h1>Start building with e308</h1><p class="lede">Define the simulation in <code>@e308/core</code>, then project its snapshots into an interface with <code>@e308/ux</code>.</p></header>
      <section><h2>Install</h2><pre><code>pnpm add @e308/core @e308/ux</code></pre></section>
      <section><h2>Define a game</h2><pre><code>import { defineGame, nativeNumbers } from "@e308/core";

export const game = defineGame({
  id: "my-game",
  simulationVersion: 1,
  stepMs: 100,
  numbers: nativeNumbers,
  resources: [{ id: "energy", initial: 0 }],
  modules: [],
});</code></pre></section>
      <section><h2>References</h2><div class="link-list"><a href="https://github.com/e308js/e308/blob/main/docs/api-reference.md">API reference</a><a href="https://github.com/e308js/e308/blob/main/docs/migration-guide.md">Migration guide</a><a href="https://github.com/e308js/e308/blob/main/README.md">Developer guide</a></div></section>
    </main>`,
  );
}

function examplesPage() {
  const cards = games
    .map(
      ({ id, title, summary }) =>
        `<article class="game-card game-card-${id}"><p>Original game</p><h2>${title}</h2><p>${summary}</p><a href="./${id}/">Open ${title}</a></article>`,
    )
    .join("\n");
  return page(
    "Examples",
    "Explore three original incremental games built with e308.",
    "examples",
    `<main class="examples-page"><header><p class="eyebrow">Examples</p><h1>Three original games</h1><p class="lede">Each game has its own economy, progression model, offline policy, and interface.</p></header><section class="game-grid">${cards}</section></main>`,
  );
}

function gamePage(id, title) {
  return page(
    title,
    `${title} is a complete incremental game built with e308.`,
    "examples",
    `<main class="play-page">
      <header class="play-heading"><a href="../">← All examples</a><output id="host-status">Opening local save…</output></header>
      <div id="game" class="game-shell" aria-live="polite"></div>
      <details class="save-tools"><summary>Save and data</summary><div class="save-controls" aria-label="Save controls"><button type="button" id="save">Save</button><button type="button" id="export">Export</button><button type="button" id="import">Import</button><button type="button" id="reset">New save</button></div><textarea id="save-data" aria-label="Exported save" rows="3" placeholder="Paste a save here, or export the current save"></textarea></details>
      <details id="developer-tools" class="developer-tools"><summary>Developer tools</summary><p>Open this panel to show the manual time control inside the game.</p></details>
    </main>
    <script>document.body.dataset.game = "${id}"; document.body.classList.add("public-game");</script>
    <script type="module" src="../../assets/game.js"></script>`,
    "../../",
  );
}

function assertPublicPage(html) {
  for (const marker of [
    "reference-lab",
    "ad-lab",
    "kittens-lab",
    "array-lab",
    "paperclips",
    "universal paperclips",
    "antimatter dimensions",
  ]) {
    if (html.toLowerCase().includes(marker)) throw new TypeError(`Public page includes ${marker}`);
  }
}
