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

export function paperclipsMachinePrerequisite(id: PaperclipsBuyableId): string | undefined {
  const prerequisites: Partial<Record<PaperclipsBuyableId, string>> = {
    harvester: "harvester-drones",
    "wire-drone": "wire-drones",
    factory: "clip-factories",
    "solar-farm": "power-grid",
    battery: "power-grid",
  };
  return prerequisites[id];
}

export function paperclipsMachineTarget(id: PaperclipsBuyableId): number {
  if (id === "auto-clipper") return 75;
  if (id === "mega-clipper") return 25;
  if (id === "marketing") return 10;
  if (id === "harvester" || id === "wire-drone") return 25_000;
  if (id === "factory") return 50;
  if (id === "battery" || id === "solar-farm") return 5;
  return 10;
}

export function paperclipsMachineRank(id: PaperclipsBuyableId, count: number): number {
  if (id === "mega-clipper") return 800;
  if (id === "auto-clipper") return 700;
  if (id === "factory" && count === 0) return 900;
  if (id === "solar-farm") return 890;
  if (id === "battery") return 880;
  if (id === "harvester") return 870;
  if (id === "wire-drone") return 860;
  return 750;
}
