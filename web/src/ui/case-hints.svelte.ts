const KEY = "nc-case-hints";
type HintStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): HintStorage | undefined {
  try { return localStorage; } catch { return undefined; }
}

/** Kept outside the terminal so witness returns retain the choice even without storage. */
export class CaseHintPreference {
  visible = $state(true);
  constructor(private storage: HintStorage | undefined = browserStorage()) {
    try { this.visible = storage?.getItem(KEY) !== "hidden"; } catch { /* default to guidance */ }
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    try { this.storage?.setItem(KEY, visible ? "visible" : "hidden"); } catch { /* retain it for this session */ }
  }
}

export const caseHints = new CaseHintPreference();
