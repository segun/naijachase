// The player's picture-detail choice (see detail-level.ts), shared by every scene and kept on this device. Reactive: a scene that reads
// `detail.resolved` is told when the choice or a relevant device preference (Data Saver, reduced motion, connection) changes.
import { readDevice, type Device } from "./scene-capability.ts";
import { parseChoice, resolveDetail, sameDetail, type Detail, type DetailChoice } from "./detail-level.ts";
import { reportPerformanceEvent } from "../../telemetry.ts";

const KEY = "nc-detail";
/** The earlier two-way switch: "2d" meant 2D. */
const LEGACY_KEY = "nc-scene";

const stored = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const loadChoice = (): DetailChoice => {
  const saved = stored(KEY);
  if (saved) return parseChoice(saved);
  return stored(LEGACY_KEY) === "2d" ? "simple" : "auto";
};

class DetailState {
  choice = $state<DetailChoice>(loadChoice());
  device = $state<Device>(readDevice());
  #last: Detail | null = null;
  /** Keeps the same object while nothing that matters has changed, so a scene reading it is not rebuilt by a harmless device refresh. */
  resolved = $derived.by(() => {
    const next = resolveDetail(this.choice, this.device);
    return this.#last && sameDetail(this.#last, next) ? this.#last : (this.#last = next);
  });

  set(choice: DetailChoice) {
    this.choice = choice;
    try { localStorage.setItem(KEY, choice); localStorage.removeItem(LEGACY_KEY); } catch { /* private mode: the choice lasts until the page closes */ }
    this.report("player_choice");
  }
  refresh() { this.device = readDevice(); this.report("device_change"); }
  report(trigger: string) {
    const selected = resolveDetail(this.choice, this.device);
    reportPerformanceEvent({ kind: "detail_selection", trigger, choice: selected.choice, level: selected.level, renderer: selected.renderer, models: selected.models, reason: selected.why });
  }
}

export const detail = new DetailState();
if (typeof window !== "undefined") queueMicrotask(() => detail.report("initial"));

// Relevant inputs that can change while the game is running: the connection and motion setting.
if (typeof window !== "undefined") {
  const refresh = () => detail.refresh();
  (navigator as Navigator & { connection?: EventTarget }).connection?.addEventListener("change", refresh);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", refresh);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
}
