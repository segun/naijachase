import { Api, ApiError } from "../api";
import { MenuMusic } from "./music.svelte.ts";
import {
  FIELDS, RATE_LIMIT_MESSAGE, errorKind, groupNotes, nearestHomeBase, parseNotes,
  type AchievementDef, type CaseArchiveEntry, type CaseResponse, type ClientCommand, type Note,
  type Player, type PlayerSession, type ProfileUpdate, type ProgressionSummary, type Screen
} from "../model.ts";

export type Toast = { id: number; kind: "info" | "error" | "success"; text: string };
export type Settings = { textSize: "normal" | "large"; contrast: "normal" | "high"; motion: "system" | "reduced" };

const DEFAULT_SETTINGS: Settings = { textSize: "normal", contrast: "normal", motion: "system" };
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem("nc-settings") ?? "{}");
    return {
      textSize: raw.textSize === "large" ? "large" : "normal",
      contrast: raw.contrast === "high" ? "high" : "normal",
      motion: raw.motion === "reduced" ? "reduced" : "system"
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export class AppController {
  private api = new Api();
  readonly music = new MenuMusic();
  private toastId = 0;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  screen = $state<Screen>("welcome");
  game = $state<CaseResponse | null>(null);
  player = $state<Player | null>(null);
  booting = $state(true);
  busy = $state(false);
  busyLabel = $state("");
  caseId = $state(sessionStorage.getItem("nc-case") ?? "");
  rankAtStart = $state<string | null>(sessionStorage.getItem("nc-rank"));
  notes = $state<Note[]>(parseNotes(sessionStorage.getItem("nc-notes")));
  trail = $state<string[]>(JSON.parse(sessionStorage.getItem("nc-trail") ?? "[]"));
  toasts = $state<Toast[]>([]);
  announcement = $state("");
  settings = $state<Settings>(readSettings());

  summary = $state<ProgressionSummary | null>(null);
  archive = $state<CaseArchiveEntry[]>([]);
  catalog = $state<AchievementDef[]>([]);
  sessions = $state<PlayerSession[]>([]);

  signedIn = $derived(this.player !== null);
  investigator = $derived(this.player?.display_name || this.player?.username || "");
  groupedNotes = $derived(groupNotes(this.notes));
  playedMissions = $derived(this.archive.map(entry => entry.mission_id));
  promotion = $derived(
    this.rankAtStart && this.summary && this.game?.state.outcome && this.summary.rank !== this.rankAtStart ? this.summary.rank : null
  );

  applySettings() {
    const root = document.documentElement;
    root.dataset.textSize = this.settings.textSize;
    root.dataset.contrast = this.settings.contrast;
    root.dataset.motion = this.settings.motion;
  }
  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    localStorage.setItem("nc-settings", JSON.stringify(this.settings));
    this.applySettings();
  }

  go(next: Screen) {
    this.screen = next;
    queueMicrotask(() => {
      document.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
  }

  toast(text: string, kind: Toast["kind"] = "info") {
    const id = ++this.toastId;
    this.announcement = text;
    this.toasts = [...this.toasts.filter(t => t.kind === "error" && kind !== "error"), { id, kind, text }];
    setTimeout(() => this.dismiss(id), kind === "error" ? 12000 : 6000);
  }
  dismiss(id: number) { this.toasts = this.toasts.filter(t => t.id !== id); }

  /** Maps API failures to the documented client behaviour. Returns the kind so callers can react. */
  private fail(value: unknown) {
    if (!(value instanceof ApiError)) {
      this.toast(value instanceof Error ? value.message : String(value), "error");
      return;
    }
    switch (errorKind(value.status)) {
      case "signed_out":
        // A 401 on an authenticated screen means the session ended; a 401 from login is just a failed attempt.
        if (this.signedIn) { this.endSession("Your session has ended. Please log in again."); return; }
        this.toast(value.message, "error");
        return;
      case "rate_limited": this.toast(RATE_LIMIT_MESSAGE, "error"); return;
      case "conflict":
        this.toast("This case changed in another tab or device. Reloading the latest state.", "error");
        void this.reloadCase();
        return;
      default: this.toast(value.message, "error");
    }
  }

  private endSession(message?: string) {
    clearInterval(this.refreshTimer);
    this.player = null; this.game = null; this.caseId = "";
    this.summary = null; this.archive = []; this.sessions = []; this.notes = []; this.trail = []; this.rankAtStart = null;
    sessionStorage.clear();
    this.screen = "cases";
    if (message) this.toast(message, "info");
  }

  private persist() {
    sessionStorage.setItem("nc-case", this.caseId);
    sessionStorage.setItem("nc-notes", JSON.stringify(this.notes));
    sessionStorage.setItem("nc-trail", JSON.stringify(this.trail));
    if (this.rankAtStart) sessionStorage.setItem("nc-rank", this.rankAtStart);
  }

  private async run<T>(label: string, work: () => Promise<T>): Promise<T | undefined> {
    this.busy = true;
    this.busyLabel = label;
    this.toasts = this.toasts.filter(t => t.kind !== "error");
    try { return await work(); }
    catch (e) { this.fail(e); }
    finally { this.busy = false; this.busyLabel = ""; }
  }

  // ---- Session -----------------------------------------------------------

  private startRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => { this.api.refresh().catch(e => this.fail(e)); }, REFRESH_INTERVAL_MS);
  }

  async boot() {
    this.applySettings();
    const params = new URLSearchParams(location.search);
    const confirmToken = params.get("confirm");
    const reset = params.get("reset");
    try {
      if (confirmToken) {
        const out = await this.api.confirm(confirmToken);
        history.replaceState({}, "", "/");
        this.screen = "cases";
        this.toast(out.message ?? "Email confirmed. You can now log in.", "success");
      } else if (reset) {
        // The auth panel reads the token from the URL; it is removed once the password is changed.
        this.screen = "cases";
      } else {
        this.player = (await this.api.me()).player;
        this.screen = "cases";
        this.startRefresh();
        await Promise.all([this.api.refresh().catch(() => undefined), this.loadProgression()]);
        if (this.caseId) {
          this.game = await this.api.load(this.caseId);
          this.ensureTrail();
          this.screen = "investigate";
        }
      }
    } catch (e) {
      // Confirmation or reset links can fail; a plain 401 just means "not signed in".
      if (confirmToken || reset) { this.screen = "cases"; this.fail(e); }
      else { this.player = null; this.screen = "welcome"; }
    } finally { this.booting = false; }
  }

  async login(email: string, password: string) {
    const out = await this.run("Signing in", () => this.api.login({ email, password }));
    if (!out) return false;
    this.player = out.player;
    this.startRefresh();
    this.toast(`Welcome back, ${this.investigator}.`, "success");
    await this.loadProgression();
    return true;
  }

  async register(form: { email: string; password: string; confirm: string; username: string; homeBase: string }) {
    const out = await this.run("Creating account", () => this.api.register({
      email: form.email, password: form.password, confirm_password: form.confirm,
      username: form.username, home_base: form.homeBase
    }));
    if (out) this.toast(out.message ?? "Account created. Check your email to confirm it.", "success");
    return Boolean(out);
  }

  async requestPasswordReset(email: string) {
    const out = await this.run("Sending recovery link", () => this.api.requestRecovery({ email }));
    return Boolean(out);
  }

  async completePasswordReset(token: string, password: string, confirm: string) {
    const out = await this.run("Resetting password", () => this.api.completeRecovery({ token, password, confirm_password: confirm }));
    if (!out) return false;
    history.replaceState({}, "", "/");
    this.toast(out.message ?? "Password updated. Log in with your new password.", "success");
    return true;
  }

  async logout() {
    await this.run("Signing out", async () => {
      await this.api.logout();
      this.endSession("You have been logged out.");
    });
  }

  async logoutAll() {
    await this.run("Signing out everywhere", async () => {
      await this.api.logoutAll();
      this.endSession("Signed out of every device.");
    });
  }

  locate(): Promise<string | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        p => resolve(nearestHomeBase(p.coords.latitude, p.coords.longitude)),
        () => resolve(null)
      );
    });
  }

  // ---- Profile, devices, progression ------------------------------------

  async saveProfile(update: ProfileUpdate) {
    const out = await this.run("Saving profile", () => this.api.updateProfile(update));
    if (out) { this.player = out.player; this.toast("Profile saved.", "success"); }
    return Boolean(out);
  }

  async loadSessions() {
    const list = await this.run("Loading devices", () => this.api.sessions());
    if (list) this.sessions = list;
  }

  async revokeSession(id: string) {
    const out = await this.run("Revoking device", () => this.api.revokeSession(id));
    if (out) { this.toast("Device signed out.", "success"); await this.loadSessions(); }
  }

  /** Progression is server-derived; the client only displays it. */
  async loadProgression() {
    try {
      const [summary, archive, catalog] = await Promise.all([
        this.api.progression(), this.api.archive(),
        this.catalog.length ? Promise.resolve(this.catalog) : this.api.achievementCatalog()
      ]);
      this.summary = summary; this.archive = archive; this.catalog = catalog;
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  // ---- Cases ---------------------------------------------------------------

  private ensureTrail() {
    if (this.game && this.trail.length === 0) this.trail = [this.game.state.current_state];
  }

  async openCase(mission: string) {
    const id = `web-${crypto.randomUUID()}`;
    const created = await this.run("Opening case file", () => this.api.create(id, mission));
    if (!created) return;
    this.caseId = id; this.game = created;
    this.notes = []; this.trail = [created.state.current_state];
    this.rankAtStart = this.summary?.rank ?? null;
    this.persist();
    this.go("investigate");
  }

  async resume() {
    const loaded = await this.run("Retrieving case file", () => this.api.load(this.caseId));
    if (!loaded) return;
    this.game = loaded;
    this.ensureTrail();
    this.go(loaded.state.outcome ? "results" : "investigate");
  }

  private async reloadCase() {
    if (!this.caseId) return;
    try { this.game = await this.api.load(this.caseId); } catch (e) { this.fail(e); }
  }

  async command(payload: ClientCommand, message: string, label = "Working", quiet = false): Promise<boolean> {
    const current = this.game;
    if (!current) return false;
    const next = await this.run(label, () => this.api.command(current.case_id, current.state_version, payload));
    if (!next) return false;
    this.game = next;
    const account = next.events.find(e => e.event_type === "witness_account")?.data;
    if (account?.message && !next.duplicate) {
      this.notes = [...this.notes, {
        stop: current.state.current_state,
        venue: account.venue_name ?? "Witness",
        message: account.message
      }];
    }
    if (next.state.current_state !== current.state.current_state) {
      this.trail = [...this.trail, next.state.current_state];
    }
    this.persist();
    if (!quiet) this.toast(account?.message ? "Witness account added to your notebook." : message, "success");
    if (next.state.outcome) {
      await this.loadProgression();
      this.go("results");
    }
    return true;
  }

  async saveDossier(changes: Record<string, string>) {
    let saved = 0;
    for (const field of FIELDS) {
      const value = (changes[field] ?? "").trim();
      if (value && value !== this.game?.state.dossier[field]) {
        const ok = await this.command({ type: "record_trait", trait_name: field, value }, "", "Filing dossier", true);
        if (!ok) return false;
        saved++;
      }
    }
    if (saved) this.toast(`${saved} dossier detail${saved === 1 ? "" : "s"} recorded.`, "success");
    return true;
  }

  newDesk() {
    this.game = null; this.caseId = ""; this.notes = []; this.trail = []; this.rankAtStart = null;
    ["nc-case", "nc-notes", "nc-trail", "nc-rank"].forEach(k => sessionStorage.removeItem(k));
    this.go("cases");
  }
}
