import { ApiError } from "../api/api";
import type { AppController } from "./app.svelte.ts";
import {
  forgetGroup, isTransitReply, parseKnownGroups, rememberGroup,
  type GroupInvitation, type PlayerGroup, type WeeklyAttempt, type WeeklyCurrent, type WeeklyDetails, type WeeklyEvent,
  type WeeklyHistoryEntry, type WeeklyNotification
} from "../domain/model.ts";
import type { ClientCommand } from "../domain/model.ts";

/** Groups and weekly challenges. Every mutation reloads server state, which is always authoritative. */
export class GroupsController {
  groups = $state<PlayerGroup[]>([]);
  invitations = $state<GroupInvitation[]>([]);
  loaded = $state(false);
  selectedId = $state<string | null>(null);
  current = $state<WeeklyCurrent | null>(null);
  details = $state<WeeklyDetails | null>(null);
  events = $state<WeeklyEvent[]>([]);
  attempt = $state<WeeklyAttempt | null>(null);
  history = $state<WeeklyHistoryEntry[]>([]);
  notifications = $state<WeeklyNotification[]>([]);
  notifyPrefs = $state({ web: true, email: false });
  /** Seconds to wait until a journey completes, from the server's own transit data. */
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private app: AppController) {
    try { const raw = JSON.parse(localStorage.getItem("nc-weekly-notify") ?? "{}"); this.notifyPrefs = { web: raw.web !== false, email: raw.email === true }; } catch { /* defaults */ }
  }

  private get owner() { return this.app.player?.player_id ?? ""; }
  private get key() { return `nc-groups-${this.owner}`; }
  private known(): string[] { return parseKnownGroups(localStorage.getItem(this.key)); }
  private save(ids: string[]) { localStorage.setItem(this.key, JSON.stringify(ids)); }

  get selected(): PlayerGroup | null { return this.groups.find(g => g.group_id === this.selectedId) ?? null; }

  reset() {
    clearTimeout(this.timer);
    this.groups = []; this.invitations = []; this.loaded = false; this.selectedId = null;
    this.current = null; this.details = null; this.events = []; this.attempt = null; this.history = []; this.notifications = [];
  }

  async load() {
    if (!this.app.player) return;
    const [invites, history, notices] = await Promise.all([
      this.app.api.invitations().catch(() => [] as GroupInvitation[]),
      this.app.api.weeklyHistory().catch(() => [] as WeeklyHistoryEntry[]),
      this.app.api.weeklyNotifications().catch(() => [] as WeeklyNotification[])
    ]);
    this.invitations = invites.filter(i => i.status === "pending"); this.history = history; this.notifications = notices;
    const results = await Promise.all(this.known().map(async id => {
      try { return await this.app.api.group(id); }
      catch (e) { if (e instanceof ApiError && (e.status === 403 || e.status === 404)) { this.save(forgetGroup(this.known(), id)); } return null; }
    }));
    this.groups = results.filter((g): g is PlayerGroup => g !== null && g.status === "active");
    if (!this.selectedId || !this.groups.some(g => g.group_id === this.selectedId)) this.selectedId = this.groups[0]?.group_id ?? null;
    this.loaded = true;
    if (this.selectedId) await this.loadChallenge();
  }

  private async step(label: string, work: () => Promise<unknown>, done: string, handle?: (e: ApiError) => boolean) {
    const ok = await this.app.run(label, async () => { await work(); return true; }, handle);
    await this.load();
    if (ok) this.app.toast(done, "success");
    return Boolean(ok);
  }

  select(id: string) { this.selectedId = id; this.current = null; this.details = null; this.attempt = null; this.events = []; void this.loadChallenge(); }

  async create(name: string, capacity?: number) {
    let made = "";
    const ok = await this.app.run("Creating group", async () => { made = (await this.app.api.createGroup(name.trim(), capacity)).group_id; return true; });
    if (!ok) return false;
    this.save(rememberGroup(this.known(), made)); this.selectedId = made;
    await this.load();
    this.app.toast("Group created.", "success");
    return true;
  }
  invite(username: string) { const g = this.selectedId; return g ? this.step("Sending invitation", () => this.app.api.invite(g, username.trim()), `Invitation sent to ${username.trim()}. It expires in 7 days.`) : Promise.resolve(false); }
  async answer(inv: GroupInvitation, accept: boolean) {
    const ok = await this.app.run(accept ? "Joining group" : "Declining", async () => { await this.app.api.answerInvitation(inv.invitation_id, accept); return true; });
    if (ok && accept) { this.save(rememberGroup(this.known(), inv.group_id)); this.selectedId = inv.group_id; }
    await this.load();
    if (ok) this.app.toast(accept ? `You joined ${inv.group_name}.` : "Invitation declined.", "success");
    return Boolean(ok);
  }
  setRole(playerId: string, role: "admin" | "member") { const g = this.selectedId; return g ? this.step("Updating role", () => this.app.api.setMemberRole(g, playerId, role), "Role updated.") : Promise.resolve(false); }
  remove(playerId: string) { const g = this.selectedId; return g ? this.step("Removing member", () => this.app.api.removeMember(g, playerId), "Member removed.") : Promise.resolve(false); }
  transfer(playerId: string) { const g = this.selectedId; return g ? this.step("Transferring ownership", () => this.app.api.transferOwnership(g, playerId), "Ownership transferred.") : Promise.resolve(false); }
  async leave() {
    const g = this.selectedId; if (!g) return false;
    const ok = await this.app.run("Leaving group", async () => { await this.app.api.leaveGroup(g); return true; });
    if (ok) { this.save(forgetGroup(this.known(), g)); this.selectedId = null; this.app.toast("You left the group.", "success"); }
    await this.load(); return Boolean(ok);
  }
  async disband() {
    const g = this.selectedId; if (!g) return false;
    const ok = await this.app.run("Deleting group", async () => { await this.app.api.deleteGroup(g); return true; });
    if (ok) { this.save(forgetGroup(this.known(), g)); this.selectedId = null; this.app.toast("Group deleted.", "success"); }
    await this.load(); return Boolean(ok);
  }

  // ---- Weekly challenge ---------------------------------------------------------------------------------

  async loadChallenge() {
    const id = this.selectedId; if (!id) return;
    try {
      const current = await this.app.api.weeklyCurrent(id);
      if (id !== this.selectedId) return;
      this.current = current;
      const [details, events] = await Promise.all([this.app.api.weekly(current.challenge_id), this.app.api.weeklyEvents(current.challenge_id).catch(() => [] as WeeklyEvent[])]);
      this.details = details; this.events = events;
      const mine = details.standings.find(s => s.username === this.app.player?.username)?.attempt_id;
      if (mine) await this.loadAttempt(mine); else this.attempt = null;
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.app.toast(e.message, "error"); else if (e instanceof ApiError) { this.current = null; this.details = null; } }
  }

  async loadAttempt(attemptId: string) {
    try {
      this.attempt = await this.app.api.attempt(attemptId);
      this.schedulePoll();
    } catch (e) { if (e instanceof ApiError && e.status === 401) this.app.toast(e.message, "error"); }
  }

  /** While travelling, ask the server again when the journey should be over; any read completes arrival. */
  private schedulePoll() {
    clearTimeout(this.timer);
    const a = this.attempt;
    if (!a || a.status !== "in_transit" || !a.transit) return;
    const wait = Math.min(Math.max(a.transit.remaining_seconds, 1), 30) * 1000 + 400;
    this.timer = setTimeout(() => { if (this.attempt) void this.loadAttempt(this.attempt.attempt_id); }, wait);
  }
  stopPolling() { clearTimeout(this.timer); }

  async join() {
    const c = this.current; if (!c) return false;
    let id = "";
    const ok = await this.app.run("Joining the challenge", async () => { id = (await this.app.api.startAttempt(c.challenge_id)).attempt_id; return true; });
    if (ok) { await this.loadChallenge(); await this.loadAttempt(id); this.app.toast("You're in. Your attempt is independent of your ordinary case.", "success"); }
    return Boolean(ok);
  }

  async command(command: ClientCommand, done: string, label = "Working") {
    const a = this.attempt; if (!a) return false;
    const reply = await this.app.run(label, () => this.app.api.attemptCommand(a.attempt_id, a.state_version, command), e => {
      if (e.code === "stale_version") { this.app.toast("Your attempt changed elsewhere. Reloaded.", "info"); void this.loadAttempt(a.attempt_id); return true; }
      return false;
    });
    if (!reply) return false;
    if (isTransitReply(reply)) this.app.toast(`On the move. Arrival in ${reply.duration_seconds < 60 ? reply.duration_seconds + "s" : Math.round(reply.duration_seconds / 60) + " min"}.`, "info");
    else { this.attempt = reply; this.app.toast(done, "success"); }
    await this.loadAttempt(a.attempt_id);
    void this.loadChallenge();
    return true;
  }

  cancel(reason: string) { const c = this.current; return c ? this.step("Cancelling challenge", () => this.app.api.cancelChallenge(c.challenge_id, reason.trim()), "Challenge cancelled.") : Promise.resolve(false); }

  async saveNotifications(web: boolean, email: boolean) {
    const ok = await this.app.run("Saving", async () => { await this.app.api.setWeeklyNotifications(web, email); return true; });
    if (ok) { this.notifyPrefs = { web, email }; localStorage.setItem("nc-weekly-notify", JSON.stringify(this.notifyPrefs)); this.app.toast("Notification settings saved.", "success"); }
    return Boolean(ok);
  }
}
