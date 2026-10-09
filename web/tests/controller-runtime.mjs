import fs from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { compileModule } from "svelte/compiler";

// Execute the actual rune-bearing controllers, not extracted methods or source regexes.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(url)) return { url: url.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    let source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
    }).outputText;
    if (url.endsWith(".svelte.ts")) source = compileModule(source, { filename, generate: "client" }).js.code;
    return { format: "module", source, shortCircuit: true };
  }
});

export function storage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
    clear: () => entries.clear()
  };
}

globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
globalThis.document = { querySelector: () => null };
globalThis.window = { scrollTo() {} };
globalThis.location = { hash: "" };

export const { AppController } = await import("../src/state/app.svelte.ts");
export const { ApiError } = await import("../src/api/api.ts");

export function controller() {
  sessionStorage.clear();
  const app = new AppController();
  app.toast = (text, kind = "info") => { app.toasts = [...app.toasts, { id: app.toasts.length, text, kind }]; };
  app.api.quotes = async () => [];
  app.api.progression = async () => ({ points: 1200, rank: "Investigator", achievements: [], visited_states: [] });
  app.api.archive = async () => [];
  app.api.achievementCatalog = async () => [];
  app.api.catalogueStatus = async () => ({ published_cases: 10, completed_cases: 1, unseen_cases: 9, exhausted: false });
  app.loadReleases = async () => {};
  app.loadCoop = async () => {};
  app.groups.load = async () => {};
  return app;
}

export const activity = (ordinary = null, replays = []) => ({
  has_ongoing_activity: Boolean(ordinary || replays.length),
  ordinary_case: ordinary, replay_cases: replays, weekly_attempts: []
});

export function caseFile(id = "case-one", overrides = {}) {
  return {
    api_version: "v1", case_id: id, state_version: 1, duplicate: false, attempt_kind: "ordinary", events: [],
    state: {
      mission_id: "NG-M0001", case_dossier: { title: "The first case" }, outcome: null,
      stage: 0, current_state: "Lagos", trail_status: "hot", elapsed: 0, score: 800, career_points: 1200,
      dossier: {}, visited_venues: [], warrant_suspect: null, balance: 6000
    },
    ...overrides
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
