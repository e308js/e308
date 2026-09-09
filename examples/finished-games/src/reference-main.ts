import { mountReferenceLabs } from "./reference-labs.js";

mountReferenceLabs(required("ad-lab"), required("kittens-lab"));

function required(id: string): HTMLElement {
  const value = document.getElementById(id);
  if (!value) throw new TypeError(`Missing #${id}`);
  return value;
}
