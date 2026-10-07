import type {
  AuthResponse, CaseArchiveEntry, CaseResponse, ClientCommand, CreateCaseRequest, ExecuteRequest,
  LoginRequest, PlayerSession, ProfileUpdate, ProgressionSummary, RecoveryCompleteRequest,
  RecoveryRequest, RegisterRequest
} from "../../contracts/typescript/api-v1.ts";
import type { AchievementDef } from "./model.ts";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

type Message = { message?: string };

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the service. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? "error", data.message ?? `Request failed (${response.status})`);
  }
  return data as T;
}

export class Api {
  register = (body: RegisterRequest) => call<Message>("/v1/auth/register", "POST", body);
  confirm = (token: string) => call<Message>("/v1/auth/confirm", "POST", { token });
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

  progression = () => call<ProgressionSummary>("/v1/progression/summary");
  archive = () => call<CaseArchiveEntry[]>("/v1/progression/archive");
  achievementCatalog = async () => (await call<{ achievements: AchievementDef[] }>("/v1/progression/achievement-catalog")).achievements;

  create = (caseId: string, missionId: string) => call<CaseResponse>("/v1/cases", "POST", { case_id: caseId, mission_id: missionId, seed: Date.now() } satisfies CreateCaseRequest);
  load = (caseId: string) => call<CaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}`);
  command = (caseId: string, version: number, command: ClientCommand) =>
    call<CaseResponse>(`/v1/cases/${encodeURIComponent(caseId)}/commands`, "POST", {
      command_id: crypto.randomUUID(), expected_version: version, command
    } satisfies ExecuteRequest);
}
