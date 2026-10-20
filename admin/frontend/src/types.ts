export type Period = 7 | 30 | 90;
export type RegistrationStatus = "abandoned" | "pending" | "all";
export interface Metrics {
  registered_users: number;
  verified_users: number;
  online_users: number;
  visitors: number;
  registration_starts: number;
  accounts_created: number;
  registrations_completed: number;
  abandoned_registrations: number;
  pending_verification: number;
}
export interface DailyMetric {
  date: string;
  visitors: number;
  registration_starts: number;
  accounts_created: number;
  registrations_completed: number;
}
export interface Overview {
  generated_at: string;
  period_days: number;
  available: boolean;
  metrics: Metrics | null;
  daily: DailyMetric[];
  unavailable_reason: string | null;
  tracking_started_at?: string | null;
}
export interface Registration {
  email: string;
  started_at: string;
  updated_at: string;
  status: "abandoned" | "pending" | "completed";
  account_created: boolean;
  email_verified: boolean;
}
export interface Registrations {
  generated_at: string;
  available: boolean;
  period_days: number;
  page: number;
  page_size: number;
  total: number | null;
  items: Registration[];
  unavailable_reason: string | null;
}
export type HealthStatus = "healthy" | "unavailable" | "not_configured";
export interface SystemInfo {
  collected_at: string;
  scope: "admin_host";
  host: {
    hostname: string | null;
    disk_path: string;
    disk_total_bytes: number | null;
    disk_available_bytes: number | null;
    memory_total_bytes: number | null;
    memory_available_bytes: number | null;
    swap_total_bytes: number | null;
    swap_free_bytes: number | null;
    load_average: [number, number, number] | null;
    cpu_count: number | null;
    uptime_seconds: number | null;
  };
  database: { status: HealthStatus };
  application_api: { status: HealthStatus };
  email_queue: { status: HealthStatus; queued: number | null; sending: number | null; failed: number | null; sent: number | null };
}
export type StaffRole = "owner" | "operator" | "viewer";
export interface Session {
  username: string;
  account_id: number;
  role: StaffRole;
  is_bootstrap: boolean;
  permissions: string[];
}
export interface StaffAccount {
  account_id: number;
  username: string;
  role: StaffRole;
  enabled: boolean;
  is_bootstrap: boolean;
  created_at: string;
  updated_at: string;
}
export interface StaffList { accounts: StaffAccount[]; bootstrap_retired: boolean }
export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_username: string;
  action: string;
  target: string;
  outcome: string;
  reason: string;
  created_at: string;
}
export interface AuditList { entries: AuditEntry[]; page: number; page_size: number; total: number }
