import type {
  AbandonCaseRequest, AbandonCaseResponse, AssignCaseRequest, AuthResponse, AvatarCatalogue, AvatarProfile, AvatarSelectionRequest, CaseArchiveEntry, CaseResponse, CatalogueProgress, ClientCommand, CurrentActivityResponse, CurrentCaseResponse, ExecuteRequest, GameEvent,
  LoginRequest, PlayerSession, ProfileUpdate, ProgressionSummary, RecoveryCompleteRequest, WitnessAccountsResponse,
  RecoveryRequest, ResendConfirmationRequest, RegisterRequest, ReplayCaseRequest, TransportLedgerEntry, TransportQuote,
  DisciplinaryCase, JailStatus, PressureAttemptRecord, PressureResult, PressureWitnessRequest, TokenBalance, TokenLedgerEntry,
  AssistantRoutesResponse, CatalogueHealth, CompleteCooperationRequest, ContentRoleResponse, CooperationPreferences, CooperationReportRequest, CooperationRequest, CreateCooperationRequest, DossierOptions, MissionAdminDetails, MissionTransitionRequest, MissionValidation, ReleaseNotification
} from "../../../contracts/typescript/api-v1.ts";
import type { AchievementDef, GroupInvitation, PlayerGroup, Standing, TransitReply, WeeklyAttempt, WeeklyCurrent, WeeklyDetails, WeeklyEvent, WeeklyHistoryEntry, WeeklyNotification } from "../domain/model.ts";

export class ApiError extends Error {
  get retryable() { return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500; }
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

type Message = { message?: string };
let lastRequestId = "";
export const getLastRequestId = () => lastRequestId;

// Session rotation replaces the cookie, and reusing a rotated token revokes the whole session family. So while a refresh is
// in flight every other request waits for it, and a refresh itself waits for requests already on the wire.
let rotation: Promise<unknown> = Promise.resolve();
let inFlight = 0;
let idle: (() => void) | null = null;
const settled = () => (inFlight === 0 ? Promise.resolve() : new Promise<void>(resolve => { const prev = idle; idle = () => { prev?.(); resolve(); }; }));

export const API_DEADLINE_MS = 35_000;

function withinDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new ApiError(0, "timeout", "The request timed out. Please try again. If this was an action, retry the same action to check its result safely."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

// Retain an uncertain command's exact envelope, including its ID and original
// version. Session storage preserves retries after a page reload, without tokens.
const pendingCommands = new Map<string, Record<string, unknown>>();
const pendingKey = (path: string) => `nc-pending-command:${path}`;
function commandBody(path: string, body: unknown): unknown {
  if (!body || typeof body !== "object" || !("command_id" in body)) return body;
  const proposed = body as Record<string, unknown>;
  let pending = pendingCommands.get(path);
  try { pending ??= JSON.parse(sessionStorage.getItem(pendingKey(path)) ?? "null") ?? undefined; } catch { /* Storage may be unavailable. */ }
  const intent = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "command_id" && key !== "expected_version")));
  if (pending && intent(pending) !== intent(proposed)) {
    throw new ApiError(0, "pending_command", "Your previous action has an unconfirmed result. Retry that same action before starting a different one.");
  }
  const envelope = pending ?? proposed;
  pendingCommands.set(path, envelope);
  try { sessionStorage.setItem(pendingKey(path), JSON.stringify(envelope)); } catch { /* Retain the in-memory copy. */ }
  return envelope;
}
function forgetCommand(path: string) {
  pendingCommands.delete(path);
  try { sessionStorage.removeItem(pendingKey(path)); } catch { /* Storage may be unavailable. */ }
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_DEADLINE_MS);
  const signal = controller.signal;
  try {
    const rotating = path === "/v1/auth/refresh";
    if (rotating) {
      const run = rotation.then(settled).then(() => request<T>(path, method, body, signal));
      rotation = withinDeadline(run, signal).catch(() => undefined);
      return await withinDeadline(run, signal);
    }
    // Register admission synchronously, ahead of a subsequently queued refresh.
    return await withinDeadline(rotation.then(async () => {
      inFlight++;
      try { return await request<T>(path, method, body, signal); }
      finally { if (--inFlight === 0) { const done = idle; idle = null; done?.(); } }
    }), signal);
  } finally { clearTimeout(timer); }
}

