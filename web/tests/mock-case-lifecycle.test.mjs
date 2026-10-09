import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

test("mock API discovers, resumes, abandons, and creates a fresh ordinary attempt", async t => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../dev/mock-api.mjs", import.meta.url))], {
    env: { ...process.env, PORT: "0", MOCK_PUBLISHED: "1" }, stdio: ["ignore", "pipe", "pipe"]
  });
  let errors = "";
  child.stderr.on("data", chunk => { errors += chunk; });
  const lines = createInterface({ input: child.stdout });
  t.after(async () => {
    lines.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  });
  const ready = once(lines, "line");
  const failed = once(child, "exit").then(([code]) => { throw new Error(`Mock exited ${code}: ${errors}`); });
  const [line] = await Promise.race([ready, failed]);
  const url = line.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(url, line);
  let cookie = "";
  const request = async (path, body) => {
    const response = await fetch(`${url}/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await request("/auth/login", { email: "lifecycle@example.invalid", password: "fixture-password" })).status, 200);
  assert.equal((await request("/activity/current")).data.has_ongoing_activity, false);
  const created = await request("/cases", {});
  assert.equal(created.status, 201);
  const id = created.data.case_id;
  const duplicate = await request("/cases", {});
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.duplicate, true);
  assert.equal(duplicate.data.case_id, id);
  assert.equal((await request("/cases/current")).data.case.case_id, id);
  const interview = { command_id: "interview-one", expected_version: 1, command: { type: "visit_venue", venue_id: "market", mode: "drive" } };
  assert.equal((await request(`/cases/${id}/commands`, interview)).status, 200);
  assert.equal((await request(`/cases/${id}/abandon`, { expected_version: 1 })).data.error, "stale_version");
  assert.equal((await request(`/cases/${id}/abandon`, { expected_version: 2 })).status, 200);
  assert.equal((await request("/activity/current")).data.ordinary_case, null);
  assert.equal((await request("/cases/current")).data.case, null);
  assert.equal((await request(`/cases/${id}/commands`, interview)).data.error, "invalid_command");
  assert.deepEqual((await request(`/cases/${id}/transport-quotes`)).data, []);
  const fresh = await request("/cases", {});
  assert.equal(fresh.status, 201);
  assert.notEqual(fresh.data.case_id, id);
  assert.equal(fresh.data.state.mission_id, created.data.state.mission_id);
  assert.deepEqual(fresh.data.state.visited_venues, []);
  assert.equal((await request(`/cases/${fresh.data.case_id}/commands`, interview)).status, 200);

  let current = (await request(`/cases/${fresh.data.case_id}`)).data;
  const command = async payload => {
    const result = await request(`/cases/${current.case_id}/commands`, {
      command_id: crypto.randomUUID(), expected_version: current.state_version, command: payload
    });
    assert.equal(result.status, 200);
    current = result.data;
    return current;
  };
  const previousAccount = current.events[0]?.data.message;
  await command({ type: "travel", destination: "Sokoto", mode: "hitch_ride" });
  assert.equal(current.state.trail_status, "cold");
  assert.equal(current.state.stage, 0);
  assert.deepEqual(current.events, [{ event_type: "false_destination", data: { trail_status: "cold" } }]);
  const quotes = (await request(`/cases/${current.case_id}/transport-quotes`)).data;
  const venues = [...new Set(quotes.filter(q => q.scope === "local").map(q => q.destination_id))];
  assert.equal(venues.length, 3);
  const expected = {
    market: "I am sorry, but I have not seen anyone matching that description.",
    library: "I have not heard anything that could help you.",
    motor_park: "No one matching that description has passed through here today."
  };
  for (const venue of venues) {
    await command({ type: "visit_venue", venue_id: venue, mode: "hitch_ride" });
    const account = current.events.find(e => e.event_type === "witness_account").data;
    assert.equal(account.message, expected[venue]);
    assert.notEqual(account.message, previousAccount);
    assert.equal(account.trail_status, "cold");
    assert.equal(account.location_name, "Sokoto");
    assert.match(account.local_venue_name, /^Sokoto /);
    assert.doesNotMatch(account.message, /I also noticed/);
  }
  assert.equal((await request(`/cases/${current.case_id}`)).data.state.trail_status, "cold");
  assert.equal((await request("/cases/current")).data.case.state.trail_status, "cold");
  await command({ type: "travel", destination: "Kwara", mode: "hitch_ride" });
  assert.equal(current.state.trail_status, "hot");
  assert.equal(current.state.stage, 1);
  assert.deepEqual(current.events, [{ event_type: "arrived_on_trail", data: { trail_status: "hot" } }]);
  await command({ type: "visit_venue", venue_id: "market", mode: "hitch_ride" });
  assert.match(current.events[0].data.message, /I also noticed/);
  assert.match(current.events[0].data.local_venue_name, /^Kwara /);
});
