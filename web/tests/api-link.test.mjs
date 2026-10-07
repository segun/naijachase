import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const openapi = JSON.parse(fs.readFileSync(new URL("../schemas/openapi-v1.json", root), "utf8"));
const contract = fs.readFileSync(new URL("../contracts/typescript/api-v1.ts", root), "utf8");

test("every endpoint the client calls exists in the OpenAPI contract", () => {
  const api = read("src/api.ts");
  const calls = [...api.matchAll(/call<[^(]*>\(`?"?(\/v1\/[^"`?]*)/g)].map(m => m[1].replace(/\$\{[^}]+\}/g, "{id}"));
  assert.ok(calls.length >= 18, `only found ${calls.length} calls`);
  const known = Object.keys(openapi.paths).map(p => p.replace(/\{[^}]+\}/g, "{id}"));
  for (const call of calls) assert.ok(known.includes(call), `${call} is not in schemas/openapi-v1.json`);
});

test("response and request shapes come from the generated contract, not local copies", () => {
  assert.match(read("src/api.ts"), /contracts\/typescript\/api-v1\.ts/);
  assert.match(read("src/model.ts"), /contracts\/typescript\/api-v1\.ts/);
  assert.doesNotMatch(read("src/model.ts"), /export type (PublicState|CaseResponse)\s*=/);
});

test("no mission, suspect-rank or progression values are hard-coded in the UI", () => {
  for (const file of ["components/CaseDesk.svelte", "components/Results.svelte", "components/Shell.svelte", "lib/app.svelte.ts"]) {
    const text = read(`src/${file}`);
    assert.doesNotMatch(text, /NG-M\d{4}/, `${file} hard-codes a mission`);
    assert.doesNotMatch(text, /Rookie|Master Detective|points >= \d/, `${file} computes rank in the browser`);
  }
  assert.doesNotMatch(read("src/model.ts"), /Master Detective|Chief Inspector/);
});

test("credentials never reach browser storage", () => {
  const code = ["src/lib/app.svelte.ts", "src/api.ts", ...fs.readdirSync(new URL("src/components/", root)).map(f => `src/components/${f}`)].map(read).join("\n");
  assert.doesNotMatch(code, /(localStorage|sessionStorage)\.setItem\([^)]*(password|token)/i);
  assert.match(read("src/api.ts"), /credentials: "include"/);
});

test("the dev mock API honours the contract shapes the UI relies on", async () => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["dev/mock-api.mjs"], { cwd: new URL(".", root).pathname, env: { ...process.env, PORT: String(port) } });
  try {
    await new Promise((resolve, reject) => { child.stdout.once("data", resolve); child.once("error", reject); });
    const base = `http://127.0.0.1:${port}`;
    let cookie = "";
    const call = async (path, method = "GET", body) => {
      const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", cookie }, body: body && JSON.stringify(body) });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: res.status, data: await res.json() };
    };
    assert.equal((await call("/v1/auth/me")).status, 401);
    const wrong = await call("/v1/auth/login", "POST", { email: "a@x.com", password: "wrong" });
    assert.deepEqual([wrong.status, Object.keys(wrong.data).sort()], [401, ["error", "message"]]);
    const login = await call("/v1/auth/login", "POST", { email: "a@x.com", password: "right" });
    for (const key of ["player_id", "email", "username", "home_base", "email_verified", "display_name", "leaderboard_opt_in"]) assert.ok(key in login.data.player, key);
    const created = await call("/v1/cases", "POST", { case_id: "t-1", mission_id: "NG-M0003" });
    assert.equal(created.status, 201);
    const stateKeys = contract.match(/PublicGameState=\{([^}]*)\}/)[1].split(";").map(s => s.split(":")[0]).filter(Boolean);
    for (const key of stateKeys) assert.ok(key in created.data.state, `state.${key}`);
    assert.equal((await call("/v1/cases", "POST", { case_id: "t-2", mission_id: "NG-M9999" })).status, 400);
    const stale = await call("/v1/cases/t-1/commands", "POST", { command_id: "c1", expected_version: 99, command: { type: "wait", minutes: 5 } });
    assert.equal(stale.status, 409);
    const summary = await call("/v1/progression/summary");
    for (const key of ["points", "rank", "solved_cases", "visited_states", "achievements", "rank_history"]) assert.ok(key in summary.data, key);
    const catalog = await call("/v1/progression/achievement-catalog");
    assert.ok(catalog.data.achievements.every(a => a.id && a.title && a.description));
  } finally { child.kill(); }
});
