import type { DescriptionNode, TextValue } from "../localization/types.js";
import type {
  ActionView,
  OfflineView,
  QuantityLine,
  ResetView,
  ResourceView,
  SaveView,
} from "./models.js";

export interface ViewStyle {
  readonly color?: string;
  readonly background?: string;
  readonly borderColor?: string;
  readonly width?: string;
  readonly maxWidth?: string;
  readonly height?: string;
  readonly className?: string;
}

export interface MarkView<N = unknown> {
  readonly label: TextValue<N>;
  readonly tone?: "neutral" | "positive" | "warning" | "danger";
}

export interface HotkeyView<Intent> {
  readonly id: string;
  readonly key: string;
  readonly modifiers?: readonly ("alt" | "ctrl" | "meta" | "shift")[];
  readonly description: TextValue;
  readonly enabled: boolean;
  readonly intent: Intent;
  readonly scopeId?: string;
}

export interface TreeNodeView<Intent, N> {
  readonly id: string;
  readonly label: TextValue<N>;
  readonly x: number;
  readonly y: number;
  readonly action?: ActionView<Intent, N>;
  readonly imageUrl?: string;
  readonly ghost?: boolean;
  readonly side?: boolean;
  readonly hidden?: boolean;
  readonly mark?: MarkView<N>;
  readonly highlight?: "notification" | "prestige";
  readonly style?: ViewStyle;
}

export interface TreeBranchView {
  readonly from: string;
  readonly to: string;
  readonly color?: string;
  readonly width?: number;
  readonly dashed?: boolean;
}

export interface GridCellView<Intent, N> {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly label: TextValue<N>;
  readonly action?: ActionView<Intent, N>;
  readonly hidden?: boolean;
  readonly variant?: "square" | "round";
  readonly mark?: MarkView<N>;
}

export interface TabView<Intent, N> {
  readonly id: string;
  readonly label: TextValue<N>;
  readonly content: readonly ViewNode<Intent, N>[];
  readonly hidden?: boolean;
  readonly disabled?: boolean;
}

export interface ParticleView<Intent, N> {
  readonly id: string;
  readonly label?: TextValue<N>;
  readonly imageUrl?: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly gravity?: number;
  readonly rotation?: number;
  readonly lifetimeMs: number;
  readonly fade?: boolean;
  readonly intent?: Intent;
  readonly hoverIntent?: Intent;
  readonly leaveIntent?: Intent;
  readonly claimId?: string;
  readonly claimed?: boolean;
}

export interface ViewDocument<Intent = unknown, N = unknown> {
  readonly title?: TextValue<N>;
  readonly content: readonly ViewNode<Intent, N>[];
  readonly hotkeys?: readonly HotkeyView<Intent>[];
  readonly activeScopeIds?: readonly string[];
}

export interface CommandFeedbackError<N = unknown> {
  readonly id: string;
  /** The DOM id of the affected control, when an error can be corrected there. */
  readonly targetId?: string;
  readonly label: TextValue<N>;
  readonly message: TextValue<N>;
}

export interface CommandFeedbackView<N = unknown> {
  readonly kind: "command-feedback";
  readonly id: string;
  /** Stable game-authored action or form identifier. */
  readonly targetId: string;
  readonly state: "pending" | "success" | "failure";
  readonly message: TextValue<N>;
  readonly presentation?: "inline" | "banner" | "toast";
  readonly focusOnError?: boolean;
  readonly errors?: readonly CommandFeedbackError<N>[];
}

export type InputView<Intent, N> =
  | {
      readonly kind: "text-input";
      readonly id: string;
      readonly domId?: string;
      readonly label: TextValue<N>;
      readonly tooltip?: TextValue<N>;
      readonly value: string;
      readonly intent: (value: string) => Intent;
    }
  | {
      readonly kind: "range-input";
      readonly id: string;
      readonly domId?: string;
      readonly label: TextValue<N>;
      readonly tooltip?: TextValue<N>;
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly allowedMax?: number;
      readonly showTicks?: boolean;
      readonly intent: (value: number) => Intent;
    }
  | {
      readonly kind: "select-input";
      readonly id: string;
      readonly domId?: string;
      readonly label: TextValue<N>;
      readonly tooltip?: TextValue<N>;
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: TextValue<N> }[];
      readonly intent: (value: string) => Intent;
    }
  | {
      readonly kind: "toggle-input";
      readonly id: string;
      readonly domId?: string;
      readonly label: TextValue<N>;
      readonly tooltip?: TextValue<N>;
      readonly value: boolean;
      readonly intent: (value: boolean) => Intent;
    };

