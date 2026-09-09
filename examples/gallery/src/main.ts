import { createQuantityFormatter, createTextResolver, mountView, starterTheme } from "@e308/ux";
import { GalleryKernel } from "./kernel.js";
import { panelView, treeView } from "./views.js";

const nativeAdapter = {
  id: "gallery-native",
  implementationVersion: "1",
  codec: { id: "number", version: 1, serialize: String, parse: Number },
  fromNumber: Number,
  fromString: Number,
  add: (left: number, right: number) => left + right,
  sub: (left: number, right: number) => left - right,
  mul: (left: number, right: number) => left * right,
  div: (left: number, right: number) => left / right,
  cmp: (left: number, right: number): -1 | 0 | 1 => (left < right ? -1 : left > right ? 1 : 0),
  floor: Math.floor,
  isFinite: Number.isFinite,
};

const treeRoot = document.querySelector<HTMLElement>("#tree-view");
const panelRoot = document.querySelector<HTMLElement>("#panel-view");
const theme = document.querySelector<HTMLStyleElement>("#theme");
if (!treeRoot || !panelRoot || !theme) throw new Error("gallery host is incomplete");
theme.textContent = starterTheme;

const kernel = new GalleryKernel();
const resolver = createTextResolver({ quantities: createQuantityFormatter(nativeAdapter) });
mountView(treeRoot, { source: kernel, project: treeView, resolver });
mountView(panelRoot, { source: kernel, project: panelView, resolver });

Object.assign(window, {
  e308Gallery: {
    snapshot: () => kernel.getSnapshot(),
  },
});
