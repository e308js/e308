import type { ActionView, ViewDocument, ViewNode } from "@e308/ux";
import type { GalleryIntent, GalleryState } from "./kernel.js";

function gainAction(): ActionView<GalleryIntent, number> {
  return {
    id: "gain",
    label: "Make",
    enabled: true,
    intent: { type: "gain" },
    blockers: [],
    hold: { intent: { type: "gain" } },
  };
}

function hireAction(state: GalleryState): ActionView<GalleryIntent, number> {
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

export function treeView(state: GalleryState): ViewDocument<GalleryIntent, number> {
  return {
    title: "Tree composition",
    activeScopeIds: ["workshop"],
    hotkeys: [
      {
        id: "make",
        key: "m",
        description: "Make",
        enabled: true,
        intent: { type: "gain" },
        scopeId: "workshop",
      },
    ],
    content: [
      { kind: "heading", id: "tree-heading", level: 2, text: "Progress tree" },
      resource(state),
      {
        kind: "tree",
        id: "progress-tree",
        branches: [{ from: "make", to: "hire", dashed: true, color: "#78dce8" }],
        nodes: [
          { id: "make", label: "Make", x: 100, y: 80, action: gainAction(), mark: { label: "M" } },
          {
            id: "hire",
            label: "Hire",
            x: 260,
            y: 180,
            action: hireAction(state),
            ...(state.points >= 10 ? { highlight: "prestige" as const } : {}),
          },
          { id: "ghost", label: "Later", x: 420, y: 80, ghost: true, side: true },
        ],
      },
      particleLayer(state),
    ],
  };
}

export function panelView(state: GalleryState): ViewDocument<GalleryIntent, number> {
  return {
    title: "Panel composition",
    content: [
      { kind: "heading", id: "panel-heading", level: 2, text: "Workshop panels" },
      {
        kind: "tabs",
        id: "panel-tabs",
        tabs: [
          { id: "work", label: "Work", content: workPanel(state) },
          { id: "grid", label: "Grid", content: [gridPanel(state)] },
          { id: "hidden", label: "Undiscovered", hidden: true, content: [] },
        ],
      },
      {
        kind: "offline",
        id: "offline-summary",
        elapsedMs: 3_600_000,
        processedMs: 3_600_000,
        pendingMs: 0,
        discardedMs: 0,
        gains: [{ resourceId: "points", label: "Away points", value: 0 }],
        policyLabel: "Canonical catch-up",
      },
      { kind: "save", id: "save-status", status: "saved", message: "Local demo state" },
      ...state.notifications.map((text, index) => ({
        kind: "notification" as const,
        id: `notice-${index}`,
        text,
        tone: "positive" as const,
      })),
    ],
  };
}

function resource(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "resource",
    id: "points",
    resource: {
      resourceId: "points",
      label: "Points",
      value: state.points,
      rate: state.workers,
      capacity: 100,
    },
  };
}

function workPanel(state: GalleryState): ViewNode<GalleryIntent, number>[] {
  return [
    resource(state),
    {
      kind: "row",
      id: "actions",
      children: [
        {
          kind: "action",
          id: "make-action",
          action: gainAction(),
          mark: { label: "new", tone: "positive" },
        },
        { kind: "action", id: "hire-action", action: hireAction(state) },
      ],
    },
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
    {
      kind: "text-input",
      id: "workshop-name",
      label: "Name",
      value: state.name,
      intent: (value) => ({ type: "name", value }),
    },
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

function gridPanel(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "grid",
    id: "worker-grid",
    rows: 2,
    columns: 2,
    cells: [
      { id: "make-cell", row: 1, column: 1, label: "Make", action: gainAction(), variant: "round" },
      { id: "hire-cell", row: 1, column: 2, label: "Hire", action: hireAction(state) },
      {
        id: "worker-cell",
        row: 2,
        column: 1,
        label: `Workers: ${state.workers}`,
        mark: { label: "live" },
      },
    ],
  };
}

function particleLayer(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "particles",
    id: "stars",
    particles: [
      {
        id: "star",
        label: "★",
        x: 30,
        y: 30,
        size: 32,
        lifetimeMs: 60_000,
        velocityX: 2,
        fade: true,
        intent: { type: "claim-star" },
        claimId: "gallery-star",
        claimed: state.claimedStar,
      },
    ],
  };
}
