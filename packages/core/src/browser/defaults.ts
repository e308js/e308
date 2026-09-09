import type { BrowserClock, BrowserScheduler } from "./types.js";

export const browserClock: BrowserClock = Object.freeze({
  wallNowMs: () => Date.now(),
  monotonicNowMs: () => performance.now(),
});

export const browserScheduler: BrowserScheduler = Object.freeze({
  every: (milliseconds: number, run: () => void) => globalThis.setInterval(run, milliseconds),
  cancel: (handle: unknown) => globalThis.clearInterval(handle as number),
});
