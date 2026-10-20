import { ApiError } from "./api.ts";

export type Account = { player_id: string; email: string; username: string | null; display_name: string; home_base: string | null; created_at: string; email_verified_at: string | null; last_seen_at: string | null; points: number; active_sessions: number; completed_cases: number; solved_cases: number };
export type Page<T> = { generated_at: string; page: number; page_size: number; total: number; items: T[] };
export type Case = { case_id: string; mission_id: string | null; started_at: string | null; completed_at: string | null; outcome: string | null; attempt_kind: string };
export type AccountDetail = { account: Account; cases: Case[]; security_events: { id: number; event_type: string; outcome: string; created_at: string }[]; notes: { id: number; staff: string; reason: string; created_at: string }[]; support_actions: { id: string; action: string; status: string; reason: string; completed_at: string | null }[] };
export type Analytics = { generated_at: string; period_days: number; activation: { accounts_created: number; email_verified: number; started_case: number; completed_case: number; solved_case: number }; activity: { dau: number; wau: number; mau: number; coverage_started_at: string | null; scope: string }; case_starts: number; case_outcomes: { outcome: string; count: number }[]; daily_activity: { date: string; accounts: number }[]; retention: { date: string; cohort: number; day1_eligible: number; day1_returned: number; day7_eligible: number; day7_returned: number; day30_eligible: number; day30_returned: number }[]; definitions: { activation: string; case_outcomes: string; retention: string } };
export type Severity = "healthy" | "warning" | "critical" | "unknown" | "not_configured";
export type Alerts = { generated_at: string; scope: string; items: { key: string; severity: Severity; title: string; message: string; value: unknown }[] };
export type Report = { report_id: string; reporter_id: string; reporter_username: string | null; reported_id: string; reported_username: string | null; category: string; details: string | null; source_status: string; status: "open" | "escalated" | "resolved"; created_at: string; resolution: { report_id: string; decision: string; reason: string; staff: string; updated_at: string } | null };

type RecordValue = Record<string, unknown>;
function object(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string"; }
function nullable(value: unknown): value is string | null { return value === null || text(value); }
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function array(value: unknown, check: (item: unknown) => boolean) { return Array.isArray(value) && value.every(check); }
function hasStrings(value: RecordValue, keys: string[]) { return keys.every(key => text(value[key])); }
function hasCounts(value: RecordValue, keys: string[]) { return keys.every(key => count(value[key])); }
function account(value: unknown) { return object(value) && hasStrings(value, ["player_id", "email", "display_name", "created_at"]) && ["username", "home_base", "email_verified_at", "last_seen_at"].every(key => nullable(value[key])) && hasCounts(value, ["points", "active_sessions", "completed_cases", "solved_cases"]); }
function page(value: unknown, item: (row: unknown) => boolean) { return object(value) && text(value.generated_at) && hasCounts(value, ["page", "page_size", "total"]) && array(value.items, item); }
function detail(value: unknown) { return object(value) && account(value.account) && array(value.cases, row => object(row) && hasStrings(row, ["case_id", "attempt_kind"]) && ["mission_id", "started_at", "completed_at", "outcome"].every(key => nullable(row[key]))) && array(value.notes, row => object(row) && count(row.id) && hasStrings(row, ["staff", "reason", "created_at"])) && array(value.support_actions, row => object(row) && hasStrings(row, ["id", "action", "status", "reason"]) && nullable(row.completed_at)) && array(value.security_events, row => object(row) && count(row.id) && hasStrings(row, ["event_type", "outcome", "created_at"])); }
function analytics(value: unknown) { return object(value) && text(value.generated_at) && count(value.period_days) && object(value.activation) && hasCounts(value.activation, ["accounts_created", "email_verified", "started_case", "completed_case", "solved_case"]) && object(value.activity) && hasCounts(value.activity, ["dau", "wau", "mau"]) && nullable(value.activity.coverage_started_at) && text(value.activity.scope) && count(value.case_starts) && array(value.case_outcomes, row => object(row) && text(row.outcome) && count(row.count)) && array(value.daily_activity, row => object(row) && text(row.date) && count(row.accounts)) && array(value.retention, row => object(row) && text(row.date) && hasCounts(row, ["cohort", "day1_eligible", "day1_returned", "day7_eligible", "day7_returned", "day30_eligible", "day30_returned"])) && object(value.definitions) && hasStrings(value.definitions, ["activation", "case_outcomes", "retention"]); }
function alerts(value: unknown) { return object(value) && hasStrings(value, ["generated_at", "scope"]) && array(value.items, row => object(row) && hasStrings(row, ["key", "title", "message"]) && ["healthy", "warning", "critical", "unknown", "not_configured"].includes(String(row.severity))); }
function report(value: unknown) { return object(value) && hasStrings(value, ["report_id", "reporter_id", "reported_id", "category", "source_status", "created_at"]) && ["reporter_username", "reported_username", "details"].every(key => nullable(value[key])) && ["open", "escalated", "resolved"].includes(String(value.status)) && (value.resolution === null || object(value.resolution) && hasStrings(value.resolution, ["report_id", "decision", "reason", "staff", "updated_at"])); }
async function request<T>(path: string, check: (value: unknown) => boolean, body?: unknown): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/admin-api/v1${path}`, { credentials: "same-origin", cache: "no-store", method: body === undefined ? "GET" : "POST", headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(object(payload) && text(payload.error) ? payload.error : object(payload) && text(payload.message) ? payload.message : "The admin service could not complete the request.", response.status);
    if (!check(payload)) throw new ApiError("The admin service returned an unexpected response. Refresh or check that the admin components use the same release.", 0);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error && error.name === "AbortError" ? "The request timed out. Refresh before retrying any support action." : "Could not reach the admin service. Check your connection.", 0);
  } finally { clearTimeout(timeout); }
}
const saved = (value: unknown) => object(value) && value.status === "saved";
export const operations = {
  accounts: (search: string, pageNumber: number) => request<Page<Account>>(`/accounts?search=${encodeURIComponent(search)}&page=${pageNumber}&page_size=25`, value => page(value, account)),
  account: (id: string) => request<AccountDetail>(`/accounts/${encodeURIComponent(id)}`, detail),
  note: (id: string, reason: string) => request<{ status: "saved" }>(`/accounts/${encodeURIComponent(id)}/notes`, saved, { reason }),
  revoke: (id: string, reason: string) => request<{ status: "succeeded"; message: string }>(`/accounts/${encodeURIComponent(id)}/revoke-sessions`, value => object(value) && value.status === "succeeded" && text(value.message), { reason }),
  analytics: (days: number) => request<Analytics>(`/analytics?days=${days}`, analytics),
  alerts: () => request<Alerts>("/alerts", alerts),
  moderation: (status: string, pageNumber: number) => request<Page<Report>>(`/moderation?status=${encodeURIComponent(status)}&page=${pageNumber}&page_size=25`, value => page(value, report)),
  resolve: (id: string, decision: string, reason: string) => request<{ status: "saved" }>(`/moderation/${encodeURIComponent(id)}/resolve`, saved, { decision, reason })
};
