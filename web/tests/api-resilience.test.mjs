import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const entries = new Map();
globalThis.sessionStorage = {
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: key => entries.delete(key)
};
const source = ts.transpileModule(fs.readFileSync(new URL("../src/api/api.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
}).outputText;
let serial = 0;
const fresh = () => import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${++serial}`).toString("base64")}`);
const json = (data = {}, status = 200) => new Response(JSON.stringify(data), { status });
const realTimer = globalThis.setTimeout;

async function shortDeadline(work) {
  globalThis.setTimeout = (callback, delay, ...args) => realTimer(callback, delay === 35_000 ? 20 : delay, ...args);
  try { await work(); } finally { globalThis.setTimeout = realTimer; }
}

test("deadline aborts stalled fetch and releases the session queue", async () => {
  const { Api } = await fresh();
  const api = new Api();
  let signal;
  globalThis.fetch = (_url, options) => { signal = options.signal; return new Promise(() => {}); };
  await shortDeadline(async () => {
    await assert.rejects(api.me(), error => error.code === "timeout" && error.retryable && /try again/i.test(error.message));
  });
  assert.equal(signal.aborted, true);
  globalThis.fetch = async () => json();
  await api.refresh();
  await api.me();
});

test("deadline includes a stalled response body", async () => {
  const { Api } = await fresh();
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return { ok: true, headers: new Headers(), json: () => new Promise(() => {}) };
  };
  await shortDeadline(() => assert.rejects(new Api().me(), error => error.code === "timeout"));
  assert.equal(signal.aborted, true);
});

test("refresh queues respect deadlines and do not send expired requests later", async () => {
  const { Api } = await fresh();
  const api = new Api();
  const sent = [];
  globalThis.fetch = (url) => { sent.push(url); return new Promise(() => {}); };
  let deadlines = 0;
  globalThis.setTimeout = (callback, delay, ...args) => realTimer(callback, delay === 35_000 ? ([80, 40, 20][deadlines++]) : delay, ...args);
  try {
    const results = await Promise.allSettled([api.me(), api.refresh(), api.profile()]);
    assert.ok(results.every(result => result.status === "rejected" && result.reason.code === "timeout"));
  } finally { globalThis.setTimeout = realTimer; }
  await new Promise(resolve => realTimer(resolve, 10));
  assert.deepEqual(sent, ["/api/v1/auth/me"]);
  globalThis.fetch = async () => json();
  await api.refresh();
});

test("uncertain commands reuse the exact ID and original version after reload", async () => {
  entries.clear();
  let module = await fresh();
  const command = { type: "wait", minutes: 5 };
  const sent = [];
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); throw new TypeError("lost response"); };
  await assert.rejects(new module.Api().command("retry-case", 3, command), error => error.code === "network");
  module = await fresh();
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return json({ duplicate: true }); };
  await new module.Api().command("retry-case", 4, command);
  assert.deepEqual(sent[1], sent[0]);
  await new module.Api().command("retry-case", 4, command);
  assert.notEqual(sent[2].command_id, sent[0].command_id, "confirmed later actions receive a new ID");
});

test("ambiguous server failures preserve weekly, pressure and cooperation IDs", async () => {
  entries.clear();
  const { Api } = await fresh();
  const api = new Api();
  const actions = [
    () => api.attemptCommand("weekly-retry", 1, { type: "wait", minutes: 5 }),
    () => api.pressure("pressure-retry", { command_id: crypto.randomUUID(), expected_version: 1, venue_id: "market", method: "bribe" }),
    () => api.askForHelp({ command_id: crypto.randomUUID(), case_id: "coop-retry", venue_id: "market", helper_username: "Helper" })
  ];
  for (const action of actions) {
    const sent = [];
    globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return sent.length === 1 ? json({ message: "Retry" }, 503) : json(); };
    await assert.rejects(action(), error => error.status === 503);
    await action();
    assert.deepEqual(sent[0], sent[1]);
  }
});

test("an uncertain command blocks a different intent and unreadable success stays retryable", async () => {
  entries.clear();
  const { Api } = await fresh();
  const api = new Api();
  let count = 0;
  globalThis.fetch = async () => { count++; return new Response("broken JSON"); };
  await assert.rejects(api.command("uncertain", 1, { type: "wait", minutes: 1 }), error => error.code === "invalid_response");
  await assert.rejects(api.command("uncertain", 1, { type: "wait", minutes: 2 }), error => error.code === "pending_command");
  assert.equal(count, 1);
});

test("session refresh waits for earlier calls and gates later calls", async () => {
  const { Api } = await fresh();
  const api = new Api();
  const sent = [];
  const replies = [];
  globalThis.fetch = (url) => { sent.push(url); return new Promise(resolve => replies.push(resolve)); };
  const first = api.me(), refresh = api.refresh(), last = api.profile();
  await new Promise(resolve => realTimer(resolve, 0));
  assert.deepEqual(sent, ["/api/v1/auth/me"]);
  replies.shift()(json());
  await first;
  await new Promise(resolve => realTimer(resolve, 0));
  assert.deepEqual(sent, ["/api/v1/auth/me", "/api/v1/auth/refresh"]);
  replies.shift()(json());
  await refresh;
  await new Promise(resolve => realTimer(resolve, 0));
  assert.equal(sent[2], "/api/v1/profile");
  replies.shift()(json());
  await last;
});

test("timed-out command retries retain identity while definitive rejection releases it", async () => {
  entries.clear();
  const { Api } = await fresh();
  const api = new Api();
  const sent = [];
  const command = { type: "wait", minutes: 3 };
  globalThis.fetch = (_url, options) => { sent.push(JSON.parse(options.body)); return new Promise(() => {}); };
  await shortDeadline(() => assert.rejects(api.command("timeout-case", 1, command), error => error.code === "timeout"));
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return json({ error: "stale_version" }, 409); };
  await assert.rejects(api.command("timeout-case", 2, command), error => error.status === 409);
  assert.deepEqual(sent[0], sent[1]);
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return json(); };
  await api.command("timeout-case", 2, command);
  assert.notEqual(sent[2].command_id, sent[0].command_id);
});
