/** Explicitly opted-in, first-party measurement. No routes, fingerprints or passwords. */
export type UsageChoice = "yes" | "no" | null;
type UsageEvent = { kind: "visit" | "registration_start"; email?: string };
type UsageEnvironment = {
  choice: () => UsageChoice;
  saveChoice: (choice: "yes" | "no") => void;
  send: (event: UsageEvent | null) => Promise<unknown>;
  visible: () => boolean;
};

export function createUsageTracker(environment: UsageEnvironment) {
  let queue: Promise<unknown> = Promise.resolve();
  let registrationOpen = false;
  let lastEmail = "";
  let localChoice: UsageChoice | undefined;
  const allowed = () => (localChoice === undefined ? environment.choice() : localChoice) === "yes";
  const send = (event: UsageEvent | null) => {
    // Serialize initial cookie creation, signup events and consent withdrawal.
    queue = queue.catch(() => undefined).then(async () => {
      if (event && !allowed()) return;
      const result = await environment.send(event);
      // Another tab can withdraw while our first response creates its cookie.
      // Delete again after that response, when the browser now has its token.
      if (event && !allowed()) await environment.send(null);
      return result;
    }).catch(() => undefined);
    return queue;
  };
  return {
    visit() { if (allowed() && environment.visible()) return send({ kind: "visit" }); },
    registrationStarted() {
      registrationOpen = true;
      if (allowed()) return send({ kind: "registration_start" });
    },
    registrationClosed() { registrationOpen = false; },
    syncChoice(choice: UsageChoice) { localChoice = choice === environment.choice() ? undefined : choice; lastEmail = ""; },
    registrationEmail(value: string) {
      if (!allowed()) return;
      const email = value.trim().toLowerCase();
      if (email === lastEmail || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      lastEmail = email;
      return send({ kind: "registration_start", email });
    },
    setChoice(choice: "yes" | "no") {
      environment.saveChoice(choice);
      localChoice = environment.choice() === choice ? undefined : choice;
      lastEmail = "";
      if (choice === "no") return send(null);
      if (environment.visible()) void send({ kind: "visit" });
      if (registrationOpen) return send({ kind: "registration_start" });
      return queue;
    },
  };
}

export function getUsageChoice(): UsageChoice {
  try {
    const choice = localStorage.getItem("nc-usage-consent");
    return choice === "yes" || choice === "no" ? choice : null;
  } catch { return null; }
}

export const usage = createUsageTracker({
  choice: getUsageChoice,
  saveChoice(choice) { try { localStorage.setItem("nc-usage-consent", choice); } catch { /* Storage blocked: measurement remains off. */ } },
  visible: () => document.visibilityState === "visible",
  send: event => fetch("/api/v1/telemetry/usage", {
    method: event ? "POST" : "DELETE",
    headers: event ? { "Content-Type": "application/json" } : undefined,
    body: event ? JSON.stringify(event) : undefined,
    credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(5_000),
  }),
});

export function installUsageReporting() {
  void usage.visit();
  const timer = window.setInterval(() => { void usage.visit(); }, 60_000);
  const visible = () => { void usage.visit(); };
  document.addEventListener("visibilitychange", visible);
  const changed = (event: StorageEvent) => {
    if (event.key === "nc-usage-consent" || event.key === null) usage.syncChoice(getUsageChoice());
  };
  window.addEventListener("storage", changed);
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("storage", changed); };
}
