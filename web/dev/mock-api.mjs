// In-memory stand-in for the Rust API (schemas/openapi-v1.json) so the UI can be developed without MySQL.
// Usage: node dev/mock-api.mjs   (PORT defaults to 8081; run Vite with API_TARGET=http://127.0.0.1:8081)
// Any email/password signs in. Use the password "wrong" to see a failed login, and email "limit@x.com" for a 429.
import http from "node:http";

const STATES = ["Lagos", "Oyo", "Kwara", "Federal Capital Territory", "Kaduna", "Kano", "Borno", "Rivers", "Abia", "Enugu"];
const TRAITS = ["female", "tall", "dark brown", "braided", "chess", "motorbike", "gold watch", "gap tooth"];
const WITNESS = {
  market: "A trader leans in: the buyer asked for the road to the big river city and paid in crisp notes.",
  library: "The librarian whispers that someone studied maps of the north and left before closing.",
  motor_park: "An agbero says a tall passenger bargained hard for a seat heading toward the savannah."
};
const RANKS = [[0, "Rookie"], [1500, "Investigator"], [4000, "Senior Investigator"], [8000, "Inspector"]];
const CATALOG = [
  { id: "first_case", title: "First Case", description: "Solve your first case." },
  { id: "clean_route", title: "True Trail", description: "Solve a case without a false destination." },
  { id: "state_explorer", title: "State Explorer", description: "Investigate ten jurisdictions." },
  { id: "rank_investigator", title: "Investigator", description: "Earn the Investigator rank." }
];

const sessions = new Map(); // id -> { id, created, last }
const cases = new Map();
const archive = [];
const history = [];
const earned = new Map();
let points = 0;
let player = { player_id: "p1", email: "", username: "", home_base: "Lagos", email_verified: true, display_name: null, pronouns: null, sex: null, avatar_id: null, uniform_id: null, leaderboard_opt_in: false };

const rank = () => [...RANKS].reverse().find(([min]) => points >= min)[1];
const publicState = c => ({
  mission_id: c.mission, difficulty: 2, stage: c.stage, current_state: c.state, elapsed: c.elapsed, score: c.score,
  career_points: points, dossier: c.dossier, visited_venues: c.visited, warrant_suspect: c.warrant, outcome: c.outcome
});
const reply = (c, events = [], duplicate = false) => ({ api_version: "v1", case_id: c.id, state_version: c.version, duplicate, state: publicState(c), events });
class HttpError extends Error { constructor(status, error, message) { super(message); this.status = status; this.error = error; } }

function finish(c) {
  const solved = c.outcome === "solved";
  const before = rank();
  if (solved) points += 1600;
  if (rank() !== before) history.push({ old_rank: before, new_rank: rank(), points, earned_at: new Date().toISOString() });
  const unlock = id => { if (!earned.has(id)) earned.set(id, new Date().toISOString()); };
  if (solved) unlock("first_case");
  if (solved && c.wrongTravels === 0) unlock("clean_route");
  if (rank() === "Investigator") unlock("rank_investigator");
  archive.unshift({
    case_id: c.id, mission_id: c.mission, thief_id: "NG-T001", outcome: c.outcome, score: c.score, elapsed_minutes: c.elapsed,
    completed_at: new Date().toISOString(), states_visited: c.trail, correct_travels: c.stage, wrong_travels: c.wrongTravels,
    correct_deductions: Object.keys(c.dossier).length, wrong_deductions: 0
  });
}

