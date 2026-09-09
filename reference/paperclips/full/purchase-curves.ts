import { enumeratedCurve, nativeNumbers } from "../../../packages/core/src/index.js";

const sourceCurve = (kind: string, unitCost: (count: number) => number) =>
  enumeratedCurve(nativeNumbers, { kind, unitCost });

export const autoClipperCurve = sourceCurve("paperclips-auto-clipper", (count) =>
  count === 0 ? 5 : 1.1 ** count + 5,
);

export const megaClipperCurve = sourceCurve("paperclips-mega-clipper", (count) =>
  count === 0 ? 500 : 1_000 * 1.07 ** count,
);

export const droneCurve = sourceCurve(
  "paperclips-drone",
  (count) => (count + 1) ** 2.25 * 1_000_000,
);
