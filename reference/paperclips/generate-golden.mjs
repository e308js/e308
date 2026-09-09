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

const initialRuntime = loadedRuntime();
const scenarios = {
  initial: initialRuntime.read([
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
  retail: retailTrace(loadedRuntime()),
  machineCosts: machineCostTrace(loadedRuntime()),
  autoClipperProjects: autoClipperProjectTrace(loadedRuntime()),
  wireProjects: wireProjectTrace(loadedRuntime()),
  timedRetail: timedRetailTrace(loadedRuntime()),
  trustProjects: trustProjectTrace(loadedRuntime()),
  trustThresholds: trustThresholdTrace(loadedRuntime()),
  hypnoTransition: hypnoTransitionTrace(loadedRuntime()),
  strategyProjects: strategyProjectTrace(loadedRuntime()),
  photonicChips: photonicChipTrace(loadedRuntime()),
};

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schema: "e308-paperclips-golden-trace",
      schemaVersion: 1,
      sources: expectedHashes,
      random: { kind: "scripted", fallback: 0.5 },
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

function timedRetailTrace(runtime) {
  runtime.run(
    "clips=20; unusedClips=20; unsoldClips=20; wire=100; funds=0; margin=.25; " +
      "clipmakerLevel=10; clipperBoost=1; megaClipperLevel=0; megaClipperBoost=1; " +
      "wireBasePrice=20; wireCost=20; " +
      "wirePriceCounter=0; wirePriceTimer=248; marketingLvl=1; demandBoost=1; prestigeU=0",
  );
  const checkpoints = [];
  for (const draws of [
    [0.5, 0.5],
    [0.5, 0],
    [0, 0.5],
  ]) {
    for (let index = 0; index < 10; index += 1) {
      runtime.run(
        "clipClick(clipperBoost*(clipmakerLevel/100)); " +
          "clipClick(megaClipperBoost*(megaClipperLevel*5)); " +
          "marketing=Math.pow(1.1,(marketingLvl-1)); " +
          "demand=((.8/margin)*marketing*marketingEffectiveness)*demandBoost; " +
          "demand=demand+((demand/10)*prestigeU)",
      );
    }
    runtime.setRandomSequence(draws);
    runtime.run(
      "adjustWirePrice(); " +
        "if (Math.random() < (demand/100)) sellClips(Math.floor(.7*Math.pow(demand,1.15)))",
    );
    checkpoints.push(
      runtime.read([
        "clips",
        "unsoldClips",
        "funds",
        "wire",
        "demand",
        "wireBasePrice",
        "wireCost",
        "wirePriceCounter",
        "wirePriceTimer",
      ]),
    );
  }
  return {
    draws: [
      [0.5, 0.5],
      [0.5, 0],
      [0, 0.5],
    ],
    checkpoints,
  };
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

function trustProjectTrace(runtime) {
  runtime.run(
    "standardOps=250000; operations=250000; creativity=5000; yomi=50000; trust=8; stockGainThreshold=.5",
  );
  const checkpoints = [];
  for (const name of [
    "project6",
    "project13",
    "project14",
    "project15",
    "project17",
    "project19",
    "project27",
    "project28",
    "project29",
    "project30",
    "project31",
  ]) {
    runtime.run(`${name}.element=document.getElementById('${name}'); ${name}.effect()`);
    checkpoints.push({
      project: name,
      ...runtime.read(["trust", "standardOps", "creativity", "yomi", "stockGainThreshold"]),
    });
  }
  return checkpoints;
}

function trustThresholdTrace(runtime) {
  const checkpoints = [];
  for (const clips of [3_000, 5_000, 8_000, 13_000]) {
    runtime.run(`clips=${clips}; calculateTrust()`);
    checkpoints.push(runtime.read(["clips", "trust", "nextTrust", "fib1", "fib2"]));
  }
  runtime.run(
    "creativity=50; project13.element=document.getElementById('project13'); project13.effect()",
  );
  checkpoints.push(runtime.read(["clips", "trust", "nextTrust", "fib1", "fib2"]));
  runtime.run("clips=21000; calculateTrust()");
  checkpoints.push(runtime.read(["clips", "trust", "nextTrust", "fib1", "fib2"]));
  return checkpoints;
}

function hypnoTransitionTrace(runtime) {
  runtime.run(
    "standardOps=100000; operations=100000; creativity=500; trust=100; wire=4321; clipmakerLevel=75; megaClipperLevel=4; marketingEffectiveness=1",
  );
  const marketing = [];
  for (const name of ["project13", "project11", "project14", "project12", "project34"]) {
    runtime.run(`${name}.element=document.getElementById('${name}'); ${name}.effect()`);
    marketing.push({
      project: name,
      ...runtime.read(["trust", "standardOps", "creativity", "marketingEffectiveness"]),
    });
  }
  runtime.run("project70.element=document.getElementById('project70'); project70.effect()");
  runtime.run("project35.element=document.getElementById('project35'); project35.effect()");
  return {
    marketing,
    released: runtime.read([
      "trust",
      "clipmakerLevel",
      "megaClipperLevel",
      "wire",
      "nanoWire",
      "humanFlag",
    ]),
  };
}

function strategyProjectTrace(runtime) {
  runtime.run(
    "standardOps=300000; operations=300000; creativity=75000; tourneyCost=1000; trust=90",
  );
  const checkpoints = [];
  for (const name of [
    "project60",
    "project61",
    "project62",
    "project63",
    "project64",
    "project65",
    "project66",
  ]) {
    runtime.run(`${name}.element=document.getElementById('${name}'); ${name}.effect()`);
    checkpoints.push({
      project: name,
      ...runtime.read(["standardOps", "tourneyCost"]),
      strategies: runtime.run("strats.length"),
    });
  }
  runtime.run("project119.element=document.getElementById('project119'); project119.effect()");
  const theoryOfMind = runtime.read(["standardOps", "creativity", "tourneyCost", "yomiBoost"]);
  runtime.run(
    "project20.flag=1; project118.element=document.getElementById('project118'); project118.effect()",
  );
  const autoTourney = runtime.read(["creativity", "autoTourneyFlag"]);
  return { checkpoints, theoryOfMind, autoTourney };
}

function photonicChipTrace(runtime) {
  runtime.run("standardOps=500000; operations=500000; project50.flag=1");
  const purchases = [];
  for (let index = 0; index < 10; index += 1) {
    runtime.run("project51.element=document.getElementById('project51'); project51.effect()");
    purchases.push({
      ...runtime.read(["standardOps", "qChipCost", "nextQchip"]),
      active: runtime.run("qChips.filter(chip => chip.active === 1).length"),
    });
  }
  runtime.run("standardOps=0; operations=0; tempOps=0; memory=10; processors=0");
  for (let index = 0; index < 100; index += 1) runtime.run("quantumCompute()");
  runtime.run("qComp()");
  const computed = {
    ...runtime.read(["qClock", "standardOps", "tempOps"]),
    values: runtime.run("qChips.map(chip => chip.value)"),
  };
  runtime.run("standardOps=9900; operations=9900; tempOps=0; qComp()");
  const overflow = runtime.read(["standardOps", "tempOps"]);
  return { purchases, computed, overflow };
}

function loadedRuntime() {
  const runtime = createRuntime();
  for (const file of sourceFiles) runtime.evaluate(requiredSource(file), file);
  return runtime;
}

function createRuntime() {
  const elements = new Map();
  const intervals = [];
  const storage = new Map();
  let randomSequence = [];
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
  context.Math.random = () => randomSequence.shift() ?? 0.5;
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return {
    evaluate: (source, filename) => vm.runInContext(source, context, { filename }),
    read: (names) => Object.fromEntries(names.map((name) => [name, context[name]])),
    run: (source) => vm.runInContext(source, context),
    setRandomSequence: (values) => {
      randomSequence = [...values];
    },
  };
}

function requiredSource(file) {
  const source = sources.get(file);
  if (!source) throw new TypeError(`Missing source: ${file}`);
  return source;
}