function apply(c, cmd) {
  const events = [];
  switch (cmd.type) {
    case "visit_venue": {
      if (!WITNESS[cmd.venue_id]) throw new HttpError(400, "bad_request", "unknown venue_id");
      const key = `${c.stage}|${c.state}|${cmd.venue_id}`;
      if (c.visited.includes(key)) throw new HttpError(422, "rejected", "This witness has already been questioned here.");
      const first = !c.visited.some(v => v.startsWith(`${c.stage}|${c.state}|`));
      c.visited.push(key); c.elapsed += 45;
      const hint = first ? ` I also noticed the suspect was ${TRAITS[c.stage % 8]}.` : "";
      events.push({ event_type: "witness_account", data: { message: WITNESS[cmd.venue_id] + hint, venue_name: cmd.venue_id.replace("_", " ") } });
      break;
    }
    case "record_trait": c.dossier[cmd.trait_name] = cmd.value; break;
    case "travel":
      if (cmd.destination === c.state) throw new HttpError(422, "rejected", "unavailable destination");
      c.elapsed += 240; c.state = cmd.destination; c.trail.push(cmd.destination);
      if (cmd.destination === c.route[c.stage + 1]) c.stage += 1; else { c.score = Math.max(0, c.score - 150); c.wrongTravels += 1; }
      break;
    case "request_warrant": c.warrant = cmd.suspect_id; c.elapsed += 120; break;
    case "search_hideout":
      c.outcome = cmd.venue_id === "market" ? "solved" : "escaped"; c.score += c.outcome === "solved" ? 2500 : 0; finish(c); break;
    default: throw new HttpError(400, "bad_request", "unsupported command");
  }
  return events;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, body, headers = {}) => { res.writeHead(code, { "Content-Type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
  try {
    let body = {};
    if (req.method === "POST" || req.method === "PUT") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { throw new HttpError(400, "bad_request", "Malformed JSON."); }
    }
    const path = url.pathname;
    const cookie = /nc_session=([\w-]+)/.exec(req.headers.cookie ?? "")?.[1];
    const setCookie = id => ({ "Set-Cookie": `nc_session=${id}; Path=/; HttpOnly; SameSite=Lax` });
    const clearCookie = { "Set-Cookie": "nc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" };
    const session = cookie && sessions.get(cookie);
    const needAuth = () => { if (!session) throw new HttpError(401, "unauthorized", "login required"); session.last = Date.now(); };
    const iso = t => new Date(t).toISOString();

    if (path === "/v1/auth/register") {
      if (body.password !== body.confirm_password) throw new HttpError(400, "bad_request", "Passwords do not match.");
      return send(201, { message: "Account created. Check your email to confirm it." });
    }
    if (path === "/v1/auth/confirm") return send(200, { message: "Email confirmed. You can now log in." });
    if (path === "/v1/auth/login") {
      if (body.email === "limit@x.com") throw new HttpError(429, "rate_limited", "slow down");
      if (!body.email || !body.password || body.password === "wrong") throw new HttpError(401, "unauthorized", "Email or password is incorrect.");
      player = { ...player, email: body.email, username: body.email.split("@")[0] };
      const id = `s${Math.random().toString(16).slice(2)}`;
      sessions.set(id, { id, created: Date.now(), last: Date.now() });
      return send(200, { player }, setCookie(id));
    }
    if (path === "/v1/auth/recovery/request") return send(200, { message: "If that address is registered, a recovery link is on its way." });
    if (path === "/v1/auth/recovery/complete") {
      if (body.password !== body.confirm_password) throw new HttpError(400, "bad_request", "Passwords do not match.");
      sessions.clear();
      return send(200, { message: "Password updated. Log in with your new password." });
    }
    needAuth();
    if (path === "/v1/auth/me") return send(200, { player });
    if (path === "/v1/auth/refresh") {
      sessions.delete(session.id);
      const id = `s${Math.random().toString(16).slice(2)}`;
      sessions.set(id, { ...session, id });
      return send(200, { message: "Session refreshed." }, setCookie(id));
    }
    if (path === "/v1/auth/logout") { sessions.delete(session.id); return send(200, { message: "Logged out." }, clearCookie); }
    if (path === "/v1/auth/logout-all") { sessions.clear(); return send(200, { message: "All sessions logged out." }, clearCookie); }
    if (path === "/v1/auth/sessions") {
      const list = [...sessions.values()].map(s => ({ session_id: s.id, device_label: s.id === session.id ? "This browser" : "Phone", created_at: iso(s.created), last_seen_at: iso(s.last), expires_at: iso(s.created + 864e5), current: s.id === session.id }));
      if (list.length === 1) list.push({ session_id: "other1", device_label: "Phone (Safari)", created_at: iso(Date.now() - 36e5), last_seen_at: iso(Date.now() - 6e5), expires_at: iso(Date.now() + 8e7), current: false });
      return send(200, list);
    }
    const revoke = /^\/v1\/auth\/sessions\/([^/]+)$/.exec(path);
    if (revoke && req.method === "DELETE") { sessions.delete(revoke[1]); return send(200, { message: "Session revoked." }); }
    if (path === "/v1/profile") {
      if (req.method === "PUT") player = { ...player, ...body };
      return send(200, { player });
    }
    if (path === "/v1/progression/summary") {
      const states = new Set(archive.flatMap(a => a.states_visited));
      const sum = k => archive.reduce((n, a) => n + a[k], 0);
      return send(200, {
        points, rank: rank(), solved_cases: archive.filter(a => a.outcome === "solved").length, visited_states: [...states],
        correct_travels: sum("correct_travels"), wrong_travels: sum("wrong_travels"), correct_deductions: sum("correct_deductions"), wrong_deductions: 0,
        achievements: [...earned].map(([achievement_id, earned_at]) => ({ achievement_id, earned_at })), rank_history: history
      });
    }
    if (path === "/v1/progression/archive") return send(200, archive);
    if (path === "/v1/progression/achievements") return send(200, [...earned].map(([achievement_id, earned_at]) => ({ achievement_id, earned_at })));
    if (path === "/v1/progression/achievement-catalog") return send(200, { achievements: CATALOG });

    if (path === "/v1/cases" && req.method === "POST") {
      const n = /^NG-M(\d{4})$/.exec(body.mission_id)?.[1];
      if (!n || Number(n) < 1 || Number(n) > 1000) throw new HttpError(400, "bad_request", "unknown mission_id");
      const shift = Number(n) % 4, route = [...STATES.slice(shift), ...STATES.slice(0, shift)];
      const c = { id: body.case_id, mission: body.mission_id, version: 1, stage: 0, state: route[0], route, trail: [route[0]], wrongTravels: 0, elapsed: 0, score: 800, dossier: {}, visited: [], warrant: null, outcome: null, seen: new Set() };
      cases.set(c.id, c);
      return send(201, reply(c));
    }
    const match = path.match(/^\/v1\/cases\/([^/]+)(\/commands)?$/);
    const c = match && cases.get(match[1]);
    if (!c) throw new HttpError(404, "not_found", "case not found");
    if (!match[2]) return send(200, reply(c));
    if (c.seen.has(body.command_id)) return send(200, reply(c, [], true));
    if (body.expected_version !== c.version) throw new HttpError(409, "version_conflict", "state version is stale");
    if (c.outcome) throw new HttpError(422, "rejected", "This case is already closed.");
    const events = apply(c, body.command);
    c.seen.add(body.command_id); c.version += 1;
    return send(200, reply(c, events));
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.error, message: e.message });
    console.error(e);
    return send(500, { error: "internal", message: "Unexpected error." });
  }
});

const port = Number(process.env.PORT ?? 8081);
server.listen(port, "127.0.0.1", () => console.log(`Mock API on http://127.0.0.1:${port}`));
