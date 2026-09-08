import { expect, expectTypeOf, it } from "vitest";
import type { ActionView } from "../../packages/ux/src/index.js";

it("allows a headless source to describe an action", () => {
  const action = {
    id: "buy-wire",
    label: "Buy wire",
    enabled: false,
    blockers: [{ kind: "insufficient", resource: "money" }],
  } as const satisfies ActionView;

  expect(action.blockers[0].kind).toBe("insufficient");
  expectTypeOf(action).toMatchTypeOf<ActionView>();
});
