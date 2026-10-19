import { getLastRequestId } from "./api/api.ts";

declare const __NAIJACHASE_RELEASE__: string;

const cleanLocation = () => `${location.origin}${location.pathname}`;
const cleanSource = (value: string) => {
  try { const parsed = new URL(value, location.origin); return `${parsed.origin}${parsed.pathname}`; }
  catch { return value.split(/[?#]/, 1)[0] ?? ""; }
};
const text = (value: unknown) => value instanceof Error ? value.message : String(value);
const stack = (value: unknown) => value instanceof Error ? (value.stack ?? "") : "";

type PerformanceValue = string | number | boolean;
type PerformanceEvent = { kind: string; [key: string]: PerformanceValue };
const performanceQueue: PerformanceEvent[] = [];
let performanceTimer: number | undefined;

const connection = () => (navigator as Navigator & {
  connection?: { effectiveType?: string; saveData?: boolean };
}).connection;
const deviceClass = () => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if ((memory !== undefined && memory <= 2) || cores <= 2) return "low";
  if ((memory !== undefined && memory <= 4) || cores <= 4) return "mid";
  return "high";
};
const context = () => ({
  device_class: deviceClass(),
  connection_type: connection()?.effectiveType ?? "unknown",
  save_data: connection()?.saveData === true,
  viewport_class: innerWidth < 600 ? "small" : innerWidth < 1024 ? "medium" : "large"
});

function sendPerformanceEvents() {
  if (performanceTimer !== undefined) window.clearTimeout(performanceTimer);
  performanceTimer = undefined;
  if (!performanceQueue.length) return;
  const body = JSON.stringify({
    release: typeof __NAIJACHASE_RELEASE__ === "string" ? __NAIJACHASE_RELEASE__.slice(0, 128) : "unknown",
    route: cleanLocation().slice(0, 512),
    events: performanceQueue.splice(0, 20)
  });
  try {
    if (!navigator.sendBeacon("/api/v1/telemetry/performance", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/v1/telemetry/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "include", keepalive: true, signal: AbortSignal.timeout(35_000) }).catch(() => undefined);
    }
  } catch { /* Measurements must never affect play. */ }
}

/** Bounded, coarse performance data only: never pass player IDs, case text, or a device fingerprint. */
export function reportPerformanceEvent(event: PerformanceEvent) {
  performanceQueue.push({ ...event, ...context() });
  if (performanceQueue.length >= 20) sendPerformanceEvents();
  else performanceTimer ??= window.setTimeout(sendPerformanceEvents, 5_000);
}

export function reportSceneFallback(scene: string, reason: string) {
  reportPerformanceEvent({ kind: "scene_fallback", scene: scene.slice(0, 64), reason: reason.slice(0, 128) });
}

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
      void fetch("/api/v1/telemetry/browser-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "include", keepalive: true, signal: AbortSignal.timeout(35_000) }).catch(() => undefined);
    }
  } catch { /* Reporting must never crash the game or recursively report itself. */ }
}

export function installBrowserErrorReporting() {
  window.addEventListener("error", event => reportBrowserError(event.error ?? event.message, event.filename || "window.error"));
  window.addEventListener("unhandledrejection", event => reportBrowserError(event.reason, "unhandledrejection"));
}

export function installPerformanceReporting() {
  const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver(list => list.getEntries().forEach(callback));
      observer.observe({ type, buffered: true });
      return observer;
    } catch { return null; }
  };
  let cls = 0;
  const observers = [
    observe("paint", entry => { if (entry.name === "first-contentful-paint") reportPerformanceEvent({ kind: "web_vital", metric: "FCP", value_ms: Math.round(entry.startTime) }); }),
    observe("largest-contentful-paint", entry => reportPerformanceEvent({ kind: "web_vital", metric: "LCP", value_ms: Math.round(entry.startTime) })),
    observe("layout-shift", entry => {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      if (!shift.hadRecentInput) cls += shift.value ?? 0;
    }),
    observe("event", entry => {
      const event = entry as PerformanceEntry & { interactionId?: number; duration: number };
      if (event.interactionId && event.duration >= 40) reportPerformanceEvent({ kind: "web_vital", metric: "INP", value_ms: Math.round(event.duration) });
    })
  ].filter(Boolean) as PerformanceObserver[];
  const flush = () => {
    reportPerformanceEvent({ kind: "web_vital", metric: "CLS", value: Math.round(cls * 1_000) / 1_000 });
    sendPerformanceEvents();
  };
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  return () => { observers.forEach(observer => observer.disconnect()); removeEventListener("pagehide", flush); };
}
