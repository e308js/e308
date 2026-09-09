import type { Snapshot } from "@e308/core";
import { hearthResearch, hearthTasks } from "./content.js";
import type { HearthRecipe, HearthTask } from "./runtime.js";

export function hearthGoal(snapshot: Snapshot<number>): string {
  const nextResearch = hearthResearch.find((entry) => !snapshot.progression.upgrades[entry.id]);
  const hall = snapshot.tasks[hearthTasks.hall.id];
  if (snapshot.progression.won) return "Settlement complete: the great hall is open.";
  if (!snapshot.progression.achievements["year-complete"])
    return "Goal: guide the settlement through its first winter.";
  if (nextResearch)
    return `Goal: develop ${nextResearch.id.replaceAll("-", " ")}. Assign scholars to produce science.`;
  if (hall?.active) return "Goal: finish raising the great hall.";
  return "Goal: craft the supplies for the great hall, then begin the project.";
}

export function recipeDescription(recipe: HearthRecipe): string {
  return {
    meal: "Meals supply expeditions, festivals, and the great hall.",
    tool: "Every stored tool raises all worker production by 8%.",
    cloth: "Cloth supplies festivals and the great hall.",
    medicine: "Each medicine restores morale 0.03 faster per second while food remains.",
    preserves: "Each preserve cuts winter food use by 8%, to a 45% maximum reduction.",
    festival: "A festival restores 25 morale and fulfills a settlement milestone.",
    cottage: "A cottage adds one worker who also consumes food every season.",
  }[recipe];
}

export function researchDescription(id: string): string {
  return (
    {
      storehouses: "Adds 40 food, 30 wood, and 30 stone storage.",
      "crop-rotation": "Raises farm production by 50% in every season.",
      "stone-granaries": "Adds another full storage expansion.",
      "civic-charter": "Welcomes one worker to the settlement.",
    }[id] ?? "Settlement research"
  );
}

export function taskDescription(task: HearthTask): string {
  return task === "expedition"
    ? "A one-minute journey that returns with 8 herbs and 12 science."
    : "A two-minute construction project that completes the settlement.";
}
