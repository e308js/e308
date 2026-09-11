import type { ActionView, ViewNode } from "@e308/ux";
import type { GalleryIntent, GalleryState } from "./kernel.js";

export function gainAction(): ActionView<GalleryIntent, number> {
  return {
    id: "gain",
    label: "Make",
    enabled: true,
    intent: { type: "gain" },
    blockers: [],
    hold: { intent: { type: "gain" } },
  };
}

export function hireAction(state: GalleryState): ActionView<GalleryIntent, number> {
  const enabled = state.points >= 10;
  return {
    id: "hire",
    label: "Hire worker",
    enabled,
    intent: { type: "hire" },
    blockers: enabled
      ? []
      : [{ kind: "insufficient", resourceId: "points", required: 10, available: state.points }],
    costs: [{ resourceId: "points", label: "Points", value: 10 }],
  };
}

function prerequisiteAction(state: GalleryState): ActionView<GalleryIntent, number> {
  return {
    id: "calibrate",
    label: "Calibrate forge",
    enabled: false,
    intent: { type: "gain" },
    blockers: [
      { kind: "locked", prerequisiteIds: ["precision-tools", "forge-level-2"] },
      { kind: "insufficient", resourceId: "points", required: 50, available: state.points },
    ],
    tone: "secondary",
  };
}

export function workPanel(state: GalleryState): ViewNode<GalleryIntent, number>[] {
  return [
    actionGroup(state),
    ...feedback(state),
    {
      kind: "progress",
      id: "goal-right",
      label: "Goal right",
      value: state.points / 50,
      direction: "right",
      animated: true,
    },
    {
      kind: "progress",
      id: "goal-up",
      label: "Goal up",
      value: state.points / 50,
      direction: "up",
    },
    options(state),
    {
      kind: "infobox",
      id: "about",
      title: "About",
      content: [
        {
          kind: "description",
          id: "about-text",
          content: [{ kind: "text", value: "This panel reads the same state as the tree." }],
        },
      ],
    },
  ];
}

function actionGroup(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "row",
    id: "actions",
    style: { className: "e308-action-group" },
    children: [
      {
        kind: "action",
        id: "make-action",
        action: gainAction(),
        mark: { label: "new", tone: "positive" },
      },
      { kind: "action", id: "hire-action", action: hireAction(state) },
      { kind: "action", id: "blocked-action", action: prerequisiteAction(state) },
      { kind: "action", id: "pending-action", action: pendingAction() },
      { kind: "action", id: "success-action", action: successAction() },
      { kind: "action", id: "rejected-action", action: riskyAction(state) },
    ],
  };
}

function pendingAction(): ActionView<GalleryIntent, number> {
  return {
    id: "pending-sync",
    label: "Syncing command",
    enabled: true,
    state: "pending",
    intent: { type: "gain" },
    blockers: [],
    tone: "secondary",
  };
}

function successAction(): ActionView<GalleryIntent, number> {
  return {
    id: "completed-command",
    label: "Completed command",
    enabled: true,
    state: "successful",
    intent: { type: "gain" },
    blockers: [],
  };
}

function riskyAction(state: GalleryState): ActionView<GalleryIntent, number> {
  return {
    id: "risky-command",
    label: "Submit risky command",
    enabled: true,
    state: state.riskyRejected ? "rejected" : "available",
    tone: "destructive",
    intent: { type: "reject-risky" },
    blockers: [],
  };
}

function feedback(state: GalleryState): ViewNode<GalleryIntent, number>[] {
  return [
    {
      kind: "command-feedback",
      id: "pending-feedback",
      targetId: "pending-sync",
      state: "pending",
      message: "Waiting for the authoritative worker…",
      presentation: "inline",
    },
    {
      kind: "command-feedback",
      id: "success-feedback",
      targetId: "completed-command",
      state: "success",
      message: "The command completed successfully.",
      presentation: "banner",
    },
    ...(state.riskyRejected ? [failureFeedback()] : []),
  ];
}

function failureFeedback(): ViewNode<GalleryIntent, number> {
  return {
    kind: "command-feedback",
    id: "failure-feedback",
    targetId: "risky-command",
    state: "failure",
    message: "The server rejected the command.",
    presentation: "toast",
    errors: [
      {
        id: "name-required",
        targetId: "workshop-name-control",
        label: "Name",
        message: "Choose a longer workshop name.",
      },
    ],
  };
}

function options(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "fieldset",
    id: "workshop-options",
    legend: "Workshop options",
    children: [
      {
        kind: "text-input",
        id: "workshop-name",
        domId: "workshop-name-control",
        label: "Name",
        value: state.name,
        intent: (value) => ({ type: "name", value }),
      },
      {
        kind: "toggle-input",
        id: "repeat",
        domId: "repeat-control",
        label: "Repeat",
        value: state.repeat,
        intent: (value) => ({ type: "repeat", value }),
      },
    ],
  };
}
