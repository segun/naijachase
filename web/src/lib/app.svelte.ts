import { untrack } from "svelte";
import { Api, ApiError } from "../api";
import { MenuMusic } from "./music.svelte.ts";
import { GroupsController } from "./groups.svelte.ts";
import {
  FIELDS, RATE_LIMIT_MESSAGE, errorKind, groupNotes, nearestHomeBase, parseNotes,
  catalogueView, unreadReleases, type ReportCategory, type AchievementDef, type CaseArchiveEntry, type CaseResponse, type CatalogueProgress, type ClientCommand, type Note,
  type AvatarCatalogue, type AvatarPreset, type CooperationPreferences, type CooperationRequest, type Player, type PlayerSession, type ReleaseNotification, type TransportLedgerEntry, type TransportQuote, type ProfileUpdate, type ProgressionSummary, type Screen
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
  readonly api = new Api();
  readonly music = new MenuMusic();
  readonly groups = new GroupsController(this);
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
  /** The player's chosen preset, as the server describes it; null until loaded or chosen. */
  avatar = $state<AvatarPreset | null>(null);
  catalogueStatus = $state<CatalogueProgress | null>(null);
  /** Set when the server reports that every published case is complete; a milestone, not an error. */
  exhausted = $state(false);
  /** Server quotes for every journey the case currently offers. Never calculated in the browser. */
  releases = $state<ReleaseNotification[]>([]);
  coop = $state<{ prefs: CooperationPreferences | null; requests: CooperationRequest[]; blocks: [string, string][]; reputation: number; loaded: boolean }>({ prefs: null, requests: [], blocks: [], reputation: 0, loaded: false });
  quotes = $state<TransportQuote[]>([]);
  quotesLoaded = $state(false);
  ledger = $state<TransportLedgerEntry[]>([]);

  /** A case has just been opened: the desk shows its dossier and the local leads before the investigation screen. */
  briefing = $state(false);
  /** The local lead chosen in the briefing; the investigation opens its travel options so the server still confirms the fare. */
  pendingLead = $state("");

  signedIn = $derived(this.player !== null);
  /** First login: the avatar picker comes before the case desk and nothing else is reachable. */
  needsAvatar = $derived(this.player !== null && !this.player.avatar_setup_complete);
  investigator = $derived(this.player?.display_name || this.player?.username || "");
  groupedNotes = $derived(groupNotes(this.notes));
  catalogue = $derived(this.catalogueStatus ? catalogueView(this.catalogueStatus) : null);
  isReplay = $derived(this.game?.attempt_kind === "replay");
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

  /** The content dashboard is reached only by URL (#/content); no player-facing link points to it. */
  syncRoute() {
    if (location.hash === "#/content" && this.signedIn) this.go("content");
    else if (this.screen === "content" && location.hash !== "#/content") this.go("cases");
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
        // Only a stale state version means the case changed elsewhere; other conflicts carry their own safe message.
        if (value.code === "stale_version") {
          this.toast("This case changed in another tab or device. Reloading the latest state.", "error");
          void this.reloadCase();
        } else this.toast(value.message, "error");
        return;
      default: this.toast(value.message, "error");
    }
  }

  private endSession(message?: string) {
    clearInterval(this.refreshTimer);
    this.player = null; this.game = null; this.caseId = ""; this.briefing = false; this.pendingLead = "";
    this.summary = null; this.archive = []; this.sessions = []; this.avatar = null; this.catalogueStatus = null; this.exhausted = false; this.quotes = []; this.ledger = []; this.notes = []; this.trail = []; this.rankAtStart = null;
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

  /** `handle` may claim an ApiError (return true) so it is not reported as a generic failure. */
  async run<T>(label: string, work: () => Promise<T>, handle?: (e: ApiError) => boolean): Promise<T | undefined> {
    this.busy = true;
    this.busyLabel = label;
    this.toasts = this.toasts.filter(t => t.kind !== "error");
    try { return await work(); }
    catch (e) { if (!(e instanceof ApiError && handle?.(e))) this.fail(e); }
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
        void this.loadAvatar();
        this.screen = "cases";
        this.syncRoute();
        this.startRefresh();
        await this.api.refresh().catch(() => undefined);
        await this.loadProgression();
        if (this.caseId) {
          this.game = await this.api.load(this.caseId);
          this.ensureTrail();
          void this.refreshQuotes();
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
    void this.loadAvatar();
    this.startRefresh();
    this.syncRoute();
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

  /** Quietly loads the chosen preset for display. Transient failures (such as a rate limit) are retried with a back-off, because the room needs it. */
  async loadAvatar() {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!this.player?.avatar_setup_complete || this.avatar) return;
      try { this.avatar = (await this.api.avatarProfile()).selected; return; }
      catch (e) {
        if (e instanceof ApiError && e.status === 401) { this.fail(e); return; }
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }

  /** Always fetched fresh so a catalogue version change is never masked by a stale copy. `handle` claims inline-shown errors. */
  loadAvatarOptions(handle: (e: ApiError) => boolean): Promise<AvatarCatalogue | undefined> {
    return this.run("Loading avatars", () => this.api.avatarOptions(), handle);
  }

  /** Setup only counts as complete when the server says so; the PUT is idempotent, so re-selecting is safe. */
  async chooseAvatar(avatarId: string, handle: (e: ApiError) => boolean): Promise<boolean> {
    const out = await this.run("Saving avatar", () => this.api.selectAvatar(avatarId), handle);
    if (!out) return false;
    if (!out.setup_complete || out.selected_avatar_id !== avatarId || !out.selected) {
      handle(new ApiError(0, "avatar_incomplete", "The server did not confirm your avatar. Please try again."));
      return false;
    }
    this.avatar = out.selected;
    if (this.player) this.player = { ...this.player, avatar_id: out.selected_avatar_id, avatar_setup_complete: true };
    return true;
  }

  async loadSessions() {
    const list = await this.run("Loading devices", () => this.api.sessions());
    if (list) this.sessions = list;
  }

  async revokeSession(id: string) {
    const out = await this.run("Revoking device", () => this.api.revokeSession(id));
    if (out) { this.toast("Device signed out.", "success"); await this.loadSessions(); }
  }

  private progressionLoad: Promise<void> | undefined;

  /** Progression is server-derived; the client only displays it. Concurrent calls (login, boot and the desk) share one load. */
  loadProgression(): Promise<void> {
    return (this.progressionLoad ??= this.fetchProgression().finally(() => { this.progressionLoad = undefined; }));
  }

  private async fetchProgression() {
    try {
      // Read untracked: this runs inside the desk's effect and must not re-trigger itself when the catalogue is stored.
      const known = untrack(() => this.catalog);
      const [summary, archive, catalog, status] = await Promise.all([
        this.api.progression(), this.api.archive(),
        known.length ? Promise.resolve(known) : this.api.achievementCatalog(),
        this.api.catalogueStatus()
      ]);
      this.summary = summary; this.archive = archive; this.catalog = catalog; this.catalogueStatus = status;
      this.exhausted = status.exhausted;
      void this.loadReleases();
      void this.loadCoop();
      void this.groups.load();
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  /** "New case available" notices; they never carry hidden case data. */
  async loadReleases() {
    try { this.releases = unreadReleases(await this.api.releaseNotifications()); }
    catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  async dismissRelease(id: number) {
    this.releases = this.releases.filter(n => n.notification_id !== id);
    try { await this.api.readRelease(id); } catch (e) { void this.loadReleases(); if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  /** Following the notice opens a new case, so every unread notice is considered seen. */
  async followRelease() {
    const seen = [...this.releases];
    await this.openCase();
    if (this.game) for (const n of seen) void this.dismissRelease(n.notification_id);
  }

  // ---- Cooperative investigations -------------------------------------------------------------------------
  // Server state is authoritative, so everything is reloaded after every mutation.

  async loadCoop() {
    try {
      const prefs = await this.api.coopPreferences();
      if (prefs.age_assurance_status !== "adult") { this.coop = { prefs, requests: [], blocks: [], reputation: 0, loaded: true }; return; }
      const [requests, blocks, rep] = await Promise.all([this.api.coopRequests(), this.api.blocks(), this.api.reputation()]);
      this.coop = { prefs, requests, blocks, reputation: rep.reputation, loaded: true };
    } catch (e) { this.coop = { ...this.coop, loaded: true }; if (e instanceof ApiError && e.status === 401) this.fail(e); else if (e instanceof ApiError) this.toast(e.message, "error"); }
  }

  private async coopStep(label: string, work: () => Promise<unknown>, done: string) {
    const ok = await this.run(label, async () => { await work(); return true; });
    await this.loadCoop();
    if (ok) this.toast(done, "success");
    return Boolean(ok);
  }
  setCoopPreferences(enabled: boolean, emailEnabled: boolean) { return this.coopStep("Saving preferences", () => this.api.setCoopPreferences({ enabled, email_enabled: emailEnabled }), "Preferences saved."); }
  askForHelp(venueId: string, helper: string) {
    if (!this.game) return Promise.resolve(false);
    const caseId = this.game.case_id;
    return this.coopStep("Sending request", () => this.api.askForHelp({ command_id: crypto.randomUUID(), case_id: caseId, venue_id: venueId, helper_username: helper.trim() }), "Request sent. They have 12 hours to reply.");
  }
  coopAct(id: string, action: "accept" | "decline" | "acknowledge") {
    const done = { accept: "Request accepted.", decline: "Request declined.", acknowledge: "Thanks sent." }[action];
    const call = { accept: this.api.coopAccept, decline: this.api.coopDecline, acknowledge: this.api.coopAcknowledge }[action];
    return this.coopStep("Updating request", () => call(id), done);
  }
  coopComplete(id: string, recommendation: string) { return this.coopStep("Sending recommendation", () => this.api.coopComplete(id, { recommendation: recommendation.trim() }), "Recommendation sent."); }
  blockPlayer(username: string) { return this.coopStep("Blocking", () => this.api.block(username.trim()), `${username} is blocked. Pending requests between you were cancelled.`); }
  unblockPlayer(id: string) { return this.coopStep("Unblocking", () => this.api.unblock(id), "Player unblocked."); }
  reportPlayer(username: string, category: ReportCategory, details: string) {
    return this.coopStep("Sending report", () => this.api.report({ username, category, details: details.trim() || null }), "Report sent privately. Thank you.");
  }

  // ---- Cases ---------------------------------------------------------------

  private ensureTrail() {
    if (this.game && this.trail.length === 0) this.trail = [this.game.state.current_state];
  }

  private begin(created: CaseResponse) {
    this.caseId = created.case_id; this.game = created;
    this.notes = []; this.trail = [created.state.current_state];
    this.rankAtStart = this.summary?.rank ?? null;
    this.quotes = []; this.quotesLoaded = false; this.ledger = [];
    this.persist();
    void this.refreshQuotes();
    this.briefing = true; this.pendingLead = "";
    this.go("cases");
  }

  /** Leaves the briefing for the investigation, optionally heading straight for the chosen lead. */
  finishBriefing(lead = "") {
    this.briefing = false; this.pendingLead = lead;
    // A chosen lead continues in the garage, where the transport is picked; otherwise straight to the investigation.
    this.go(this.game?.state.outcome ? "results" : lead ? "garage" : "investigate");
  }

  /** Leaving the garage (after travelling, or backing out) for the investigation. */
  leaveGarage() {
    this.pendingLead = "";
    this.go(this.game?.state.outcome ? "results" : "investigate");
  }

  /** Ordinary assignment: the server picks an unseen mission and returns the case id. */
  async openCase() {
    const created = await this.run("Opening case file", () => this.api.assign(), e => {
      if (e.code === "catalogue_exhausted") { this.exhausted = true; void this.loadProgression(); return true; }
      if (e.code === "mission_already_completed") { void this.loadProgression(); this.toast(e.message, "info"); return true; }
      return false;
    });
    if (created) this.begin(created);
  }

  /** Explicit replay of a solved mission. The server suppresses points, achievements and completion credit. */
  async replayCase(missionId: string) {
    const created = await this.run("Opening replay", () => this.api.replay(missionId), e => {
      if (e.code === "replay_not_available") {
        void this.loadProgression();
        this.toast("That case can't be replayed yet. Solve it first.", "error");
        return true;
      }
      return false;
    });
    if (created) { this.toast("Replay started. Replays award no points or achievements.", "info"); this.begin(created); }
  }

  async resume() {
    const loaded = await this.run("Retrieving case file", () => this.api.load(this.caseId));
    if (!loaded) return;
    this.game = loaded;
    this.ensureTrail();
    this.briefing = false; this.pendingLead = "";
    this.quotes = []; this.quotesLoaded = false; this.ledger = [];
    void this.refreshQuotes();
    this.go(loaded.state.outcome ? "results" : "investigate");
  }

  private async reloadCase() {
    if (!this.caseId) return;
    try { this.game = await this.api.load(this.caseId); void this.refreshQuotes(); } catch (e) { this.fail(e); }
  }

  /** Quotes depend on case state, venues and balance, so they are refreshed after every state change. */
  async refreshQuotes() {
    const id = this.caseId;
    if (!id || !this.game || this.game.state.outcome) { this.quotes = []; this.quotesLoaded = true; return; }
    try {
      const quotes = await this.api.quotes(id);
      if (id === this.caseId) this.quotes = quotes;
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); else this.quotes = []; }
    finally { this.quotesLoaded = true; }
  }

  async refreshLedger() {
    if (!this.caseId) return;
    try { this.ledger = await this.api.ledger(this.caseId); } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
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
    if (!next.state.outcome && payload.type !== "record_trait") void this.refreshQuotes();
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
