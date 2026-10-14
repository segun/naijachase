import { untrack } from "svelte";
import { Api, ApiError } from "../api/api";
import { birthDateError } from "../domain/birth-date.mjs";
import { journeyModeOf } from "../scenes/journey/journey-scene.ts";
import { MenuMusic } from "../music/music.svelte.ts";
import { GroupsController } from "./groups.svelte.ts";
import type { CurrentActivityResponse } from "../../../contracts/typescript/api-v1.ts";
import { alreadyPressured, parseUtc, tokenAwards, type DisciplinaryCase, type JailStatus, type PressureAttemptRecord, type PressureMethod, type PressureResult, type TokenAward, type TokenLedgerEntry } from "../domain/pressure.ts";
import {
  dossierChanges, RATE_LIMIT_MESSAGE, errorKind, groupNotes, nearestHomeBase, parseNotes,
  catalogueView, isTransitReply, resumableCase, STATES, unreadReleases, type WeeklyAttempt, type ReportCategory, type AchievementDef, type CaseArchiveEntry, type CaseResponse, type CatalogueProgress, type ClientCommand, type GameEvent, type Note,
  type AvatarCatalogue, type AvatarPreset, type DossierOptions, type CooperationPreferences, type CooperationRequest, type Player, type PlayerSession, type ReleaseNotification, type TransportLedgerEntry, type TransportQuote, type ProfileUpdate, type ProgressionSummary, type Screen,
  raidQuote, type QuoteGroup
} from "../domain/model.ts";

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type Toast = { id: number; kind: "info" | "error" | "success"; text: string };
/** The witness just questioned, for the arrival scene that follows the journey to the venue. */
export type WitnessVisit = { venueId: string; venueName: string; role: string; message: string; arrival: "drive" | "hitch" };
/** A journey between states about to be played: where from and to, how, and the seed that fixes which landscapes it passes through. */
export type JourneyVisit = { from: string; to: string; mode: "drive" | "hitch" | "fly"; seed: number; loop?: boolean; label?: string };
/**
 * A hideout raid being played: the short chase in which the suspect either outruns the officers or is caught.
 * `finale` replaces the last caption when the case ended some other way (a wrong warrant, or the deadline).
 */
