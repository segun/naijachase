export const STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory",
  "Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
  "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
  "Sokoto","Taraba","Yobe","Zamfara"
] as const;

export const HOME_BASES = STATES.filter(state => state !== "Federal Capital Territory");

const CAPITALS:Record<string,[number,number]>={
  "Abia":[5.53,7.49],"Adamawa":[9.20,12.48],"Akwa Ibom":[5.04,7.91],"Anambra":[6.21,7.07],"Bauchi":[10.31,9.84],"Bayelsa":[4.92,6.26],"Benue":[7.73,8.54],"Borno":[11.83,13.15],"Cross River":[4.98,8.34],"Delta":[6.20,6.73],"Ebonyi":[6.32,8.11],"Edo":[6.34,5.62],"Ekiti":[7.62,5.22],"Enugu":[6.45,7.51],"Gombe":[10.29,11.17],"Imo":[5.48,7.03],"Jigawa":[11.70,9.34],"Kaduna":[10.52,7.44],"Kano":[12.00,8.52],"Katsina":[12.99,7.60],"Kebbi":[12.45,4.20],"Kogi":[7.80,6.74],"Kwara":[8.50,4.55],"Lagos":[6.46,3.39],"Nasarawa":[8.49,8.52],"Niger":[9.62,6.55],"Ogun":[7.15,3.35],"Ondo":[7.25,5.19],"Osun":[7.77,4.56],"Oyo":[7.38,3.95],"Plateau":[9.93,8.89],"Rivers":[4.82,7.05],"Sokoto":[13.06,5.24],"Taraba":[8.89,11.36],"Yobe":[11.75,11.96],"Zamfara":[12.17,6.66]
};
export const STATE_COORDS:Record<string,[number,number]>={...CAPITALS,"Federal Capital Territory":[9.06,7.49]};
export function nearestHomeBase(latitude:number,longitude:number):string {
  let best="Lagos",distance=Infinity;
  for(const [state,[lat,lon]] of Object.entries(CAPITALS)){const d=(lat-latitude)**2+(lon-longitude)**2;if(d<distance){best=state;distance=d}}
  return best;
}

export const FIELDS = ["sex","height","skin_tone","hair","hobby","vehicle","accessory","feature"] as const;

// Response shapes come from the generated API contract; do not redefine them here.
export type {
  AuthResponse, AvatarCatalogue, AvatarPreset, AvatarProfile, CaseArchiveEntry, CaseResponse, ClientCommand, GameEvent, Player, PlayerSession,
  CatalogueHealth, CatalogueProgress, ContentRoleResponse, MissionAdminDetails, MissionLifecycleEvent, MissionTransitionRequest, MissionValidation, ReleaseNotification, InterstateMode, LocalMode, ProfileUpdate, TransportLedgerEntry, TransportQuote, ProgressionSummary, PublicGameState as PublicState, RankHistoryEntry
} from "../../contracts/typescript/api-v1.ts";
import type { GroupMember, GroupRole, PlayerGroup, WeeklyAttempt, CompleteCooperationRequest, CooperationPreferences, CooperationReportRequest, CooperationRequest, CreateCooperationRequest, CatalogueHealth, ContentRoleResponse, InterstateMode, LocalMode, MissionAdminDetails, MissionLifecycleEvent, MissionTransitionRequest, MissionValidation, ReleaseNotification, PublicGameState as PublicState, TransportLedgerEntry, TransportQuote } from "../../contracts/typescript/api-v1.ts";
export type Screen = "welcome"|"cases"|"investigate"|"notebook"|"dossier"|"travel"|"warrant"|"results"|"settings"|"archive"|"content"|"helpers"|"groups"|"weekly";

