import type { CalendarDefinition, CalendarState } from "../calendar/types.js";
import type { MarketState } from "../markets/types.js";
import type { GameDefinition } from "../model/definition.js";
import type { Resource, Scope } from "../model/handles.js";
import type { ResetManifest } from "../progression/resets.js";
import type { RandomStreamsSnapshot, Xoshiro128 } from "../random/xoshiro.js";
import type { TaskState } from "../tasks/types.js";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CommandFailure<N = never> =
  | { readonly code: "stale-revision"; readonly expected: bigint; readonly current: bigint }
  | { readonly code: "invalid-target"; readonly id: string }
  | { readonly code: "numeric-fault"; readonly message: string }
  | { readonly code: "transaction-failed"; readonly message: string }
  | {
      readonly code: "insufficient";
      readonly resourceId: string;
      readonly required: N;
      readonly available: N;
    }
  | {
      readonly code: "capacity-blocked";
      readonly resourceId: string;
      readonly attempted: N;
      readonly capacity: N;
    }
  | { readonly code: "invalid-count"; readonly requested: N | number }
  | { readonly code: "locked"; readonly prerequisiteIds: readonly string[] }
  | { readonly code: "disabled"; readonly actionId: string; readonly reasonKey: string }
  | { readonly code: "budget-exceeded"; readonly budgetId: string }
  | {
      readonly code: "allocation-exceeded";
      readonly allocationId: string;
      readonly assigned: N;
      readonly budget: N;
    };

export interface Snapshot<N> {
  readonly revision: bigint;
  readonly gameTimeMs: number;
  readonly remainderMs: number;
  readonly resources: Readonly<Record<string, N>>;
  readonly purchaseCounts: Readonly<Record<string, N>>;
  readonly allocations: Readonly<Record<string, Readonly<Record<string, N>>>>;
  readonly productionTotals: Readonly<Record<string, N>>;
  readonly scopeGenerations: Readonly<Record<string, bigint>>;
  readonly progression: ProgressionSnapshot<N>;
  readonly random: RandomStreamsSnapshot;
  readonly tasks: Readonly<Record<string, TaskState<N>>>;
  readonly calendars: Readonly<Record<string, CalendarState>>;
  readonly markets: Readonly<Record<string, MarketState<N>>>;
}

export interface AutomationState {
  readonly enabled: boolean;
  readonly nextRunMs: number;
}

export interface ProgressionSnapshot<N> {
  readonly upgrades: Readonly<Record<string, true>>;
  readonly milestones: Readonly<Record<string, true>>;
  readonly achievements: Readonly<Record<string, true>>;
  readonly activeChallenges: readonly string[];
  readonly challengeCompletions: Readonly<Record<string, N>>;
  readonly rewardLedger: readonly string[];
  readonly automation: Readonly<Record<string, AutomationState>>;
  readonly won: boolean;
  readonly events: readonly ProgressionEvent[];
}

export interface ProgressionEvent {
  readonly sequence: bigint;
  readonly kind: "upgrade" | "milestone" | "achievement" | "challenge-reward" | "win";
  readonly id: string;
  readonly atGameMs: number;
}

export type ProgressionFlagKind = "upgrade" | "milestone" | "achievement";

export interface Transaction<N> {
  readonly numbers: NonNullable<GameDefinition<N>["numbers"]>;
  gameTimeMs(): number;
  random(path: readonly string[]): Xoshiro128;
  isScopeActive(scope: Scope): boolean;
  get(resource: Resource<N>): N;
  set(resource: Resource<N>, value: N): void;
  add(resource: Resource<N>, amount: N): void;
  getPurchase(id: string): N;
  setPurchase(id: string, value: N): void;
  getAllocation(id: string, targetId: string): N;
  setAllocation(id: string, targetId: string, value: N): void;
  addProduction(id: string, executions: N): void;
  reset(manifest: ResetManifest<N>): void;
  hasProgress(kind: ProgressionFlagKind, id: string): boolean;
  setProgress(kind: ProgressionFlagKind, id: string): void;
  hasActiveChallenges(): boolean;
  isChallengeActive(id: string): boolean;
  setChallengeActive(id: string, active: boolean): void;
  getChallengeCompletions(id: string): N;
  setChallengeCompletions(id: string, value: N): void;
  hasReward(id: string): boolean;
  addReward(id: string): void;
  getAutomation(id: string): AutomationState | undefined;
  setAutomation(id: string, state: AutomationState): void;
  setWon(value: boolean): void;
  getTaskState(id: string): TaskState<N>;
  setTaskState(id: string, state: TaskState<N>): void;
  getCalendarState(calendar: CalendarDefinition): CalendarState;
  setCalendarState(calendar: CalendarDefinition, state: CalendarState): void;
  getMarketState(id: string): MarketState<N>;
  setMarketState(id: string, state: MarketState<N>): void;
  reject(error: CommandFailure<N>): never;
}

export interface Command<N> {
  readonly id: string;
  readonly expectedRevision?: bigint;
  readonly expectedScopeGenerations?: Readonly<Record<string, bigint>>;
  execute(transaction: Transaction<N>): void;
}

export interface CommandReceipt {
  readonly commandId: string;
  readonly revision: bigint;
}

export interface Game<N> {
  getDefinition(): GameDefinition<N>;
  getSnapshot(): Snapshot<N>;
  dispatch(command: Command<N>): Result<CommandReceipt, CommandFailure<N>>;
  advance(
    elapsedMs: number,
    step?: (transaction: Transaction<N>, stepSeconds: number) => void,
  ): Result<Snapshot<N>, CommandFailure<N>>;
  advanceCustom(
    elapsedMs: number,
    apply: (transaction: Transaction<N>, advancedGameMs: number) => void,
  ): Result<Snapshot<N>, CommandFailure<N>>;
  subscribe<T>(
    selector: (snapshot: Snapshot<N>) => T,
    listener: (value: T) => void,
    equal?: (left: T, right: T) => boolean,
  ): () => void;
}
