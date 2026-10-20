import type { Session } from "./types.ts";

export const NAVIGATION = [
  { id: "overview", label: "Overview", icon: "overview", permission: "overview:read" },
  { id: "registrations", label: "Registrations", icon: "users", permission: "registrations:read" },
  { id: "accounts", label: "Account support", icon: "users", permission: "accounts:read" },
  { id: "analytics", label: "Product reports", icon: "overview", permission: "analytics:read" },
  { id: "alerts", label: "Alerts", icon: "health", permission: "alerts:read" },
  { id: "moderation", label: "Moderation", icon: "lock", permission: "moderation:read" },
  { id: "system", label: "System health", icon: "server", permission: "system:read" },
  { id: "staff", label: "Staff accounts", icon: "users", permission: "staff:manage" },
  { id: "audit", label: "Audit history", icon: "clock", permission: "audit:read" },
] as const;
export type Tab = typeof NAVIGATION[number]["id"];
export const can = (session: Session | null, permission: string) => session?.permissions.includes(permission) === true;
export const navigationFor = (session: Session | null) => NAVIGATION.filter(item => can(session, item.permission));
