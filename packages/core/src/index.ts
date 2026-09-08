export type { AutomationDefinition } from "./automation/scheduler.js";
export { automationCommand } from "./automation/scheduler.js";
export type { AllocationDefinition } from "./economy/allocations.js";
export { allocationCommand } from "./economy/allocations.js";
export type { BuyableDefinition, BuyRequest } from "./economy/buyables.js";
export { buyCommand, sellCommand } from "./economy/buyables.js";
export type { CurveSegment, PurchaseCurve } from "./economy/curves.js";
export { geometricCurve, segmentedCurve } from "./economy/curves.js";
export type { Modifier, ModifierBreakdown, ModifierStep } from "./economy/modifiers.js";
export { applyModifiers } from "./economy/modifiers.js";
export type { RateBuilders } from "./economy/rates.js";
export { evaluateRate } from "./economy/rates.js";
export type { RecipeDefinition, RecipeRequest } from "./economy/recipes.js";
export { recipeCommand } from "./economy/recipes.js";
export type { FlowDefinition, Rate, ReadContext } from "./economy/types.js";
export type { GameDefinition, GameId } from "./model/definition.js";
export { defineGame } from "./model/definition.js";
export type { Resource, Scope } from "./model/handles.js";
export type { GameKit } from "./model/kit.js";
export { createGameKit } from "./model/kit.js";
export type { ContentModule, ModuleRequirement } from "./model/modules.js";
export { resolveModules } from "./model/modules.js";
export type { EternityQuantity } from "./numbers/eternity.js";
export { eternityNumbers } from "./numbers/eternity.js";
export { nativeNumbers } from "./numbers/native.js";
export type { NumericAdapter, NumericCodec } from "./numbers/types.js";
export { NumericFault } from "./numbers/types.js";
export type { ScopeActivationDefinition } from "./progression/activation.js";
export type { ChallengeDefinition } from "./progression/challenges.js";
export {
  challengeCountsAs,
  completeChallengeCommand,
  enterChallengeCommand,
  exitChallengeCommand,
} from "./progression/challenges.js";
export type { ProgressionContext } from "./progression/context.js";
export type { TriggerDefinition, UpgradeDefinition } from "./progression/features.js";
export { upgradeCommand } from "./progression/features.js";
export type { PrestigePolicy } from "./progression/prestige-formulas.js";
export { normalPrestige, staticPrestige } from "./progression/prestige-formulas.js";
export type {
  PrestigeDefinition,
  ResetManifest,
  ResetRetention,
} from "./progression/resets.js";
export { prestigeCommand } from "./progression/resets.js";
export type { RandomState } from "./random/xoshiro.js";
export { deriveRandomState, RandomStreams, Xoshiro128 } from "./random/xoshiro.js";
export type { AdvancePlan, TimeState } from "./simulation/clock.js";
export { planAdvance } from "./simulation/clock.js";
export type { SteppedRuleDefinition } from "./simulation/rules.js";
export { createGame } from "./state/game.js";
export type {
  Command,
  CommandFailure,
  CommandReceipt,
  Game,
  ProgressionSnapshot,
  Result,
  Snapshot,
  Transaction,
} from "./state/types.js";
