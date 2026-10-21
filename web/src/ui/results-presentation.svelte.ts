import { isCaseScreen, type Screen } from "../domain/model.ts";

// Results publishes its readiness only after mounting and a browser paint.
export const resultsPresentation = $state<{ caseId: string | null }>({ caseId: null });

export function markResultsAfterPaint(caseId: string, request = requestAnimationFrame, cancel = cancelAnimationFrame): () => void {
  resultsPresentation.caseId = null;
  let frame = request(() => {
    frame = request(() => { resultsPresentation.caseId = caseId; });
  });
  return () => {
    cancel(frame);
    if (resultsPresentation.caseId === caseId) resultsPresentation.caseId = null;
  };
}

export function canPresentAchievement(screen: Screen, ended: boolean, caseId: string, paintedCaseId: string | null): boolean {
  if (["raid", "journey", "witness", "garage"].includes(screen)) return false;
  if (screen === "results") return paintedCaseId === caseId;
  // Awards can arrive while the completed command is preparing its animation.
  return !(ended && isCaseScreen(screen));
}
