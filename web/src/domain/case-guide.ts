import { TOTAL_STOPS, dossierCount, questionedHere, type PublicState, type Screen } from "./model.ts";

export type CaseGuide = { title: string; instruction: string; action?: { label: string; screen: Screen } };

/** Navigation advice from public progress only. Never choose an answer or spend case time. */
export function caseGuide(state: PublicState, screen: Screen, travelling = false): CaseGuide {
  const count = dossierCount(state.dossier);
  const finalStop = state.stage >= TOTAL_STOPS - 1 && state.trail_status === "hot";
  const questioned = new Set(questionedHere(state)).size;
  const heard = questioned > 0;
  // Every stop has three witnesses; only interviews at this stage and location count.
  const allQuestioned = questioned >= 3;
  if (travelling) return { title: "Your journey is underway", instruction: "Wait for arrival. You can read your saved clues while you travel.", action: { label: "Read clues", screen: "notebook" } };
  if (screen === "travel") return { title: "Follow the destination clues", instruction: "Choose the state the witnesses described, then check the fare before travelling." };
  if (screen === "warrant") return state.warrant_suspect
    ? { title: "Find the suspect’s hideout", instruction: "Choose an unsearched location below. Each raid uses case time." }
    : { title: "Match the suspect", instruction: "At the final stop, question the witnesses and complete all eight profile details before applying." };
  if (state.trail_status === "cold") return { title: "You’ve lost the trail", instruction: "Re-read the clues from your last hot stop. Use Travel to choose another destination.", action: screen === "notebook" ? { label: "Choose another destination", screen: "travel" } : { label: "Review clues", screen: "notebook" } };
  if (finalStop && state.warrant_suspect) return { title: "You have a warrant", instruction: "The last step is to search the hideouts for your suspect.", action: { label: "Find the hideout", screen: "warrant" } };
  if (allQuestioned && !finalStop) return {
    title: "All three witnesses questioned",
    instruction: "Record any suspect details you’ve learned, then use the destination clues to choose your next state.",
    action: { label: "Choose next destination", screen: "travel" }
  };
  if (screen === "dossier") return { title: `Build your suspect profile · ${count}/8`, instruction: "Record descriptions from the witnesses. Leave anything you do not know blank.", action: { label: "Read witness clues", screen: "notebook" } };
  if (finalStop && heard) return count === 8
    ? { title: "Ready to compare suspects", instruction: "Compare your profile with the suspect files. If the agency needs another witness, question the remaining leads.", action: { label: "Choose a suspect", screen: "warrant" } }
    : { title: "Complete the suspect profile", instruction: "Use your saved clues to fill all eight details. Question another witness if a detail is missing.", action: { label: "Build the profile", screen: "dossier" } };
  if (screen === "notebook") return { title: "Look for two kinds of clues", instruction: "Place clues tell you where to travel. Descriptions help you build the suspect profile.", action: { label: "Update suspect profile", screen: "dossier" } };
  if (heard) return { title: "Read what the witnesses said", instruction: "Compare their clues before choosing your next state. You can question more people below.", action: { label: "Read clues", screen: "notebook" } };
  return { title: "Question a witness", instruction: "Choose a place below, then choose how to get there. The witness’s account is saved to Clues." };
}
