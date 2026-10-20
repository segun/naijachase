import type { AuditList, Overview, Period, Registrations, RegistrationStatus, Session, StaffAccount, StaffList, StaffRole, SystemInfo } from "./types.ts";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status; }
}

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
function integer(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function numeric(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function health(value: unknown) { return value === "healthy" || value === "unavailable" || value === "not_configured"; }
function nullableNumber(value: unknown) { return value === null || numeric(value); }
function validated<T>(value: unknown, valid: boolean): T {
  if (!valid) throw new ApiError("The admin service returned an unexpected response. Refresh or check that both admin components use the same release.", 0);
  return value as T;
}
function staffRole(value: unknown) { return value === "owner" || value === "operator" || value === "viewer"; }
function sessionResponse(value: unknown): Session {
  return validated(value, record(value) && typeof value.username === "string" && value.username.length > 0
    && integer(value.account_id) && staffRole(value.role) && typeof value.is_bootstrap === "boolean"
    && Array.isArray(value.permissions) && value.permissions.every(permission => typeof permission === "string"));
}
function staffAccount(value: unknown): value is StaffAccount {
  return record(value) && integer(value.account_id) && typeof value.username === "string" && staffRole(value.role)
    && typeof value.enabled === "boolean" && typeof value.is_bootstrap === "boolean" && timestamp(value.created_at) && timestamp(value.updated_at);
}
function staffResponse(value: unknown): StaffList {
  return validated(value, record(value) && Array.isArray(value.accounts) && value.accounts.every(staffAccount) && typeof value.bootstrap_retired === "boolean");
}
function auditResponse(value: unknown): AuditList {
  return validated(value, record(value) && integer(value.page) && integer(value.page_size) && integer(value.total)
    && Array.isArray(value.entries) && value.entries.every(entry => record(entry) && integer(entry.id)
      && (entry.actor_id === null || integer(entry.actor_id)) && ["actor_username", "action", "target", "outcome", "reason"].every(key => typeof entry[key] === "string") && timestamp(entry.created_at)));
}
function overviewResponse(value: unknown): Overview {
  if (!record(value)) return validated(value, false);
  const metricKeys = ["registered_users", "verified_users", "online_users", "visitors", "registration_starts", "accounts_created", "registrations_completed", "abandoned_registrations", "pending_verification"];
  const validMetrics = record(value.metrics) && metricKeys.every(key => integer((value.metrics as RecordValue)[key]));
  const validDaily = Array.isArray(value.daily) && value.daily.every(row => record(row) && typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && ["visitors", "registration_starts", "accounts_created", "registrations_completed"].every(key => integer(row[key])));
  return validated(value, timestamp(value.generated_at) && integer(value.period_days) && validDaily && (value.available === true ? validMetrics : value.available === false && value.metrics === null));
}
function registrationsResponse(value: unknown): Registrations {
  if (!record(value)) return validated(value, false);
  const validItems = Array.isArray(value.items) && value.items.every(row => record(row) && typeof row.email === "string" && timestamp(row.started_at) && timestamp(row.updated_at) && ["abandoned", "pending", "completed"].includes(String(row.status)) && typeof row.account_created === "boolean" && typeof row.email_verified === "boolean");
  return validated(value, timestamp(value.generated_at) && integer(value.period_days) && integer(value.page) && integer(value.page_size) && validItems && (value.available === true ? integer(value.total) : value.available === false && value.total === null));
}
function systemResponse(value: unknown): SystemInfo {
  if (!record(value) || !record(value.host) || !record(value.database) || !record(value.application_api) || !record(value.email_queue)) return validated(value, false);
  const host = value.host;
  const validHost = (host.hostname === null || typeof host.hostname === "string") && typeof host.disk_path === "string" && ["disk_total_bytes", "disk_available_bytes", "memory_total_bytes", "memory_available_bytes", "swap_total_bytes", "swap_free_bytes", "cpu_count", "uptime_seconds"].every(key => nullableNumber(host[key])) && (host.load_average === null || Array.isArray(host.load_average) && host.load_average.length === 3 && host.load_average.every(numeric));
  const validQueue = health(value.email_queue.status) && ["queued", "sending", "failed", "sent"].every(key => nullableNumber((value.email_queue as RecordValue)[key]));
  return validated(value, timestamp(value.collected_at) && value.scope === "admin_host" && validHost && health(value.database.status) && health(value.application_api.status) && validQueue);
}

async function request<T>(path: string, options: RequestInit = {}, allowUnavailable = false): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/admin-api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
      signal: controller.signal
    });
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (allowUnavailable && response.status === 503 && typeof payload === "object" && payload !== null && "available" in payload && payload.available === false) return payload as T;
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "The admin service could not complete this request.";
      throw new ApiError(message, response.status);
    }
    if (payload === null) throw new ApiError("The admin service returned an unreadable response.", response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ApiError("The request timed out. Check the admin service and try again.", 0);
    throw new ApiError("Could not reach the admin service. Check your connection and try again.", 0);
  } finally { clearTimeout(timeout); }
}

export const api = {
  session: () => request<unknown>("/session").then(sessionResponse),
  login: (username: string, password: string) => request<unknown>("/session", { method: "POST", body: JSON.stringify({ username, password }) }).then(sessionResponse),
  logout: () => request<void>("/session", { method: "DELETE" }),
  overview: (days: Period) => request<unknown>(`/overview?days=${days}`, {}, true).then(overviewResponse),
  registrations: (days: Period, status: RegistrationStatus, page: number) => request<unknown>(`/registrations?days=${days}&status=${status}&page=${page}&page_size=25`, {}, true).then(registrationsResponse),
  system: () => request<unknown>("/system").then(systemResponse),
  staff: () => request<unknown>("/staff").then(staffResponse),
  createStaff: (username: string, password: string, role: StaffRole, reason: string) => request<unknown>("/staff", { method: "POST", body: JSON.stringify({ username, password, role, reason }) }).then(value => validated<StaffAccount>(value, staffAccount(value))),
  updateStaff: (accountId: number, changes: { role?: StaffRole; enabled?: boolean; password?: string; reason: string }) => request<unknown>(`/staff/${accountId}`, { method: "PATCH", body: JSON.stringify(changes) }).then(value => validated<StaffAccount>(value, staffAccount(value))),
  audit: (page: number) => request<unknown>(`/audit?page=${page}&page_size=25`).then(auditResponse)
};