export type RaidVisit = { venueId: string; label: string; suspect: string; state: string; ending: "escape" | "catch"; finale?: string; seed: number };
/** Where a weekly attempt is travelling, as the server told us: the journey really takes this long and animations never shorten it. */
export type WeeklyTransit = { destination: string; mode: string; arrivesAt: number; seconds: number };
/** A disciplinary panel the player has yet to see: the server's own result, played back and then acknowledged. */
export type PanelVisit = { result: PressureResult | null; panel: DisciplinaryCase; venue: string | null };
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
  private dossierLoad: Promise<void> | undefined;
  private sessionGeneration = 0;
  private caseGeneration = 0;

  screen = $state<Screen>("welcome");
  game = $state<CaseResponse | null>(null);
  ordinaryCaseId = $state<string | null>(null);
  activityKnown = $state(false);
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
  dossierOptions = $state<DossierOptions | null>(null);
  dossierOptionsLoading = $state(false);
  dossierOptionsError = $state("");
  catalogueStatus = $state<CatalogueProgress | null>(null);
  /** Set when the server reports that every published case is complete; a milestone, not an error. */
  exhausted = $state(false);
  /** Server quotes for every journey the case currently offers. Never calculated in the browser. */
  releases = $state<ReleaseNotification[]>([]);
  coop = $state<{ prefs: CooperationPreferences | null; requests: CooperationRequest[]; blocks: [string, string][]; reputation: number; loaded: boolean }>({ prefs: null, requests: [], blocks: [], reputation: 0, loaded: false });
  /** Earned bribe tokens, the server's balance and history; null until loaded. */
  tokenBalance = $state<number | null>(null);
  tokenLedger = $state<TokenLedgerEntry[]>([]);
  tokenLedgerLoaded = $state(false);
  /** Token awards the server reported when the current case was solved. */
  awards = $state<TokenAward[]>([]);
  jail = $state<JailStatus | null>(null);
  discipline = $state<DisciplinaryCase[]>([]);
  disciplineLoaded = $state(false);
  /** The panel to present now, and the witnesses already pressured (`case|stop|venue`), so each shows one attempt only. */
  panel = $state<PanelVisit | null>(null);
  /** What a pressure attempt without a panel produced: the extra clue, or nothing. */
  pressureNotice = $state<{ clue: string | null; venue: string } | null>(null);
  private pendingPressure = new Map<string, { id: string; version: number }>();
  pressured = $state<string[]>([]);
  quotes = $state<TransportQuote[]>([]);
  quotesLoaded = $state(false);
  ledger = $state<TransportLedgerEntry[]>([]);

  /** A case has just been opened: the desk shows its dossier and the local leads before the investigation screen. */
  briefing = $state(false);
  /** The local lead chosen in the briefing; the investigation opens its travel options so the server still confirms the fare. */
  pendingLead = $state("");
  /** Set by a successful visit_venue command; the garage hands it to the witness scene. */
  lastWitness = $state<Omit<WitnessVisit, "arrival"> | null>(null);
  /** The witness scene being played; null when none is. */
  witnessVisit = $state<WitnessVisit | null>(null);
  /** The travelling scene being played between two states; null when none is. */
  journey = $state<JourneyVisit | null>(null);
  /** The hideout raid being played; null when none is. */
  raidVisit = $state<RaidVisit | null>(null);
  /** The raid the server is answering: its scene plays once the result (or, weekly, the arrival) is in. */
  private pendingRaid: Omit<RaidVisit, "ending" | "finale"> | null = null;
  /** Set when the player has just come back from a venue: the office plays a short return (seated, then the zoom) instead of the long walk-in. */
  returning = $state(false);

  /** Weekly challenge desk: while set, the case desk plays this attempt instead of the ordinary case. */
  weeklyId = $state<string | null>(null);
  weeklyTransit = $state<WeeklyTransit | null>(null);
  weeklyEnds = $state(0);
  /** When the weekly state was fetched: its case clock is the real clock, so the desk adds the minutes that have passed since. */
  weeklyFetchedAt = $state(0);
  private weeklyTimer: ReturnType<typeof setTimeout> | undefined;
  private weeklyAccounts: GameEvent[] = [];
  private weeklyLabels = new Map<string, string>();
  isWeekly = $derived(this.weeklyId !== null);
  signedIn = $derived(this.player !== null);
  /** First login: the avatar picker comes before the case desk and nothing else is reachable. */
  needsAvatar = $derived(this.player !== null && !this.player.avatar_setup_complete);
  investigator = $derived(this.player?.display_name || this.player?.username || "");
  groupedNotes = $derived(groupNotes(this.notes));
  catalogue = $derived(this.catalogueStatus ? catalogueView(this.catalogueStatus) : null);
  isReplay = $derived(this.game?.attempt_kind === "replay");
  /** The UTC end of an active suspension, or null. The server still enforces it; this only avoids offering a doomed start. */
  get jailedUntil(): string | null {
    const jail = this.jail;
    return jail?.jailed && jail.jailed_until && parseUtc(jail.jailed_until).getTime() > Date.now() ? jail.jailed_until : null;
  }
  get canStartCase() { return this.activityKnown && this.ordinaryCaseId === null && this.jailedUntil === null; }
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

  /** Screens that belong to the weekly desk; any other screen leaves it and brings the ordinary case back. */
  private static readonly WEEKLY_SCREENS: readonly Screen[] = ["investigate", "notebook", "dossier", "travel", "warrant", "results", "garage", "witness", "journey", "raid"];

  go(next: Screen) {
    if (this.weeklyId && !AppController.WEEKLY_SCREENS.includes(next) && !(next === "cases" && this.briefing)) this.leaveWeekly();
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
    this.sessionGeneration++;
    this.caseGeneration++;
    this.ordinaryCaseId = null; this.activityKnown = false;
    this.dossierLoad = undefined;
    this.dossierOptions = null; this.dossierOptionsLoading = false; this.dossierOptionsError = "";
    this.weeklyId = null; this.weeklyTransit = null; clearTimeout(this.weeklyTimer); this.weeklyAccounts = [];
    this.player = null; this.game = null; this.caseId = ""; this.briefing = false; this.pendingLead = ""; this.lastWitness = null; this.witnessVisit = null; this.journey = null; this.raidVisit = null; this.pendingRaid = null; this.returning = false;
    this.summary = null; this.archive = []; this.sessions = []; this.avatar = null; this.catalogueStatus = null; this.exhausted = false; this.quotes = []; this.ledger = []; this.notes = []; this.trail = []; this.rankAtStart = null;
    this.tokenBalance = null; this.tokenLedger = []; this.tokenLedgerLoaded = false; this.awards = []; this.jail = null; this.discipline = []; this.disciplineLoaded = false; this.panel = null; this.pressured = []; this.pressureNotice = null; this.pendingPressure.clear();
    sessionStorage.clear();
    this.screen = "cases";
    if (message) this.toast(message, "info");
  }

  private persist() {
    if (this.weeklyId) return;
    sessionStorage.setItem("nc-case", this.caseId);
    sessionStorage.setItem("nc-notes", JSON.stringify(this.notes));
    sessionStorage.setItem("nc-trail", JSON.stringify(this.trail));
    if (this.rankAtStart) sessionStorage.setItem("nc-rank", this.rankAtStart);
  }

  /** `handle` may claim an ApiError (return true) so it is not reported as a generic failure. */
  async run<T>(label: string, work: () => Promise<T>, handle?: (e: ApiError) => boolean): Promise<T | undefined> {
    if (this.busy) return;
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
        void this.loadDossierOptions();
        void this.loadAvatar();
        this.screen = "cases";
        this.syncRoute();
        this.startRefresh();
        await this.api.refresh().catch(() => undefined);
        await this.loadProgression();
        // A reload of a tab that had the case open goes straight back in; a case found only on the server waits on the desk.
        const restored = this.caseId;
        await this.syncCurrentCase();
        if (this.caseId && this.caseId === restored) {
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
    void this.loadDossierOptions();
    void this.loadAvatar();
    this.startRefresh();
    this.syncRoute();
    this.toast(`Welcome back, ${this.investigator}.`, "success");
    await this.loadProgression();
    await this.syncCurrentCase();
    return true;
  }

  /**
   * Asks the server (`GET /v1/activity/current`) for the unfinished case, so a fresh sign-in or another device offers
   * "Resume case" rather than "Start new case". Browser storage is only a hint; an HTTP error never means "no case".
   */
  private async syncCurrentCase() {
    const generation = this.sessionGeneration;
    const caseGeneration = this.caseGeneration;
    let activity;
    try { activity = await this.api.currentActivity(); }
    catch (e) {
      if (generation === this.sessionGeneration && caseGeneration === this.caseGeneration) {
        this.activityKnown = false; this.fail(e);
      }
      return false;
    }
    if (generation !== this.sessionGeneration || caseGeneration !== this.caseGeneration) return false;
    this.applyActivity(activity);
    return true;
  }

  private applyActivity(activity: CurrentActivityResponse) {
    let found = resumableCase(activity, this.caseId);
    if (found && this.game?.case_id === found.case_id && this.game.state_version > found.state_version) found = this.game;
    if (found?.case_id !== this.caseId) this.clearCase();
    this.ordinaryCaseId = activity.ordinary_case?.case_id ?? null;
    this.activityKnown = true;
    this.game = found; this.caseId = found?.case_id ?? "";
    this.ensureTrail();
    if (found) this.persist();
  }

  async refreshCaseDesk() {
    await this.run("Refreshing case status", () => this.syncCurrentCase());
  }

  async register(form: { email: string; password: string; confirm: string; username: string; homeBase: string; dobDay: number; dobMonth: number; dobYear: number }) {
    const error = birthDateError(form.dobDay, form.dobMonth, form.dobYear);
    if (error) { this.toast(error, "error"); return false; }
    const out = await this.run("Creating account", () => this.api.register({
      email: form.email, password: form.password, confirm_password: form.confirm,
      username: form.username, home_base: form.homeBase,
      dob_day: form.dobDay, dob_month: form.dobMonth, dob_year: form.dobYear
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

  loadDossierOptions(): Promise<void> {
    if (this.dossierOptions) return Promise.resolve();
    return (this.dossierLoad ??= this.fetchDossierOptions());
  }

  private async fetchDossierOptions() {
    const generation = this.sessionGeneration;
    this.dossierOptionsLoading = true;
    this.dossierOptionsError = "";
    try {
      const options = await this.api.dossierOptions();
      if (generation === this.sessionGeneration) this.dossierOptions = options;
    } catch (e) {
      if (generation === this.sessionGeneration) {
        this.dossierOptionsError = e instanceof Error ? e.message : String(e);
        this.fail(e);
      }
    } finally {
      if (generation === this.sessionGeneration) {
        this.dossierOptionsLoading = false;
        this.dossierLoad = undefined;
      }
    }
  }

  selectedDossierChanges(values: Record<string, string>, recorded: Record<string, string>) {
    try { return dossierChanges(this.dossierOptions, values, recorded); }
    catch (e) { this.fail(e); return null; }
  }

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

  private async fetchProgression(reportErrors = false) {
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
      void this.loadTokens();
      void this.loadCoop();
      void this.groups.load();
    } catch (e) { if (reportErrors || (e instanceof ApiError && e.status === 401)) this.fail(e); }
  }

  /** The server's earned-token balance and jail status. Never calculated in the browser. */
  async loadTokens() {
    const generation = this.sessionGeneration;
    const [balance, jail, record] = await Promise.allSettled([this.api.tokenBalance(), this.api.jail(), this.api.discipline()]);
    if (generation !== this.sessionGeneration) return;
    if (balance.status === "fulfilled") this.tokenBalance = balance.value.balance;
    if (jail.status === "fulfilled") this.jail = jail.value;
    if (record.status === "fulfilled") {
      this.discipline = record.value; this.disciplineLoaded = true;
      // A verdict the player has not yet seen comes before anything else.
      const unseen = record.value.find(c => !c.acknowledged);
      if (unseen && !this.panel) this.panel = { result: null, panel: unseen, venue: null };
    }
    const failure = [balance, jail, record].find(r => r.status === "rejected" && r.reason instanceof ApiError && r.reason.status === 401);
    if (failure) this.fail((failure as PromiseRejectedResult).reason);
  }

  /** Token history and the private panel history, for the career file in Settings. */
  async loadTokenHistory() {
    const generation = this.sessionGeneration;
    const [ledger, discipline] = await Promise.all([this.api.tokenLedger(), this.api.discipline()]).catch(e => { this.fail(e); return [null, null] as const; });
    if (generation !== this.sessionGeneration) return;
    if (ledger) { this.tokenLedger = ledger; this.tokenLedgerLoaded = true; }
    if (discipline) { this.discipline = discipline; this.disciplineLoaded = true; }
    void this.loadTokens();
  }

  pressureKey(venueId: string) { return `${this.caseId}|${this.game?.state.stage ?? 0}|${venueId}`; }
  wasPressured(venueId: string) { return this.pressured.includes(this.pressureKey(venueId)); }
  private markPressured(key: string) {
    if (!this.pressured.includes(key)) this.pressured = [...this.pressured, key];
  }

  /** The server remembers every attempt, so a reload or another device still shows which witnesses are spent. */
  async loadPressure() {
    const id = this.caseId, generation = this.caseGeneration;
    if (!id || this.weeklyId) return;
    try {
      const attempts: PressureAttemptRecord[] = await this.api.pressureAttempts(id);
      if (id !== this.caseId || generation !== this.caseGeneration) return;
      this.pressured = attempts.map(a => `${id}|${a.stage}|${a.venue_id}`);
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  /** Bribe or intimidate a questioned witness. The server decides the clue, detection, votes and punishment. */
  async pressureWitness(venueId: string, venueLabel: string, method: PressureMethod): Promise<PressureResult | undefined> {
    const current = this.game;
    if (!current || current.state.outcome !== null || this.busy) return;
    const generation = this.caseGeneration;
    const key = this.pressureKey(venueId), stop = current.state.current_state;
    // An attempt whose outcome is unknown is retried with the same command id, so it can never spend or roll twice.
    const attempt = `${key}|${method}`;
    const pending = this.pendingPressure.get(attempt) ?? { id: crypto.randomUUID(), version: current.state_version };
    this.pendingPressure.set(attempt, pending);
    const result = await this.run("Pressing the witness", () => this.api.pressure(current.case_id, {
      command_id: pending.id, expected_version: pending.version, venue_id: venueId, method
    }), e => {
      if (e.status !== 0) this.pendingPressure.delete(attempt);
      if (!alreadyPressured(e.status, e.code, e.message)) return false;
      this.markPressured(key);
      this.toast("This witness has already been pressured. Each witness accepts one attempt.", "info");
      return true;
    });
    if (!result || this.caseId !== current.case_id || generation !== this.caseGeneration) return;
    this.pendingPressure.delete(attempt);
    this.markPressured(key);
    this.tokenBalance = result.token_balance;
    if (result.extra_clue) {
      this.notes = [...this.notes, { stop, venue: `${venueLabel} (extra)`, message: result.extra_clue }];
      this.persist();
    }
    await this.reloadCase();
    if (result.panel) this.panel = { result, panel: result.panel, venue: venueLabel };
    else this.pressureNotice = { clue: result.extra_clue, venue: venueLabel };
    void this.loadProgression();
    return result;
  }

  /** The player has seen the panel. Acknowledging is best effort: the outcome stands either way. */
  async dismissPanel() {
    const visit = this.panel;
    if (!visit) return;
    this.panel = null;
    if (!visit.panel.acknowledged) {
      try { await this.api.acknowledgeDiscipline(visit.panel.disciplinary_case_id); }
      catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
    }
    await Promise.all([this.loadProgression(), this.loadTokens(), this.loadTokenHistory()]);
    if (this.caseId) await this.reloadCase();
    // A jailed player's case was forfeited: back to the desk, where starting a case stays disabled until release.
    if (visit.panel.punishment === "jailed" || this.game?.state.outcome === "forfeited") this.newDesk();
    else if (this.game?.state.outcome) this.go("results");
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
    this.clearCase();
    this.caseId = created.case_id; this.game = created;
    this.notes = []; this.trail = [created.state.current_state];
    this.rankAtStart = this.summary?.rank ?? null;
    this.quotes = []; this.quotesLoaded = false; this.ledger = [];
    if (created.attempt_kind === "ordinary") this.ordinaryCaseId = created.case_id;
    this.activityKnown = true;
    this.persist();
    void this.refreshQuotes();
    this.briefing = true; this.pendingLead = "";
    this.go("cases");
  }

  /** Leaves the briefing for the investigation, optionally heading straight for the chosen lead. The case terminal uses it too: choosing a lead there also walks out to the garage. */
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

  /** After the journey to a venue: the witness scene if that venue has one, otherwise straight to the investigation. */
  async arriveAtWitness(arrival: "drive" | "hitch") {
    // A weekly visit is a real journey: the scene keeps playing until the server says the player has arrived.
    if (this.weeklyTransit) { this.watchWeeklyTransit(arrival === "hitch" ? "hitch_ride" : "drive"); return; }
    const witness = this.lastWitness;
    this.lastWitness = null;
    // The recipes are loaded on demand, so they never weigh on the first download however many venues have a scene.
    const recipes = witness ? await import("../scenes/witness/venue-recipes.ts").catch(() => null) : null;
    if (witness && recipes?.recipeFor(witness.venueId) && !this.game?.state.outcome) {
      this.pendingLead = "";
      this.witnessVisit = { ...witness, arrival };
      this.go("witness");
    } else {
      this.leaveGarage();
    }
  }

  /** Plays the travelling scene for a journey the server has just accepted, then goes to the desk. */
  startJourney(from: string, to: string, transport: string) {
    if (this.weeklyTransit) { this.watchWeeklyTransit(transport); return; }
    const mode = journeyModeOf(transport);
    if (!mode || from === to) { this.finishJourney(); return; }
    this.journey = { from, to, mode, seed: Math.floor(Math.random() * 2147483000) };
    this.go("journey");
  }

  /** The travelling scene is over (or was skipped): on to the desk, which plays the short return. */
  leaveJourney() {
    // Escape during a weekly journey goes back to the weekly desk, where the journey keeps counting down.
    if (this.weeklyTransit) { this.journey = null; this.go("investigate"); return; }
    this.journey = null;
    this.finishJourney();
  }
  private finishJourney() {
    this.pendingLead = "";
    this.returning = !this.game?.state.outcome;
    this.go(this.game?.state.outcome ? "results" : "investigate");
  }

  /** The witness scene is over (or was skipped): on to the investigation, where the account is in the notebook. */
  leaveWitness() {
    this.witnessVisit = null;
    // The short office return is for a case that goes on; a finished case goes to its results instead.
    this.returning = !this.game?.state.outcome;
    this.go(this.game?.state.outcome ? "results" : "investigate");
  }

  /** Raids a hideout with the fastest transport the player can afford; the chase scene follows once the server has answered. */
  async raid(group: QuoteGroup): Promise<boolean> {
    const gs = this.game?.state, quote = raidQuote(group.options);
    if (!gs || !quote || this.busy) return false;
    const suspect = gs.suspect_files.find(s => s.suspect_id === gs.warrant_suspect)?.name ?? "the suspect";
    // The case varies the captions from one case to the next; the count keeps a second raid in the same case from repeating the first.
    const caseSeed = [...this.caseId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
    this.pendingRaid = { venueId: group.id, label: group.label, suspect, state: gs.current_state, seed: caseSeed + (gs.searched_hideouts?.length ?? 0) };
    const mode = quote.mode as "drive" | "hitch_ride";
    const ok = await this.command({ type: "search_hideout", venue_id: group.id, mode }, "", "Raiding hideout", true);
    if (!ok) { this.pendingRaid = null; return false; }
    // A weekly raid is a real journey: watch it, and the chase plays on arrival.
    if (this.weeklyTransit) this.watchWeeklyTransit(mode);
    return true;
  }

  /** Starts the scene for the raid the server has just settled. False if there was none to play. */
  private playRaid(): boolean {
    const raid = this.pendingRaid, gs = this.game?.state;
    this.pendingRaid = null;
    if (!raid || !gs) return false;
    const outcome = gs.outcome;
    const finale = outcome === "escaped" ? `The thief got away. Your warrant named ${raid.suspect}: the wrong person.`
      : outcome === "deadline" ? "Time has run out. The thief got away."
      : outcome && outcome !== "solved" ? "The thief got away."
      : undefined;
    this.raidVisit = { ...raid, ending: outcome === "solved" ? "catch" : "escape", ...(finale ? { finale } : {}) };
    this.go("raid");
    return true;
  }

  /** The raid scene is over (or was skipped): the results if the case has ended, otherwise back to the remaining hideouts. */
  leaveRaid() {
    const raid = this.raidVisit;
    this.raidVisit = null;
    if (this.game?.state.outcome) { this.go("results"); return; }
    // Straight back to the remaining hideouts, with the short office return rather than the walk-in.
    this.returning = true;
    this.go("warrant");
    if (raid) this.toast(`${sentence(raid.suspect)} got away from the ${raid.label.toLowerCase()}. Try another hideout.`, "info");
  }

  /** Ordinary assignment: the server picks an unseen mission and returns the case id. */
  async openCase() {
    if (this.busy) return;
    const session = this.sessionGeneration, generation = this.caseGeneration;
    this.activityKnown = false;
    const created = await this.run("Opening case file", async () => {
      const activity = await this.api.currentActivity();
      if (session !== this.sessionGeneration || generation !== this.caseGeneration) return;
      this.ordinaryCaseId = activity.ordinary_case?.case_id ?? null;
      this.activityKnown = true;
      if (activity.ordinary_case) return { ...activity.ordinary_case, duplicate: true };
      return this.api.assign();
    }, e => {
      if (e.code === "catalogue_exhausted") { this.exhausted = true; void this.loadProgression(); return true; }
      if (e.code === "mission_already_completed") { void this.loadProgression(); this.toast(e.message, "info"); return true; }
      return false;
    });
    if (!created || session !== this.sessionGeneration || generation !== this.caseGeneration) return;
    if (created.duplicate) {
      if (this.caseId !== created.case_id) this.clearCase();
      this.game = created; this.caseId = created.case_id; this.ordinaryCaseId = created.case_id;
      this.activityKnown = true;
      this.ensureTrail(); this.persist();
      this.briefing = false; this.pendingLead = "";
      void this.refreshQuotes();
      this.toast("Resuming your existing case. No new case was created.", "info");
      this.go(created.state.outcome ? "results" : "investigate");
    } else this.begin(created);
  }

  /** Explicit replay of a solved mission. The server suppresses points, achievements and completion credit. */
  async replayCase(missionId: string) {
    const session = this.sessionGeneration, generation = this.caseGeneration;
    const created = await this.run("Opening replay", () => this.api.replay(missionId), e => {
      if (e.code === "replay_not_available") {
        void this.loadProgression();
        this.toast("That case can't be replayed yet. Solve it first.", "error");
        return true;
      }
      return false;
    });
    if (created && session === this.sessionGeneration && generation === this.caseGeneration) {
      this.toast("Replay started. Replays award no points or achievements.", "info"); this.begin(created);
    }
  }

  async abandonCurrentCase(): Promise<boolean> {
    const current = this.game;
    if (!current || current.attempt_kind !== "ordinary" || current.state.outcome !== null || this.busy) return false;
    const session = this.sessionGeneration, generation = this.caseGeneration;
    const isCurrent = () => session === this.sessionGeneration && generation === this.caseGeneration && this.caseId === current.case_id;

    const refreshDesk = async () => {
      this.clearCase();
      this.ordinaryCaseId = null; this.activityKnown = false;
      this.go("cases");
      await Promise.all([this.syncCurrentCase(), this.fetchProgression(true)]);
    };

    const abandoned = await this.run("Abandoning case", async () => {
      try {
        const result = await this.api.abandonCase(current.case_id, current.state_version);
        if (!isCurrent()) return false;
        if (this.summary) this.summary = { ...this.summary, points: result.points_after, rank: result.rank_after };
      } catch (e) {
        if (!isCurrent()) return false;
        if (e instanceof ApiError && e.code === "stale_version") {
          const checked = await this.api.currentActivity();
          if (!isCurrent()) return false;
          this.applyActivity(checked);
          if (!this.game) this.go("cases");
          this.toast("This case changed in another tab or device. Review the latest case and confirm abandonment again.", "error");
          return false;
        }
        if (e instanceof ApiError && (e.status === 404 || e.code === "case_not_abandonable")) {
          await refreshDesk();
          this.toast("This case can no longer be abandoned. The case desk has been refreshed.", "info");
          return false;
        }
        if (e instanceof ApiError && e.status === 0) {
          const checked = await this.api.currentActivity();
          if (!isCurrent()) return false;
          if (checked.ordinary_case?.case_id !== current.case_id) {
            await refreshDesk();
            this.toast("Case abandoned. You can start a new case whenever you're ready.", "success");
            return true;
          }
          this.applyActivity(checked);
        }
        if (e instanceof ApiError && e.status === 429) await new Promise(resolve => setTimeout(resolve, 1000));
        throw e;
      }

      await refreshDesk();
      this.toast("Case abandoned. You can start a new case whenever you're ready.", "success");
      return true;
    });
    return abandoned === true;
  }

  async resume() {
    if (this.weeklyId) { await this.refreshWeekly(); return; }
    if (this.busy || !this.caseId) return;
    const id = this.caseId, generation = this.caseGeneration;
    const loaded = await this.run("Retrieving case file", () => this.api.load(this.caseId));
    if (!loaded || id !== this.caseId || generation !== this.caseGeneration) return;
    if (this.game && loaded.state_version < this.game.state_version) return;
    if (loaded.state.outcome === "abandoned") {
      this.clearCase(); this.go("cases");
      await this.syncCurrentCase();
      return;
    }
    this.game = loaded;
    this.ensureTrail();
    this.briefing = false; this.pendingLead = "";
    this.quotes = []; this.quotesLoaded = false; this.ledger = [];
    void this.refreshQuotes();
    this.go(loaded.state.outcome ? "results" : "investigate");
  }

  private async reloadCase() {
    if (this.weeklyId) { await this.refreshWeekly(); return; }
    if (!this.caseId) return;
    const id = this.caseId, generation = this.caseGeneration;
    try {
      const loaded = await this.api.load(id);
      if (id !== this.caseId || generation !== this.caseGeneration) return;
      if (this.game && loaded.state_version < this.game.state_version) return;
      if (loaded.state.outcome === "abandoned") {
        this.clearCase(); this.go("cases");
        await this.syncCurrentCase();
      } else { this.game = loaded; void this.refreshQuotes(); }
    } catch (e) { if (id === this.caseId && generation === this.caseGeneration) this.fail(e); }
  }

  /** Quotes depend on case state, venues and balance, so they are refreshed after every state change. */
  async refreshQuotes() {
    const id = this.caseId, generation = this.caseGeneration, version = this.game?.state_version;
    const isCurrent = () => id === this.caseId && generation === this.caseGeneration && version === this.game?.state_version;
    if (!id || !this.game || this.game.state.outcome) { this.quotes = []; this.quotesLoaded = true; return; }
    try {
      const quotes = this.weeklyId ? await this.api.weeklyQuotes(id) : await this.api.quotes(id);
      if (isCurrent()) this.quotes = quotes;
    } catch (e) {
      if (isCurrent()) { this.quotes = []; this.fail(e); }
    } finally { if (isCurrent()) this.quotesLoaded = true; }
  }

  async refreshLedger() {
    if (!this.caseId || this.weeklyId) return;
    const id = this.caseId, generation = this.caseGeneration;
    try {
      const ledger = await this.api.ledger(id);
      if (id === this.caseId && generation === this.caseGeneration) this.ledger = ledger;
    } catch (e) { if (id === this.caseId && generation === this.caseGeneration) this.fail(e); }
  }

  async command(payload: ClientCommand, message: string, label = "Working", quiet = false): Promise<boolean> {
    const current = this.game;
    if (!current || current.state.outcome !== null || this.busy) return false;
    if (this.weeklyId) return this.weeklyCommand(payload, message, label, quiet);
    const generation = this.caseGeneration;
    if (payload.type === "visit_venue") this.lastWitness = null;
    const next = await this.run(label, () => this.api.command(current.case_id, current.state_version, payload));
    if (this.caseId !== current.case_id || generation !== this.caseGeneration) return false;
    if (!next) { await this.reloadCase(); return false; }
    if (this.game && next.state_version < this.game.state_version) {
      await this.reloadCase();
      return true;
    }
    this.game = next;
    const account = next.events.find(e => e.event_type === "witness_account")?.data;
    if (account?.message && !next.duplicate) {
      if (payload.type === "visit_venue") {
        this.lastWitness = { venueId: payload.venue_id, venueName: account.local_venue_name || account.venue_name || "", role: account.witness_role ?? "Witness", message: account.message };
      }
      this.notes = [...this.notes, {
        stop: current.state.current_state,
        venue: account.venue_name ?? "Witness",
        message: account.message,
        ...(payload.type === "visit_venue" ? { venueId: payload.venue_id } : {})
      }];
    }
    if (next.state.current_state !== current.state.current_state) {
      this.lastWitness = null;
      this.witnessVisit = null;
      this.journey = null;
      this.quotes = []; this.quotesLoaded = false;
      this.trail = [...this.trail, next.state.current_state];
    }
    this.persist();
    if (!next.state.outcome && payload.type !== "record_trait") void this.refreshQuotes();
    const travelEvent = payload.type === "travel"
      ? next.events.find(e => e.event_type === "arrived_on_trail" || e.event_type === "false_destination")
      : undefined;
    const feedback = travelEvent?.event_type === "arrived_on_trail"
      ? "The trail is hot."
      : travelEvent?.event_type === "false_destination"
        ? "The trail has gone cold."
        : payload.type === "travel"
          ? next.state.trail_status === "cold" ? "The trail has gone cold." : "The trail is hot."
        : account?.message
          ? "Witness account added to your notebook."
          : message;
    if (!quiet) this.toast(feedback, payload.type === "travel" && next.state.trail_status === "cold" ? "error" : "success");
    if (next.state.outcome) {
      this.awards = tokenAwards(next.events);
      await this.loadProgression();
    }
    if (payload.type === "search_hideout" && this.playRaid()) return true;
    if (next.state.outcome) this.go("results");
    return true;
  }

  async saveDossier(changes: Record<string, string>) {
    const selected = this.selectedDossierChanges(changes, this.game?.state.dossier ?? {});
    if (!selected) return false;
    let saved = 0;
    for (const { field, value } of selected) {
      const ok = await this.command({ type: "record_trait", trait_name: field, value }, "", "Filing dossier", true);
      if (!ok) return false;
      saved++;
    }
    if (saved) this.toast(`${saved} dossier detail${saved === 1 ? "" : "s"} recorded.`, "success");
    return true;
  }

  private clearCase() {
    this.caseGeneration++;
    this.game = null; this.caseId = ""; this.notes = []; this.trail = []; this.rankAtStart = null;
    this.briefing = false; this.pendingLead = ""; this.lastWitness = null; this.witnessVisit = null; this.journey = null; this.raidVisit = null; this.pendingRaid = null; this.returning = false;
    this.quotes = []; this.quotesLoaded = false; this.ledger = []; this.awards = []; this.panel = null; this.pressured = []; this.pressureNotice = null; this.pendingPressure.clear();
    ["nc-case", "nc-notes", "nc-trail", "nc-rank"].forEach(k => sessionStorage.removeItem(k));
  }

  newDesk() {
    this.clearCase();
    this.activityKnown = false;
    this.go("cases");
    void this.syncCurrentCase();
  }

  async startNewCaseAfterResult() {
    if (!this.game?.state.outcome || this.busy) return;
    this.clearCase();
    this.ordinaryCaseId = null;
    this.activityKnown = true;
    this.go("cases");
    await this.openCase();
  }

  // ---- Weekly challenge desk -----------------------------------------------
  // The weekly attempt is played on the same desk, scenes and screens as an ordinary case: `game` holds the attempt's state, and
  // commands, fares and arrivals go through the weekly endpoints. The server owns the clock; animations only decorate the wait.

  /** Opens the attempt on the case desk. The first time it types the case file; after that it lands on the desk. */
  async enterWeekly(attemptId: string) {
    if (this.busy) return;
    const attempt = await this.run("Opening the challenge desk", () => this.api.attempt(attemptId));
    if (!attempt || this.weeklyId === attemptId) { if (attempt) this.applyWeekly(attempt); return; }
    if (attempt.status !== "active" && attempt.status !== "in_transit" && attempt.status !== "solved") {
      this.toast("This attempt has ended.", "info");
      return;
    }
    this.clearCase();
    this.weeklyAccounts = [];
    this.trail = [attempt.state.current_state];
    this.applyWeekly(attempt);
    await this.loadWeeklyAccounts();
    void this.refreshQuotes();
    const seenKey = `nc-weekly-seen:${attemptId}`;
    let first = false;
    try { first = attempt.status === "active" && !localStorage.getItem(seenKey); localStorage.setItem(seenKey, "1"); } catch { /* private mode: skip the typing */ }
    if (attempt.state.outcome) this.go("results");
    else if (this.weeklyTransit) this.watchWeeklyTransit(this.weeklyTransit.mode);
    else if (first) { this.briefing = true; this.go("cases"); }
    else this.go("investigate");
  }

  /** Leaves the weekly desk for the weekly lobby or the ordinary desk. */
  exitWeekly(to: "weekly" | "cases" = "weekly") { this.go(to); }

  private leaveWeekly() {
    clearTimeout(this.weeklyTimer);
    this.weeklyId = null; this.weeklyTransit = null; this.weeklyAccounts = [];
    this.clearCase();
    this.activityKnown = false;
    void this.syncCurrentCase();
    void this.groups.loadChallenge();
  }

  private applyWeekly(a: WeeklyAttempt) {
    this.weeklyId = a.attempt_id; this.caseId = a.attempt_id;
    this.game = { api_version: "v1", case_id: a.attempt_id, state_version: a.state_version, duplicate: false, attempt_kind: "weekly", state: a.state, events: [] };
    this.weeklyEnds = Date.parse(a.ends_at); this.weeklyFetchedAt = Date.now();
    this.groups.attempt = a;
    const t = a.status === "in_transit" ? a.transit : null;
    this.weeklyTransit = t ? { destination: t.destination, mode: t.mode, arrivesAt: Date.now() + t.remaining_seconds * 1000, seconds: t.duration_seconds ?? Math.max(this.weeklyTransit?.seconds ?? 0, t.remaining_seconds) } : null;
    this.scheduleWeeklyArrival();
    if (a.status === "closed" || a.status === "expired" || a.status === "forfeited") {
      this.toast(a.status === "closed" ? "Someone in your group caught the thief first. The challenge is over." : "This attempt has ended.", "info");
      queueMicrotask(() => this.go("weekly"));
    }
  }

  private scheduleWeeklyArrival(retry = false) {
    clearTimeout(this.weeklyTimer);
    const t = this.weeklyTransit;
    if (!t) return;
    const wait = retry ? 5000 : Math.min(Math.max(t.arrivesAt - Date.now(), 0) + 500, 30000);
    this.weeklyTimer = setTimeout(() => void this.checkWeeklyArrival(), wait);
  }

  async refreshWeekly() {
    const id = this.weeklyId; if (!id) return;
    try {
      const a = await this.api.attempt(id);
      if (id !== this.weeklyId) return;
      const travelling = this.weeklyTransit !== null;
      this.applyWeekly(a);
      if (travelling && !this.weeklyTransit) await this.onWeeklyArrived();
      else if (!this.weeklyTransit) void this.refreshQuotes();
    } catch (e) { this.fail(e); this.scheduleWeeklyArrival(true); }
  }

  private async checkWeeklyArrival() { await this.refreshWeekly(); }

  private async loadWeeklyAccounts() {
    const id = this.weeklyId; if (!id) return;
    try {
      const events = await this.api.weeklyAccounts(id);
      if (id !== this.weeklyId) return;
      this.weeklyAccounts = events;
      this.notes = events.filter(e => e.event_type === "witness_account" && e.data.message)
        .map(e => ({
          stop: e.data.stop ?? "",
          venue: e.data.venue_name ?? "Witness",
          message: e.data.message!,
          ...(e.data.venue_id ? { venueId: e.data.venue_id } : {})
        }));
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.fail(e); }
  }

  /** The server has completed the journey: update the notebook, and carry on from wherever the player is watching. */
  private async onWeeklyArrived() {
    const known = this.weeklyAccounts.length;
    await this.loadWeeklyAccounts();
    void this.refreshQuotes();
    const state = this.game?.state;
    if (state && this.trail.at(-1) !== state.current_state) this.trail = [...this.trail, state.current_state];
    this.lastWitness = null;
    const newest = this.weeklyAccounts.length > known ? this.weeklyAccounts.at(-1) : undefined;
    const watching = this.screen === "journey" && this.journey?.loop === true;
    const arrival = this.journey?.mode === "hitch" ? "hitch" : "drive";
    this.journey = null;
    // A raid ends in its chase: shown at once if the player was watching the journey or the case is over, otherwise reported.
    const raided = this.pendingRaid;
    if (raided) {
      if ((watching || state?.outcome) && this.playRaid()) return;
      this.pendingRaid = null;
      this.toast(`You raided the ${raided.label.toLowerCase()}. ${sentence(raided.suspect)} was not there.`, "info");
      return;
    }
    if (state?.outcome) { this.go("results"); return; }
    if (newest?.data.message) {
      this.lastWitness = { venueId: newest.data.venue_id ?? "", venueName: newest.data.local_venue_name || newest.data.venue_name || "", role: newest.data.witness_role ?? "Witness", message: newest.data.message };
      if (watching) { await this.arriveAtWitness(arrival); return; }
      this.toast("You have arrived. The witness account is in your notebook.", "success");
    } else if (watching) {
      this.returning = true; this.go("investigate");
    } else this.toast(`You have arrived in ${state?.current_state ?? "the next state"}.`, "success");
  }

  /** What to call the place the weekly attempt is heading for: a state, or a lead such as "Museum". */
  weeklyPlace(destination: string): string {
    return this.weeklyLabels.get(destination) ?? destination.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
  }

  /** Plays the endless journey scene for the trip in progress. Esc returns to the desk; the countdown carries on there. */
  watchWeeklyTransit(transport?: string) {
    const t = this.weeklyTransit, state = this.game?.state;
    if (!t || !state) return;
    const mode = journeyModeOf(transport ?? t.mode);
    if (!mode) { this.go("investigate"); return; }
    const to = (STATES as readonly string[]).includes(t.destination) ? t.destination : state.current_state;
    this.journey = { from: state.current_state, to, mode, seed: Math.floor(Math.random() * 2147483000), loop: true, label: this.weeklyPlace(t.destination) };
    this.go("journey");
  }

  private async weeklyCommand(payload: ClientCommand, message: string, label: string, quiet: boolean): Promise<boolean> {
    const current = this.game, id = this.weeklyId;
    if (!current || !id) return false;
    if (this.weeklyTransit) { this.toast("You are travelling. No commands are accepted until you arrive.", "info"); return false; }
    // Quotes are empty while travelling, so remember the lead's name now for the destination banner.
    if (payload.type === "visit_venue" || payload.type === "search_hideout") {
      const lead = this.quotes.find(q => q.destination_id === payload.venue_id);
      if (lead) this.weeklyLabels.set(payload.venue_id, lead.label);
    }
    const reply = await this.run(label, () => this.api.attemptCommand(id, current.state_version, payload), e => {
      if (e.code === "stale_version") { this.toast("Your attempt changed elsewhere. Reloading the latest state.", "info"); void this.refreshWeekly(); return true; }
      return false;
    });
    if (id !== this.weeklyId) return false;
    if (!reply) return false;
    if (isTransitReply(reply)) {
      await this.refreshWeekly();
      if (!quiet) this.toast(`On the move. Arrival in ${reply.duration_seconds < 60 ? `${reply.duration_seconds}s` : `${Math.round(reply.duration_seconds / 60)} min`}.`, "info");
      return true;
    }
    const before = current.state;
    this.applyWeekly(reply);
    if (reply.state.current_state !== before.current_state) { this.trail = [...this.trail, reply.state.current_state]; this.quotes = []; this.quotesLoaded = false; }
    if (payload.type !== "record_trait" && !reply.state.outcome) void this.refreshQuotes();
    if (!quiet) this.toast(message, "success");
    if (reply.state.outcome) { this.awards = []; void this.groups.loadChallenge(); }
    if (payload.type === "search_hideout" && this.playRaid()) return true;
    if (reply.state.outcome) this.go("results");
    return true;
  }
}
