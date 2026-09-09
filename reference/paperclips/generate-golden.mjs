import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";

const [sourceDirectory, outputPath] = process.argv.slice(2);
if (!sourceDirectory || !outputPath) {
  throw new TypeError("usage: node generate-golden.mjs <source-directory> <output.json>");
}

const sourceFiles = ["combat.js", "globals.js", "projects.js", "main.js"];
const expectedHashes = {
  "combat.js": "c7226d012193c32a00bed53d7cb0119d4d3f91cb556b8e8d1b98dd3375be811a",
  "globals.js": "968abd83c7090f24b6817842b4453b6d24de0e03e06d7ccb5ec4d15bee520919",
  "main.js": "ee599076de868869e533490505189ddcb72dcc8748909ceeebe11e789f1b3a0a",
  "projects.js": "05034c51809bc0632e8963e671c8e68c68604ca3643da291e0c6fabc86152774",
};
const sources = new Map();
for (const file of sourceFiles) {
  const source = await readFile(`${sourceDirectory}/${file}`, "utf8");
  const actual = createHash("sha256").update(source).digest("hex");
  if (actual !== expectedHashes[file]) throw new TypeError(`Source hash mismatch: ${file}`);
  sources.set(file, source);
}

const runtime = createRuntime();
for (const file of sourceFiles) runtime.evaluate(requiredSource(file), file);
const scenarios = {
  initial: runtime.read([
    "clips",
    "unusedClips",
    "unsoldClips",
    "funds",
    "margin",
    "wire",
    "wireCost",
    "wireSupply",
    "clipmakerLevel",
    "clipperCost",
    "megaClipperLevel",
    "megaClipperCost",
    "marketingLvl",
    "adCost",
    "processors",
    "memory",
    "operations",
    "trust",
  ]),
  retail: retailTrace(runtime),
  machineCosts: machineCostTrace(runtime),
  autoClipperProjects: autoClipperProjectTrace(runtime),
  wireProjects: wireProjectTrace(runtime),
};

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schema: "e308-paperclips-golden-trace",
      schemaVersion: 1,
      sources: expectedHashes,
      random: { kind: "constant", value: 0.5 },
      scenarios,
    },
    null,
    2,
  )}\n`,
);

function retailTrace(runtime) {
  runtime.run("clipClick(10)");
  const afterManual = runtime.read(["clips", "unusedClips", "unsoldClips", "wire"]);
  runtime.run("sellClips(3)");
  const afterSale = runtime.read(["funds", "income", "clipsSold", "unsoldClips"]);
  runtime.run("raisePrice(); raisePrice(); lowerPrice()");
  const afterPrice = runtime.read(["margin"]);
  return { afterManual, afterSale, afterPrice };
}

function machineCostTrace(runtime) {
  runtime.run("funds=20000");
  const autoClippers = [];
  for (let index = 0; index < 3; index += 1) {
    runtime.run("makeClipper()");
    autoClippers.push(runtime.read(["clipmakerLevel", "clipperCost", "funds"]));
  }
  runtime.run("funds=20000");
  const megaClippers = [];
  for (let index = 0; index < 3; index += 1) {
    runtime.run("makeMegaClipper()");
    megaClippers.push(runtime.read(["megaClipperLevel", "megaClipperCost", "funds"]));
  }
  runtime.run("funds=20000");
  const marketing = [];
  for (let index = 0; index < 3; index += 1) {
    runtime.run("buyAds()");
    marketing.push(runtime.read(["marketingLvl", "adCost", "funds"]));
  }
  return { autoClippers, megaClippers, marketing };
}

function autoClipperProjectTrace(runtime) {
  runtime.run("standardOps=20000; operations=20000; clipperBoost=1; boostLvl=0");
  const checkpoints = [];
  for (const project of ["project1", "project4", "project5"]) {
    runtime.run(`${project}.element=document.getElementById('${project}'); ${project}.effect()`);
    checkpoints.push(runtime.read(["clipperBoost", "boostLvl", "standardOps"]));
  }
  return checkpoints;
}

function wireProjectTrace(runtime) {
  runtime.run("standardOps=50000; operations=50000; wireSupply=1000");
  const checkpoints = [];
  for (const project of ["project7", "project8", "project9", "project10"]) {
    runtime.run(`${project}.element=document.getElementById('${project}'); ${project}.effect()`);
    checkpoints.push(runtime.read(["wireSupply", "standardOps"]));
  }
  runtime.run(
    "wireCost=125; project10b.element=document.getElementById('project10b'); project10b.effect()",
  );
  checkpoints.push(runtime.read(["wireSupply", "standardOps"]));
  return checkpoints;
}

function createRuntime() {
  const elements = new Map();
  const intervals = [];
  const storage = new Map();
  const element = (id = "") => {
    const existing = elements.get(id);
    if (existing) return existing;
    const target = { id, style: {}, children: [], value: "0", innerHTML: "", disabled: false };
    const proxy = new Proxy(target, {
      get(object, property) {
        if (property === "parentNode") return proxy;
        if (property === "getContext") return () => new Proxy({}, { get: () => () => undefined });
        if (property in object) return object[property];
        return () => proxy;
      },
      set(object, property, value) {
        object[property] = value;
        return true;
      },
    });
    elements.set(id, proxy);
    return proxy;
  };
  const document = {
    body: element("body"),
    createElement: (tag) => element(`created-${tag}-${elements.size}`),
    createTextNode: (text) => ({ textContent: text }),
    getElementById: (id) => element(id),
  };
  const context = {
    Array,
    Audio: class {
      addEventListener() {}
      play() {}
    },
    Boolean,
    Date,
    Infinity,
    JSON,
    Math: Object.create(Math),
    NaN,
    Number,
    Object,
    String,
    alert() {},
    clearInterval() {},
    clearTimeout() {},
    confirm: () => true,
    console,
    document,
    isNaN,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    location: { reload() {} },
    navigator: {},
    parseFloat,
    parseInt,
    setInterval: (callback, milliseconds) => {
      intervals.push({ callback, milliseconds });
      return intervals.length;
    },
    setTimeout: (callback) => {
      callback();
      return 1;
    },
  };
  context.Math.random = () => 0.5;
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return {
    evaluate: (source, filename) => vm.runInContext(source, context, { filename }),
    read: (names) => Object.fromEntries(names.map((name) => [name, context[name]])),
    run: (source) => vm.runInContext(source, context),
  };
}

function requiredSource(file) {
  const source = sources.get(file);
  if (!source) throw new TypeError(`Missing source: ${file}`);
  return source;
}
