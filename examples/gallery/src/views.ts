import type { ViewDocument, ViewNode } from "@e308/ux";
import type { GalleryIntent, GalleryState } from "./kernel.js";
import { gainAction, hireAction, workPanel } from "./workshop.js";

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
      statusSection(state),
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
      expandedHelp(),
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

function statusSection(state: GalleryState): ViewNode<GalleryIntent, number> {
  return {
    kind: "section",
    id: "status",
    variant: "status-strip",
    title: "Current status",
    headingLevel: 3,
    children: [
      {
        kind: "row",
        id: "status-values",
        children: [
          resource(state),
          {
            kind: "help",
            id: "rate-help",
            label: "About Metal rate",
            targetId: "points",
            content: [
              {
                kind: "description",
                id: "rate-help-text",
                content: [
                  { kind: "text", value: "Workers produce an exact " },
                  { kind: "strong", children: [{ kind: "text", value: "1 point per second" }] },
                  { kind: "text", value: " each." },
                ],
              },
              {
                kind: "quantities",
                id: "rate-help-quantity",
                lines: [{ resourceId: "points", label: "Current rate", value: state.workers }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function expandedHelp(): ViewNode<GalleryIntent, number> {
  return {
    kind: "help",
    id: "expanded-help",
    label: "Workshop help",
    presentation: "expanded",
    content: [
      {
        kind: "description",
        id: "expanded-help-text",
        content: [{ kind: "text", value: "Expanded help remains in the reading order." }],
      },
    ],
  };
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