async function request<T>(path: string, method: string, body: unknown, signal: AbortSignal): Promise<T> {
  // A queued refresh may reach this callback after its own deadline expired.
  if (signal.aborted) return withinDeadline(Promise.resolve(undefined as T), signal);
  // Cooperation has a shared collection URL, so scope its pending envelope to
  // the case as well; an unrelated case must not inherit that command.
  const scope = body && typeof body === "object" && "case_id" in body ? `${path}:${body.case_id}` : path;
  body = commandBody(scope, body);
  const command = Boolean(body && typeof body === "object" && "command_id" in body);
  try {
    const response = await withinDeadline(fetch(`/api${path}`, {
      method,
      signal,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    }), signal);
    lastRequestId = response.headers.get("x-request-id") ?? lastRequestId;
    let data;
    try { data = await withinDeadline(response.json(), signal); }
    catch (error) {
      if (signal.aborted) throw error;
      if (response.ok) throw new ApiError(0, "invalid_response", "The service returned an unreadable response. Please try the same action again.");
      data = {};
    }
    if (!response.ok) {
      const error = new ApiError(response.status, data?.error ?? "error", data?.message ?? `Request failed (${response.status}). Please try again.`);
      if (command && !error.retryable) forgetCommand(scope);
      throw error;
    }
    if (command) forgetCommand(scope);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) return withinDeadline(Promise.resolve(undefined as T), signal);
    throw new ApiError(0, "network", "Cannot reach the service. Check your connection and try the same action again.");
  }
}

/** Restricted content operations. Only the lazily loaded content dashboard uses these; players never see them. */
export class ContentApi {
  role = () => call<ContentRoleResponse>("/v1/admin/catalogue/me");
  health = () => call<CatalogueHealth>("/v1/admin/catalogue/health");
  mission = (id: string) => call<MissionAdminDetails>(`/v1/admin/catalogue/missions/${encodeURIComponent(id)}`);
  validation = (id: string) => call<MissionValidation>(`/v1/admin/catalogue/missions/${encodeURIComponent(id)}/validation`);
  transition = (id: string, body: MissionTransitionRequest) => call<Message>(`/v1/admin/catalogue/missions/${encodeURIComponent(id)}/transition`, "POST", body);
}

export class Api {
  register = (body: RegisterRequest) => call<Message>("/v1/auth/register", "POST", body);
  confirm = (token: string) => call<Message>("/v1/auth/confirm", "POST", { token });
  resendConfirmation = (email: string) => call<Message>("/v1/auth/confirmation/resend", "POST", { email } satisfies ResendConfirmationRequest);
  login = (body: LoginRequest) => call<AuthResponse>("/v1/auth/login", "POST", body);
  me = () => call<AuthResponse>("/v1/auth/me");
  refresh = () => call<Message>("/v1/auth/refresh", "POST");
  logout = () => call<Message>("/v1/auth/logout", "POST");
  logoutAll = () => call<Message>("/v1/auth/logout-all", "POST");
  sessions = () => call<PlayerSession[]>("/v1/auth/sessions");
  revokeSession = (id: string) => call<Message>(`/v1/auth/sessions/${encodeURIComponent(id)}`, "DELETE");
  requestRecovery = (body: RecoveryRequest) => call<Message>("/v1/auth/recovery/request", "POST", body);
  completeRecovery = (body: RecoveryCompleteRequest) => call<Message>("/v1/auth/recovery/complete", "POST", body);

  profile = () => call<AuthResponse>("/v1/profile");
  updateProfile = (body: ProfileUpdate) => call<AuthResponse>("/v1/profile", "PUT", body);
  avatarOptions = () => call<AvatarCatalogue>("/v1/avatar/options");
  avatarProfile = () => call<AvatarProfile>("/v1/profile/avatar");
  selectAvatar = (avatarId: string) => call<AvatarProfile>("/v1/profile/avatar", "PUT", { avatar_id: avatarId } satisfies AvatarSelectionRequest);
  dossierOptions = () => call<DossierOptions>("/v1/dossier/options");