export type ViewNode<Intent = unknown, N = unknown> =
  | {
      readonly kind: "stack" | "row";
      readonly id: string;
      readonly children: readonly ViewNode<Intent, N>[];
      readonly hidden?: boolean;
      readonly style?: ViewStyle;
    }
  | {
      readonly kind: "heading";
      readonly id: string;
      readonly level: 1 | 2 | 3 | 4;
      readonly text: TextValue<N>;
    }
  | {
      readonly kind: "description";
      readonly id: string;
      readonly content: readonly DescriptionNode<N>[];
    }
  | {
      readonly kind: "help";
      readonly id: string;
      /** Accessible trigger name, for example "About Metal rate". */
      readonly label: TextValue<N>;
      /** Stable identifier of the concept or control this help explains. */
      readonly targetId?: string;
      readonly triggerLabel?: TextValue<N>;
      readonly content: readonly ViewNode<Intent, N>[];
      readonly presentation?: "popover" | "expanded";
      /** Preview on mouse hover or keyboard focus; activation pins it until dismissal. */
      readonly preview?: boolean;
      /** Mouse-only dwell before previewing; default 120 ms. Keyboard/touch are immediate. */
      readonly previewDelayMs?: number;
      /** Opt-in mouse movement dismissal, in CSS pixels from where the preview opened. */
      readonly previewMoveDismissPx?: number;
      readonly initiallyOpen?: boolean;
    }
  | {
      readonly kind: "section";
      readonly id: string;
      readonly title?: TextValue<N>;
      readonly headingLevel?: 2 | 3 | 4;
      readonly children: readonly ViewNode<Intent, N>[];
      readonly variant?: "plain" | "card" | "status-strip";
      readonly style?: ViewStyle;
    }
  | {
      readonly kind: "fieldset";
      readonly id: string;
      readonly legend: TextValue<N>;
      readonly children: readonly ViewNode<Intent, N>[];
      readonly style?: ViewStyle;
    }
  | { readonly kind: "separator"; readonly id: string }
  | {
      readonly kind: "image";
      readonly id: string;
      readonly src: string;
      readonly alt: TextValue<N>;
      readonly style?: ViewStyle;
    }
  | { readonly kind: "resource"; readonly id: string; readonly resource: ResourceView<N> }
  | {
      readonly kind: "action";
      readonly id: string;
      readonly action: ActionView<Intent, N>;
      readonly mark?: MarkView<N>;
      readonly style?: ViewStyle;
    }
  | { readonly kind: "quantities"; readonly id: string; readonly lines: readonly QuantityLine<N>[] }
  | {
      readonly kind: "progress";
      readonly id: string;
      readonly label: TextValue<N>;
      readonly value: number;
      readonly direction: "left" | "right" | "up" | "down";
      readonly animated?: boolean;
      readonly style?: ViewStyle;
    }
  | {
      readonly kind: "infobox";
      readonly id: string;
      readonly title: TextValue<N>;
      readonly content: readonly ViewNode<Intent, N>[];
      readonly initiallyOpen?: boolean;
    }
  | {
      readonly kind: "tabs";
      readonly id: string;
      readonly tabs: readonly TabView<Intent, N>[];
      readonly activeId?: string;
    }
  | {
      readonly kind: "tree";
      readonly id: string;
      readonly nodes: readonly TreeNodeView<Intent, N>[];
      readonly branches: readonly TreeBranchView[];
    }
  | {
      readonly kind: "grid";
      readonly id: string;
      readonly rows: number;
      readonly columns: number;
      readonly cells: readonly GridCellView<Intent, N>[];
    }
  | InputView<Intent, N>
  | {
      readonly kind: "notification";
      readonly id: string;
      readonly text: TextValue<N>;
      readonly tone?: "neutral" | "positive" | "warning" | "danger";
    }
  | CommandFeedbackView<N>
  | {
      readonly kind: "particles";
      readonly id: string;
      readonly particles: readonly ParticleView<Intent, N>[];
    }
  | ResetView<Intent, N>
  | OfflineView<N>
  | SaveView<Intent, N>
  | {
      readonly kind: "custom";
      readonly id: string;
      readonly render: (document: Document) => Node;
      readonly dispose?: () => void;
    };
