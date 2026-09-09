// @vitest-environment happy-dom

import {
  renderParticleLayer,
  starterTheme,
  type VisualClock,
} from "../../packages/ux/src/index.js";

describe("particle visual clock", () => {
  it("animates only through the injected visual clock and cancels on disposal", () => {
    let callback: ((time: number) => void) | undefined;
    let cancelled = -1;
    const clock: VisualClock = {
      now: () => 100,
      requestFrame: (next) => {
        callback = next;
        return 7;
      },
      cancelFrame: (id) => {
        cancelled = id;
      },
    };
    const disposers: (() => void)[] = [];
    const layer = renderParticleLayer("moving", {
      document,
      particles: [
        {
          id: "moving",
          label: "M",
          x: 0,
          y: 0,
          size: 5,
          lifetimeMs: 100,
          velocityX: 10,
          velocityY: 2,
          gravity: 4,
          rotation: 3,
        },
      ],
      reducedMotion: false,
      clock,
      claimed: new Set(),
      text: String,
      dispatch: () => undefined,
      dispose: (dispose) => disposers.push(dispose),
    });
    callback?.(150);
    expect((layer.firstElementChild as HTMLElement).style.transform).toContain("translate(0.5px");
    callback?.(250);
    expect(layer.childElementCount).toBe(0);
    disposers[0]?.();
    expect(cancelled).toBe(7);
  });

  it("renders images and suppresses source-claimed particles without scheduling motion", () => {
    let frames = 0;
    const layer = renderParticleLayer("still", {
      document,
      particles: [
        { id: "image", imageUrl: "/star.png", label: "Star", x: 0, y: 0, size: 5, lifetimeMs: 10 },
        { id: "blank", x: 0, y: 0, size: 5, lifetimeMs: 10 },
        { id: "claimed", claimed: true, x: 0, y: 0, size: 5, lifetimeMs: 10 },
        { id: "known", claimId: "known", x: 0, y: 0, size: 5, lifetimeMs: 10 },
      ],
      reducedMotion: true,
      clock: {
        now: () => 0,
        requestFrame: () => ++frames,
        cancelFrame: () => undefined,
      },
      claimed: new Set(["known"]),
      text: String,
      dispatch: () => undefined,
      dispose: () => undefined,
    });
    expect(layer.querySelector("img")?.alt).toBe("Star");
    expect(layer.childElementCount).toBe(2);
    expect(frames).toBe(0);
  });
});

it("exports an optional starter theme", () => {
  expect(starterTheme).toContain(".e308-root");
  expect(starterTheme).toContain("prefers-reduced-motion");
});