  progression = () => call<ProgressionSummary>("/v1/progression/summary");
  archive = () => call<CaseArchiveEntry[]>("/v1/progression/archive");
  achievementCatalog = async () => (await call<{ achievements: AchievementDef[] }>("/v1/progression/achievement-catalog")).achievements;

  /** The server picks the mission and generates the case id and seed; the body is deliberately empty. */
  assign = () => call<CaseResponse>("/v1/cases", "POST", {} satisfies AssignCaseRequest);
  currentCase = () => call<CurrentCaseResponse>("/v1/cases/current");
  currentActivity = () => call<CurrentActivityResponse>("/v1/activity/current");
  abandonCase = (caseId: string, expectedVersion: number) =>
    call<AbandonCaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}/abandon`, "POST", { expected_version: expectedVersion } satisfies AbandonCaseRequest);
  replay = (missionId: string) => call<CaseResponse>("/v1/cases/replay", "POST", { mission_id: missionId } satisfies ReplayCaseRequest);
  catalogueStatus = () => call<CatalogueProgress>("/v1/cases/catalogue-status");
  load = (caseId: string) => call<CaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}`);
  caseAccounts = (caseId: string) => call<WitnessAccountsResponse>(`/v1/cases/${encodeURIComponent(caseId)}/accounts`);
  createGroup = (name: string, capacity?: number) => call<{ group_id: string }>("/v1/groups", "POST", capacity ? { name, capacity } : { name });
  group = (id: string) => call<PlayerGroup>(`/v1/groups/${encodeURIComponent(id)}`);
  invite = (groupId: string, username: string) => call<{ invitation_id: string }>(`/v1/groups/${encodeURIComponent(groupId)}/invitations`, "POST", { username });
  invitations = () => call<GroupInvitation[]>("/v1/group-invitations");
  answerInvitation = (id: string, accept: boolean) => call<{ accepted: boolean }>(`/v1/groups/invitations/${encodeURIComponent(id)}`, "POST", { accept });
  setMemberRole = (groupId: string, playerId: string, role: "admin" | "member") => call<Message>(`/v1/groups/${encodeURIComponent(groupId)}/members`, "POST", { player_id: playerId, role });
  removeMember = (groupId: string, playerId: string) => call<Message>(`/v1/groups/${encodeURIComponent(groupId)}/members`, "POST", { player_id: playerId });
  leaveGroup = (groupId: string) => call<Message>(`/v1/groups/${encodeURIComponent(groupId)}/leave`, "POST", {});
  transferOwnership = (groupId: string, playerId: string) => call<Message>(`/v1/groups/${encodeURIComponent(groupId)}/transfer-ownership`, "POST", { player_id: playerId });
  deleteGroup = (groupId: string) => call<Message>(`/v1/groups/${encodeURIComponent(groupId)}/delete`, "POST", {});
  weeklyCurrent = (groupId: string) => call<WeeklyCurrent>(`/v1/groups/${encodeURIComponent(groupId)}/weekly/current`);
  startAttempt = (challengeId: string) => call<{ attempt_id: string }>(`/v1/weekly/${encodeURIComponent(challengeId)}/attempt`, "POST", {});
  attempt = (attemptId: string) => call<WeeklyAttempt>(`/v1/weekly/attempts/${encodeURIComponent(attemptId)}`);
  attemptCommand = (attemptId: string, version: number, command: ClientCommand) =>
    call<WeeklyAttempt | TransitReply>(`/v1/weekly/attempts/${encodeURIComponent(attemptId)}/commands`, "POST", { command_id: crypto.randomUUID(), expected_version: version, command } satisfies ExecuteRequest);
  weeklyQuotes = (attemptId: string) => call<TransportQuote[]>(`/v1/weekly/attempts/${encodeURIComponent(attemptId)}/transport-quotes`);
  weeklyAccounts = (attemptId: string) => call<GameEvent[]>(`/v1/weekly/attempts/${encodeURIComponent(attemptId)}/accounts`);
  weekly = (challengeId: string) => call<WeeklyDetails & { standings: Standing[] }>(`/v1/weekly/${encodeURIComponent(challengeId)}`);
  weeklyEvents = (challengeId: string) => call<WeeklyEvent[]>(`/v1/weekly/${encodeURIComponent(challengeId)}/events`);
  cancelChallenge = (challengeId: string, reason: string) => call<Message>(`/v1/weekly/${encodeURIComponent(challengeId)}/cancel`, "POST", { reason });
  weeklyHistory = () => call<WeeklyHistoryEntry[]>("/v1/weekly/history");
  weeklyNotifications = () => call<WeeklyNotification[]>("/v1/weekly/notifications");
  setWeeklyNotifications = (web: boolean, email: boolean) => call<Message>("/v1/weekly/notifications", "PUT", { web, email });
  coopPreferences = () => call<CooperationPreferences>("/v1/cooperation/preferences");
  setCoopPreferences = (body: { enabled: boolean; email_enabled: boolean }) => call<CooperationPreferences>("/v1/cooperation/preferences", "PUT", body);
  coopRequests = () => call<CooperationRequest[]>("/v1/cooperation/requests");
  askForHelp = (body: CreateCooperationRequest) => call<{ request_id: string; status: string; expires_in_seconds: number }>("/v1/cooperation/requests", "POST", body);
  coopAccept = (id: string) => call<Message>(`/v1/cooperation/requests/${encodeURIComponent(id)}/accept`, "POST", {});
  coopDecline = (id: string) => call<Message>(`/v1/cooperation/requests/${encodeURIComponent(id)}/decline`, "POST", {});
  coopAcknowledge = (id: string) => call<Message>(`/v1/cooperation/requests/${encodeURIComponent(id)}/acknowledge`, "POST", {});
  coopComplete = (id: string, body: CompleteCooperationRequest) => call<Message>(`/v1/cooperation/requests/${encodeURIComponent(id)}/complete`, "POST", body);
  blocks = () => call<[string, string][]>("/v1/cooperation/blocks");
  block = (username: string) => call<Message>("/v1/cooperation/blocks", "POST", { username });
  unblock = (playerId: string) => call<Message>(`/v1/cooperation/blocks/${encodeURIComponent(playerId)}`, "DELETE");
  report = (body: CooperationReportRequest) => call<Message>("/v1/cooperation/reports", "POST", body);
  reputation = () => call<{ reputation: number }>("/v1/cooperation/reputation");
  releaseNotifications = () => call<ReleaseNotification[]>("/v1/cases/catalogue-notifications");
  readRelease = (id: number) => call<Message>(`/v1/cases/catalogue-notifications/${id}/read`, "POST", {});
  quotes = (caseId: string) => call<TransportQuote[]>(`/v1/cases/${encodeURIComponent(caseId)}/transport-quotes`);
  ledger = (caseId: string) => call<TransportLedgerEntry[]>(`/v1/cases/${encodeURIComponent(caseId)}/ledger`);
  assistantRoutes = (caseId: string) => call<AssistantRoutesResponse>(`/v1/cases/${encodeURIComponent(caseId)}/assistant/routes`);
  tokenBalance = () => call<TokenBalance>("/v1/economy/bribe-tokens");
  tokenLedger = () => call<TokenLedgerEntry[]>("/v1/economy/bribe-tokens/ledger");
  discipline = () => call<DisciplinaryCase[]>("/v1/discipline");
  acknowledgeDiscipline = (id: string) => call<Message>(`/v1/discipline/${encodeURIComponent(id)}/acknowledge`, "POST", {});
  pressureAttempts = (caseId: string) => call<PressureAttemptRecord[]>(`/v1/cases/${encodeURIComponent(caseId)}/pressure-attempts`);
  jail = () => call<JailStatus>("/v1/discipline/jail");
  pressure = (caseId: string, body: PressureWitnessRequest) => call<PressureResult>(`/v1/cases/${encodeURIComponent(caseId)}/pressure`, "POST", body);
  command = (caseId: string, version: number, command: ClientCommand) =>
    call<CaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}/commands`, "POST", {
      command_id: crypto.randomUUID(), expected_version: version, command
    } satisfies ExecuteRequest);
}