export function clock(minutes:number):string {
  const total=420+minutes, day=Math.floor(total/1440);
  const names=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Next Monday"];
  const minute=total%1440;
  return `${names[day] ?? "After deadline"} ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
}
export function progress(state:PublicState):number { return Math.min(100,Math.round((state.stage/7)*100)); }
export function safeId(value:string):boolean { return /^[A-Za-z0-9._-]{2,64}$/.test(value); }

export const DEADLINE_MINUTES = 10080;
export const TOTAL_STOPS = 8;

export type Zone = "North West"|"North East"|"North Central"|"South West"|"South South"|"South East";
export const ZONES:Record<Zone,readonly string[]>={
  "North West":["Jigawa","Kaduna","Kano","Katsina","Kebbi","Sokoto","Zamfara"],
  "North East":["Adamawa","Bauchi","Borno","Gombe","Taraba","Yobe"],
  "North Central":["Benue","Federal Capital Territory","Kogi","Kwara","Nasarawa","Niger","Plateau"],
  "South West":["Ekiti","Lagos","Ogun","Ondo","Osun","Oyo"],
  "South South":["Akwa Ibom","Bayelsa","Cross River","Delta","Edo","Rivers"],
  "South East":["Abia","Anambra","Ebonyi","Enugu","Imo"]
};
export function zoneOf(state:string):Zone|null {
  for(const [zone,members] of Object.entries(ZONES)) if(members.includes(state)) return zone as Zone;
  return null;
}


export function clockParts(minutes:number):{day:string;time:string;hour:number} {
  const total=420+Math.max(0,minutes),day=Math.floor(total/1440),minute=total%1440;
  const names=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Next Monday"];
  const hour=Math.floor(minute/60);
  return {day:names[day]??"After deadline",time:`${String(hour).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`,hour};
}
export function dayPart(hour:number):"morning"|"afternoon"|"evening"|"night" {
  return hour>=5&&hour<12?"morning":hour>=12&&hour<17?"afternoon":hour>=17&&hour<20?"evening":"night";
}
export function timeLeft(elapsed:number):{minutes:number;label:string;percentUsed:number;urgent:boolean} {
  const minutes=Math.max(0,DEADLINE_MINUTES-elapsed);
  const days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60);
  const label=days>0?`${days}d ${hours}h left`:`${hours}h ${minutes%60}m left`;
  return {minutes,label,percentUsed:Math.min(100,Math.round((elapsed/DEADLINE_MINUTES)*100)),urgent:minutes<=1440};
}

export const SUSPECTS=["NG-T001","NG-T002","NG-T003"] as const;

export const FIELD_META:Record<(typeof FIELDS)[number],{label:string;hint:string;placeholder:string}>={
  sex:{label:"Sex",hint:"How witnesses describe the suspect.",placeholder:"e.g. female"},
  height:{label:"Height",hint:"Tall, short, or something in between.",placeholder:"e.g. tall"},
  skin_tone:{label:"Skin tone",hint:"Use the witness's own wording.",placeholder:"e.g. dark brown"},
  hair:{label:"Hair",hint:"Style, colour or length.",placeholder:"e.g. braided"},
  hobby:{label:"Hobby",hint:"What the suspect spoke about with passion.",placeholder:"e.g. chess"},
  vehicle:{label:"Vehicle",hint:"How the suspect arrived or left.",placeholder:"e.g. motorbike"},
  accessory:{label:"Accessory",hint:"Something worn or carried.",placeholder:"e.g. gold watch"},
  feature:{label:"Distinguishing feature",hint:"Scars, marks or a memorable habit.",placeholder:"e.g. gap tooth"}
};

export function dossierCount(dossier:Record<string,string>):number {
  return FIELDS.filter(field=>(dossier[field]??"").trim().length>0).length;
}

export function stopPrefix(state:PublicState):string { return `${state.stage}|${state.current_state}|`; }
export function questionedHere(state:PublicState):string[] {
  const prefix=stopPrefix(state);
  return state.visited_venues.filter(v=>v.startsWith(prefix)).map(v=>v.slice(prefix.length));
}

export type Note = {stop:string;venue:string;message:string};
export function parseNotes(raw:string|null):Note[] {
  try{
    const value:unknown=JSON.parse(raw??"[]");
    if(!Array.isArray(value)) return [];
    return value.flatMap((item):Note[]=>{
      if(typeof item==="string") return [{stop:"Earlier",venue:"Witness",message:item}];
      if(item&&typeof item.message==="string") return [{stop:String(item.stop??"Earlier"),venue:String(item.venue??"Witness"),message:item.message}];
      return [];
    });
  }catch{return []}
}
export function groupNotes(notes:Note[]):{stop:string;notes:Note[]}[] {
  const groups:{stop:string;notes:Note[]}[]=[];
  for(const note of notes){
    const last=groups[groups.length-1];
    if(last&&last.stop===note.stop) last.notes.push(note); else groups.push({stop:note.stop,notes:[note]});
  }
  return groups;
}

export function initials(name:string):string {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join("")||"?";
}

// The server chooses every ordinary case (POST /v1/cases with an empty body) and tracks first completions,
// so the browser never selects missions, generates case ids or sends seeds. Replay is the one explicit choice.
export type AttemptKind = "ordinary" | "replay" | "weekly";
export const ATTEMPT_LABEL: Record<AttemptKind, string> = { ordinary: "Case", replay: "Replay", weekly: "Weekly challenge" };

type ArchiveLike = { case_id: string; mission_id: string; outcome: string; first_completion: boolean; attempt_kind: AttemptKind };
export const isSolved = (entry: { outcome: string }): boolean => entry.outcome === "solved";

/**
 * The archive entries that should carry a "Replay case" action: one per solved mission, preferring the original rewarding
 * solve (`first_completion`). Replay attempts and failed attempts never get the action themselves.
 */
export function replayTargets(archive: readonly ArchiveLike[]): Set<string> {
  const byMission = new Map<string, ArchiveLike>();
  for (const entry of archive) {
    if (!isSolved(entry)) continue;
    const current = byMission.get(entry.mission_id);
    if (!current || (entry.first_completion && !current.first_completion)) byMission.set(entry.mission_id, entry);
  }
  return new Set([...byMission.values()].map(e => e.case_id));
}

export type CatalogueView = { published: number; completed: number; unseen: number; exhausted: boolean; percent: number };
export function catalogueView(s: { published_cases: number; completed_cases: number; unseen_cases: number; exhausted: boolean }): CatalogueView {
  const percent = s.published_cases > 0 ? Math.min(100, Math.round((s.completed_cases / s.published_cases) * 100)) : 0;
  return { published: s.published_cases, completed: s.completed_cases, unseen: s.unseen_cases, exhausted: s.exhausted, percent };
}

export type AchievementDef = { id:string; title:string; description:string };

export function duration(minutes:number):string {
  const days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60),mins=minutes%60;
  if(days>0) return `${days}d ${hours}h`;
  if(hours>0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
export function ratio(correct:number,wrong:number):string { return `${correct} of ${correct+wrong}`; }

export type ErrorKind = "signed_out"|"denied"|"conflict"|"rejected"|"rate_limited"|"other";
export function errorKind(status:number):ErrorKind {
  return status===401?"signed_out":status===403?"denied":status===409?"conflict":status===422?"rejected":status===429?"rate_limited":"other";
}
export const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a moment and try again.";

// ---- Mission money and transport (P3.7.3) -----------------------------------------------------------------------
// The server owns every fare, journey time, opening-hours wait and balance. These helpers only arrange and present
// what quotes say; the command response stays authoritative.
export type Mode = InterstateMode | LocalMode;
export type Scope = TransportQuote["scope"];
export const MODE_LABEL: Record<Mode, string> = { fly: "Fly", drive: "Drive", hitch_ride: "Hitch a ride" };
export const MODE_NOTE: Record<Mode, string> = {
  fly: "Fastest, but it costs the most.",
  drive: "A sensible balance of cost and time.",
  hitch_ride: "Free, but it can take a lot of time."
};
const MODE_ORDER: Mode[] = ["fly", "drive", "hitch_ride"];

/** Case money is virtual and isolated to one case. */
export const money = (amount: number): string => `\u20A6${Math.round(amount).toLocaleString("en-NG")}`;

export type QuoteGroup = { id: string; label: string; options: TransportQuote[] };
/** Groups quotes by destination within one scope, ordering each group's options fly, drive, hitch. */
export function groupQuotes(quotes: readonly TransportQuote[], scope: Scope): QuoteGroup[] {
  const groups = new Map<string, QuoteGroup>();
  for (const q of quotes) {
    if (q.scope !== scope) continue;
    const g = groups.get(q.destination_id) ?? { id: q.destination_id, label: q.label, options: [] };
    g.options.push(q);
    groups.set(q.destination_id, g);
  }
  for (const g of groups.values()) g.options.sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));
  return [...groups.values()];
}

export type Projection = { arrivalMinutes: number; arrival: string; balanceAfter: number; totalMinutes: number; missesDeadline: boolean };
/** Presentation-only projection from the current elapsed time and balance. */
export function project(elapsed: number, balance: number, q: Pick<TransportQuote, "cost" | "travel_minutes" | "wait_minutes">): Projection {
  const totalMinutes = q.wait_minutes + q.travel_minutes;
  const arrivalMinutes = elapsed + totalMinutes;
  const parts = clockParts(arrivalMinutes);
  return { arrivalMinutes, arrival: `${parts.day} ${parts.time}`, balanceAfter: balance - q.cost, totalMinutes, missesDeadline: arrivalMinutes > DEADLINE_MINUTES };
}
/** The option to preselect: the cheapest affordable one that still beats the deadline, else the first affordable. */
export function defaultOption(options: readonly TransportQuote[], elapsed: number, balance: number): TransportQuote | null {
  const usable = options.filter(o => o.affordable);
  const safe = usable.filter(o => !project(elapsed, balance, o).missesDeadline);
  const pool = safe.length ? safe : usable;
  return pool.slice().sort((a, b) => a.travel_minutes + a.wait_minutes - (b.travel_minutes + b.wait_minutes))[0] ?? null;
}
export const cheapest = (options: readonly TransportQuote[]): TransportQuote | null =>
  options.slice().sort((a, b) => a.cost - b.cost || a.travel_minutes - b.travel_minutes)[0] ?? null;

export type LedgerView = { sequence: number; title: string; detail: string; cost: number; balanceAfter: number; allocation: boolean };
export function ledgerView(entries: readonly TransportLedgerEntry[]): LedgerView[] {
  return entries.map(e => {
    const allocation = e.kind === "opening_allocation" || e.mode === "allocation";
    const modeText = allocation ? "" : MODE_LABEL[e.mode as Mode] ?? e.mode;
    const route = e.origin && e.destination ? `${e.origin} \u2192 ${e.destination}` : e.destination || e.origin;
    return {
      sequence: e.sequence,
      title: allocation ? "Opening allocation" : route || e.kind.replaceAll("_", " "),
      detail: allocation ? "Case funds issued" : `${modeText}${e.minutes ? ` \u00B7 ${duration(e.minutes)}` : ""}`,
      cost: e.cost, balanceAfter: e.balance_after, allocation
    };
  });
}

/** Known witness venues get a friendlier description; any other venue the server offers still works. */
const VENUE_INFO: Record<string, { icon: string; who: string; blurb: string }> = {
  market: { icon: "market", who: "Traders and loaders", blurb: "Crowded stalls where everyone notices who spends what." },
  library: { icon: "library", who: "Librarians and researchers", blurb: "Quiet reading rooms. Careful people with careful memories." },
  motor_park: { icon: "park", who: "Agberos, drivers and conductors", blurb: "Engines, horns and gossip about who left town and how." }
};
/** Weekly attempts have no quote endpoint, so the three standard witness venues are offered. */
export const KNOWN_VENUES: readonly string[] = Object.keys(VENUE_INFO);
export function venueInfo(id: string): { icon: string; who: string; blurb: string } {
  return VENUE_INFO[id] ?? { icon: "pin", who: "Local people", blurb: "Someone here may have noticed something." };
}

// ---- Release notifications and the restricted content dashboard (P3.7.2) ----------------------------------------
export type ContentRole = ContentRoleResponse["content_role"];
export type Lifecycle = MissionTransitionRequest["target_status"];
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  draft: "Draft", editorial_review: "Editorial review", validated: "Validated", scheduled: "Scheduled", published: "Published", retired: "Retired"
};

// draft <-> editorial_review -> validated -> scheduled -> published -> retired, with validated <-> scheduled and retired -> draft.
const NEXT: Record<Lifecycle, readonly Lifecycle[]> = {
  draft: ["editorial_review"],
  editorial_review: ["draft", "validated"],
  validated: ["editorial_review", "scheduled", "published"],
  scheduled: ["validated", "published"],
  published: ["retired"],
  retired: ["draft"]
};
const EDITOR_MAY: ReadonlySet<Lifecycle> = new Set<Lifecycle>(["draft", "editorial_review"]);

/** Transitions to offer for a role. The server remains the authority and rejects anything else. */
export function allowedTransitions(status: string, role: ContentRole): Lifecycle[] {
  const next = NEXT[status as Lifecycle] ?? [];
  if (role === "editor") return next.filter(t => EDITOR_MAY.has(t) && EDITOR_MAY.has(status as Lifecycle));
  return [...next];
}
export const needsSchedule = (target: Lifecycle): boolean => target === "scheduled";

/** "2026-10-19 06:00:00" (UTC) from a datetime-local value, or null if it is not a valid future-looking timestamp. */
export function utcTimestamp(local: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(local);
  return match ? `${match[1]} ${match[2]}:00` : null;
}
export function transitionBody(target: Lifecycle, reason: string, scheduledLocal = ""): MissionTransitionRequest | { error: string } {
  const why = reason.trim();
  if (why.length < 3) return { error: "Give a reason for the change (at least 3 characters)." };
  if (needsSchedule(target)) {
    const at = utcTimestamp(scheduledLocal);
    if (!at) return { error: "Choose a UTC date and time to schedule the release." };
    return { target_status: target, scheduled_for: at, reason: why };
  }
  return { target_status: target, reason: why };
}
export const isMissionId = (id: string): boolean => /^NG-M\d{4,}$/.test(id.trim().toUpperCase());

export function reserveSummary(h: CatalogueHealth): { ready: number; alert: boolean; line: string } {
  const ready = h.validated + h.scheduled;
  return { ready, alert: h.reserve_below_target, line: `${ready} validated or scheduled in reserve` };
}

/** Unread release notifications, newest first. */
export const unreadReleases = (list: readonly ReleaseNotification[]): ReleaseNotification[] =>
  list.filter(n => !n.read).sort((a, b) => b.notification_id - a.notification_id);

export function formatUtc(value: string | null): string {
  if (!value) return "\u2014";
  const d = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}


// ---- Cooperative investigations (P3.8) --------------------------------------------------------------------------
export type { CooperationPreferences, CooperationRequest, CooperationReportRequest, CompleteCooperationRequest, CreateCooperationRequest };
export type CoopStatus = CooperationRequest["status"];
export type ReportCategory = CooperationReportRequest["category"];

export const REPORT_CATEGORIES: readonly { id: ReportCategory; label: string }[] = [
  { id: "spam", label: "Spam" }, { id: "harassment", label: "Harassment" }, { id: "abusive_username", label: "Abusive username" },
  { id: "cheating", label: "Cheating" }, { id: "other", label: "Something else" }
];
export const RECOMMENDATION_MAX = 240;
export const REPORT_DETAILS_MAX = 500;

export const COOP_STATUS: Record<CoopStatus, { label: string; terminal: boolean; tone: "gold" | "green" | "red" | "muted" }> = {
  pending: { label: "Waiting for a reply", terminal: false, tone: "gold" },
  accepted: { label: "Accepted", terminal: false, tone: "gold" },
  completed: { label: "Recommendation ready", terminal: false, tone: "green" },
  acknowledged: { label: "Thanked", terminal: true, tone: "green" },
  declined: { label: "Declined", terminal: true, tone: "muted" },
  cancelled: { label: "Cancelled", terminal: true, tone: "muted" },
  expired: { label: "Expired", terminal: true, tone: "red" }
};

/** Cooperation is offered only to adults who have turned it on. Unknown or minor accounts never see it. */
export function cooperationAvailable(p: Pick<CooperationPreferences, "age_assurance_status"> | null): boolean {
  return p?.age_assurance_status === "adult";
}

/** Actions each side may take, by status. The server enforces the same rules. */
export function coopActions(r: Pick<CooperationRequest, "status" | "owner_username" | "helper_username">, me: string): ("accept" | "decline" | "complete" | "acknowledge")[] {
  const helper = r.helper_username === me, owner = r.owner_username === me;
  if (r.status === "pending" && helper) return ["accept", "decline"];
  if (r.status === "accepted" && helper) return ["complete"];
  if (r.status === "completed" && owner) return ["acknowledge"];
  return [];
}
/** The other person in a request, for block and report controls. */
export const coopCounterpart = (r: Pick<CooperationRequest, "owner_username" | "helper_username">, me: string): string => (r.owner_username === me ? r.helper_username : r.owner_username);

export function recommendationProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write a short recommendation.";
  if (t.length > RECOMMENDATION_MAX) return `Keep it under ${RECOMMENDATION_MAX} characters.`;
  return null;
}
/** Exact usernames only: there is deliberately no player search. */
export const usernameProblem = (name: string): string | null => (name.trim().length < 3 ? "Enter the exact username (at least 3 characters)." : null);

export function expiresIn(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000), mins = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${mins}m left` : `${mins}m left`;
}

/** Groups requests so work waiting on the player comes first. */
export function sortCoop(list: readonly CooperationRequest[], me: string): CooperationRequest[] {
  const rank = (r: CooperationRequest) => (coopActions(r, me).length ? 0 : COOP_STATUS[r.status].terminal ? 2 : 1);
  return list.slice().sort((a, b) => rank(a) - rank(b));
}

// ---- Groups and weekly challenges (P3.8.1) -----------------------------------------------------------------------
// Eligibility, arrival, closure and winners are decided by the server clock. The browser only displays them.
export type { GroupMember, GroupRole, PlayerGroup, WeeklyAttempt };
export type GroupInvitation = { invitation_id: string; status: string; group_id: string; group_name: string; expires_at: string };
export type WeeklyCurrent = { challenge_id: string; starts_at_unix: number; ends_at_unix: number; timezone: string };
export type Standing = { username: string; status: string; attempt_id: string | null; finished_at: string | null };
export type WeeklyDetails = { challenge_id: string; status: string; timezone: string; starts_at: string; ends_at: string; winner_attempt_id: string | null; standings: Standing[] };
export type WeeklyEvent = { event_id: number; event_type: string; data: Record<string, unknown>; created_at: string };
export type WeeklyHistoryEntry = { challenge_id: string; group_name: string; status: string; week: string };
export type WeeklyNotification = { notification_id: number; type: string; channel: string; payload: Record<string, unknown>; read_at: string | null };
export type TransitReply = { status: "in_transit"; transit_id: string; duration_seconds: number };
export const isTransitReply = (x: unknown): x is TransitReply => typeof x === "object" && x !== null && (x as { status?: string }).status === "in_transit";

export const GROUP_ROLE_LABEL: Record<GroupRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
export const GROUP_NAME_MAX = 40;
export function groupNameProblem(name: string): string | null {
  const t = name.trim();
  if (t.length < 3) return "Give the group a name of at least 3 characters.";
  if (t.length > GROUP_NAME_MAX) return `Keep the name under ${GROUP_NAME_MAX} characters.`;
  return null;
}

/** What each role may do to another member. The server enforces these rules; this only decides what to offer. */
export function memberActions(me: GroupRole, target: GroupRole, isSelf: boolean): ("promote" | "demote" | "remove" | "transfer")[] {
  if (isSelf || target === "owner") return [];
  if (me === "owner") return target === "admin" ? ["demote", "remove", "transfer"] : ["promote", "remove", "transfer"];
  if (me === "admin" && target === "member") return ["remove"];
  return [];
}
export const canManageGroup = (role: GroupRole | undefined): boolean => role === "owner" || role === "admin";
export const myRole = (g: Pick<PlayerGroup, "members">, username: string): GroupRole | undefined => g.members.find(x => x.username === username)?.role;

// The API has no "list my groups" call, so the browser remembers the ids it has seen (created, or from accepted
// invitations) and re-validates each one with the server. Ids are not secrets: the roster is members-only.
export function parseKnownGroups(raw: string | null): string[] {
  try { const v: unknown = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : []; }
  catch { return []; }
}
export const rememberGroup = (ids: readonly string[], id: string): string[] => [...new Set([...ids, id])];
export const forgetGroup = (ids: readonly string[], id: string): string[] => ids.filter(x => x !== id);

export function countdown(targetMs: number, now = Date.now()): { label: string; over: boolean; urgent: boolean } {
  const diff = targetMs - now;
  if (diff <= 0) return { label: "closed", over: true, urgent: false };
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), mins = Math.floor((diff % 3600000) / 60000);
  const label = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${mins}m left` : `${mins}m ${Math.floor((diff % 60000) / 1000)}s left`;
  return { label, over: false, urgent: diff < 3600000 };
}
export const secondsLabel = (s: number): string => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.max(0, Math.round(s))}s`);
export const utcFromUnix = (unix: number): number => unix * 1000;
export const parseUtc = (value: string): number => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(" ", "T") + "Z").getTime();

