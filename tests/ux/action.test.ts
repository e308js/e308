import { expect, expectTypeOf, it } from "vitest";
import type { ActionView } from "../../packages/ux/src/index.js";

it("allows a headless source to describe an action", () => {
  const action = {
    id: "buy-wire",
    label: "Buy wire",
    enabled: false,
    intent: { type: "buy-wire" },
    blockers: [{ kind: "insufficient", resourceId: "money", required: 2, available: 1 }],
  } as const satisfies ActionView;

  expect(action.blockers[0].kind).toBe("insufficient");
  expectTypeOf(action).toExtend<ActionView>();
});
