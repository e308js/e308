import { paperclipsBuyables } from "./model.js";
import type { PaperclipsBuyableId } from "./types.js";

export function paperclipsBuyable(id: PaperclipsBuyableId) {
  return {
    "auto-clipper": paperclipsBuyables.autoClipper,
    "mega-clipper": paperclipsBuyables.megaClipper,
    marketing: paperclipsBuyables.marketing,
    harvester: paperclipsBuyables.harvester,
    "wire-drone": paperclipsBuyables.wireDrone,
    factory: paperclipsBuyables.factory,
    "solar-farm": paperclipsBuyables.solarFarm,
    battery: paperclipsBuyables.battery,
  }[id];
}
