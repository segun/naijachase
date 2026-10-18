import { getLastRequestId } from "./api/api.ts";

declare const __NAIJACHASE_RELEASE__: string;

const cleanLocation = () => `${location.origin}${location.pathname}`;
const cleanSource = (value: string) => {
  try { const parsed = new URL(value, location.origin); return `${parsed.origin}${parsed.pathname}`; }
  catch { return value.split(/[?#]/, 1)[0] ?? ""; }
};
const text = (value: unknown) => value instanceof Error ? value.message : String(value);
const stack = (value: unknown) => value instanceof Error ? (value.stack ?? "") : "";

export function reportBrowserError(error: unknown, source = "application") {
  const body = JSON.stringify({
    message: text(error).slice(0, 1_000),
    stack: stack(error).slice(0, 8_000),
    route: cleanLocation().slice(0, 512),
    source: cleanSource(source).slice(0, 512),
    release: (typeof __NAIJACHASE_RELEASE__ === "string" ? __NAIJACHASE_RELEASE__ : "unknown").slice(0, 128),
    api_request_id: getLastRequestId()
  });
  try {
    if (!navigator.sendBeacon("/api/v1/telemetry/browser-errors", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/v1/telemetry/browser-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "include", keepalive: true });
    }
  } catch { /* Reporting must never crash the game or recursively report itself. */ }
}

export function installBrowserErrorReporting() {
  window.addEventListener("error", event => reportBrowserError(event.error ?? event.message, event.filename || "window.error"));
  window.addEventListener("unhandledrejection", event => reportBrowserError(event.reason, "unhandledrejection"));
}