export const WEEKLY_STATUS: Record<string, { label: string; tone: "gold" | "green" | "red" | "muted" }> = {
  scheduled: { label: "Scheduled", tone: "muted" }, open: { label: "Open", tone: "green" }, closed: { label: "Closed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "red" }, expired: { label: "Expired", tone: "muted" },
  active: { label: "Investigating", tone: "gold" }, in_transit: { label: "Travelling", tone: "gold" }, solved: { label: "Solved", tone: "green" },
  forfeited: { label: "Forfeited", tone: "red" }
};
export const weeklyStatus = (s: string) => WEEKLY_STATUS[s] ?? { label: s.replaceAll("_", " "), tone: "muted" as const };

/** Standings: the winner first, then solved, then everyone else by name. */
export function sortStandings(list: readonly Standing[], winnerAttemptId: string | null): Standing[] {
  const rank = (s: Standing) => (s.attempt_id && s.attempt_id === winnerAttemptId ? 0 : s.status === "solved" ? 1 : 2);
  return list.slice().sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
}

const EVENT_LABEL: Record<string, string> = {
  challenge_scheduled: "Challenge scheduled", member_started: "A member began investigating", command_applied: "A move was made",
  member_finished: "A member solved the case", first_valid_capture: "First valid capture", challenge_closed: "Challenge closed",
  departure: "Departed", arrival: "Arrived", reward: "Reward granted", challenge_cancelled: "Challenge cancelled"
};
export const eventLabel = (type: string): string => EVENT_LABEL[type] ?? type.replaceAll("_", " ");

export const NOTIFICATION_LABEL: Record<string, string> = { challenge_scheduled: "A new weekly challenge is ready", challenge_started: "The weekly challenge has started", challenge_closed: "The weekly challenge has closed", reward: "You won challenge tokens" };
export const notificationLabel = (type: string): string => NOTIFICATION_LABEL[type] ?? type.replaceAll("_", " ");
