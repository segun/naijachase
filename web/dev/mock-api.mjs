// In-memory stand-in for the Rust API (schemas/openapi-v1.json) so the UI can be developed without MySQL.
// Usage: node dev/mock-api.mjs   (PORT defaults to 8081; run Vite with API_TARGET=http://127.0.0.1:8081)
// Set MOCK_PUBLISHED=3 to try the "every case solved" milestone. Any email/password signs in. Use the password "wrong" to see a failed login, and email "limit@x.com" for a 429.
import http from "node:http";
import { birthDateError } from "../src/domain/birth-date.mjs";

const STATES = ["Lagos", "Oyo", "Kwara", "Federal Capital Territory", "Kaduna", "Kano", "Borno", "Rivers", "Abia", "Enugu", "Sokoto"];
const TRAITS = ["female", "tall", "dark-skinned", "long braided hair", "chess", "a black motorcycle", "a gold wristwatch", "walks with a limp"];
const DOSSIER_OPTIONS = {
  catalogue_version: 1,
  fields: [
    ["sex", "Sex", ["female", "male"]],
    ["height", "Height", ["medium height", "short", "tall"]],
    ["skin_tone", "Skin tone", ["dark-skinned", "light-skinned"]],
    ["hair", "Hair", ["a neat afro", "long braided hair"]],
    ["hobby", "Hobby", ["chess", "photography"]],
    ["vehicle", "Vehicle", ["a black motorcycle", "a blue minibus"]],
    ["accessory", "Accessory", ["a gold wristwatch", "a red scarf"]],
    ["feature", "Distinguishing feature", ["walks with a limp", "writes left-handed"]]
  ].map(([field, label, options]) => ({ field, label, options }))
};
function validateTrait(cmd) {
  if (cmd.type === "record_trait" && !DOSSIER_OPTIONS.fields.find(f => f.field === cmd.trait_name)?.options.includes(cmd.value)) {
    throw new HttpError(422, "invalid_command", "Choose a listed dossier value.");
  }
}
const WITNESS = {
  market: "A trader leans in: the buyer asked for the road to the big river city and paid in crisp notes.",
  library: "The librarian whispers that someone studied maps of the north and left before closing.",
  motor_park: "An agbero says a tall passenger bargained hard for a seat heading toward the savannah."
};
const LOCAL_NAME = { market: "Community Market", library: "Central Library", motor_park: "Motor Park" };
const COLD_WITNESS = {
  market: "I am sorry, but I have not seen anyone matching that description.",
  library: "I have not heard anything that could help you.",
  motor_park: "No one matching that description has passed through here today."
};
const WITNESS_ROLE = { market: "market woman", library: "librarian", motor_park: "agbero" };
const RANKS = [[0, "Rookie"], [1500, "Investigator"], [4000, "Senior Investigator"], [8000, "Inspector"]];
const CATALOG = [
  { id: "first_case", title: "First Case", description: "Solve your first case." },
  { id: "clean_route", title: "True Trail", description: "Solve a case without a false destination." },
  { id: "state_explorer", title: "State Explorer", description: "Investigate ten jurisdictions." },
  { id: "rank_investigator", title: "Investigator", description: "Earn the Investigator rank." },
  { id: "demoted", title: "Demoted", description: "Receive a rank demotion from a disciplinary panel." },
  { id: "suspended", title: "Suspended", description: "Receive a 24-hour mission suspension from a disciplinary panel." }
];

const PUBLISHED = Number(process.env.MOCK_PUBLISHED ?? 1000);
// Content role: set MOCK_ROLE=editor|publisher|admin to try the restricted dashboard (anything else gives 403).
const ROLE = process.env.MOCK_ROLE ?? "";
let notices = Number(process.env.MOCK_NOTICES ?? 0) ? [{ notification_id: 81, mission_id: "NG-M1001", published_at: "2026-10-19 06:00:00", read: false }] : [];
const missions = new Map([
  ["NG-M1001", { mission_id: "NG-M1001", difficulty: 3, thief_id: "NG-T042", anchors: ["LOC-013", "LOC-204", "LOC-088", "LOC-311"], lifecycle_status: "editorial_review", content_version: 1, published_at: null, scheduled_for: null, retired_at: null, history: [{ actor_player_id: "content-editor-1", from_status: "draft", to_status: "editorial_review", content_version: 1, reason: "First editorial pass complete", created_at: "2026-10-12 14:20:00" }] }],
  ["NG-M1002", { mission_id: "NG-M1002", difficulty: 2, thief_id: "NG-T017", anchors: ["LOC-001"], lifecycle_status: "validated", content_version: 1, published_at: null, scheduled_for: null, retired_at: null, history: [] }]
]);
const ISSUES = { "NG-M1001": ["stop 2 jurisdiction has fewer than three clue atoms"] };
// Cooperation: MOCK_AGE=adult|unknown|minor. The mock seeds a second player ("Ada_01") so both sides of a request can be tried.
const AGE = process.env.MOCK_AGE ?? "adult";
const coopPrefs = { enabled: true, email_enabled: false };
let coopRequests = [
  { request_id: "req-in-1", owner_username: "Ada_01", helper_username: "", case_id: "x", venue_id: "market", status: "pending", public_scene: { venue_id: "market", jurisdiction: "Kano", stage: 2 }, recommendation: null, reward_granted: false, expires_at: new Date(Date.now() + 40000000).toISOString() }
];
let blockList = [];
let reputation = 4;
// Groups and weekly challenges. A second player ("Ada_01") is seeded so invitations, rosters and standings have content.
const groupsDb = new Map();
let invites = [{ invitation_id: "inv-1", status: "pending", group_id: "grp-seed", group_name: "Lagos Detectives", expires_at: new Date(Date.now() + 6 * 864e5).toISOString() }];
groupsDb.set("grp-seed", { group_id: "grp-seed", name: "Lagos Detectives", capacity: 20, status: "active", members: [{ player_id: "pid-ada", username: "Ada_01", role: "owner" }] });
const challenges = new Map(), attempts = new Map(), wEvents = [];
let weeklyNotify = [{ notification_id: 1, type: "challenge_scheduled", channel: "web", payload: {}, read_at: null }];
const TRANSIT_SECONDS = Number(process.env.MOCK_TRANSIT ?? 6);
const wkState = () => ({ mission_id: "NG-M0100", case_dossier: { title: "The Weekly Case", stolen_item: "a weekly prize", premise: "A weekly challenge.", opening_briefing: "Catch the thief before the week ends." }, difficulty: 2, stage: 0, current_state: "Lagos", trail_status: "hot", elapsed: 0, score: 650, career_points: 0, dossier: {}, visited_venues: [], searched_hideouts: [], warrant_suspect: null, suspect_files: [], resolved_thief_name: null, outcome: null, opening_budget: 3, balance: 3, transport_rules_version: 1 });
function challengeFor(groupId) {
  if (!challenges.has(groupId)) {
    const id = `wk-${groupId}`; const now = Math.floor(Date.now() / 1000);
    challenges.set(groupId, { challenge_id: id, group_id: groupId, status: "open", starts_at_unix: now - 3600, ends_at_unix: now + 6 * 86400, winner: null });
  }
  return challenges.get(groupId);
}
const attemptView = a => {
  if (a.transit && Date.now() >= a.transit.arrives) { a.state.current_state = a.transit.destination; a.state.elapsed += 240; a.status = "active"; a.transit = null; a.state_version += 1; wEvents.push({ event_id: wEvents.length + 1, event_type: "arrival", data: {}, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") }); }
  const c = [...challenges.values()].find(x => x.challenge_id === a.challenge_id);
  return { attempt_id: a.attempt_id, challenge_id: a.challenge_id, status: a.status, state_version: a.state_version, state: a.state, starts_at: new Date(c.starts_at_unix * 1000).toISOString(), ends_at: new Date(c.ends_at_unix * 1000).toISOString(), winner: c.winner === a.attempt_id, transit: a.transit ? { destination: a.transit.destination, mode: a.transit.mode, remaining_seconds: Math.max(0, Math.ceil((a.transit.arrives - Date.now()) / 1000)) } : null };
};
const sessions = new Map(); // id -> { id, created, last }
const cases = new Map();
const archive = [];
const history = [];
const earned = new Map();
let points = 0;
const AVATARS = [
  ["avatar-01", "Emerald Braids", "feminine", "deep", "#4A2B20", "braided_bun", "#18120F", "#176B4D", "#F4E8C1", "#E5B94B"],
  ["avatar-02", "Midnight Low Cut", "masculine", "rich_deep", "#5A3325", "low_cut", "#17120F", "#172B4D", "#E8EDF2", "#D8A83D"],
  ["avatar-03", "Burgundy Wrap", "feminine", "medium_deep", "#704735", "head_wrap", "#241815", "#762A45", "#F4E6D4", "#DCA94A"],
  ["avatar-04", "Forest Coils", "masculine", "deep", "#3E251D", "short_coils", "#15110F", "#244B36", "#E8DFC9", "#CB8E3B"],
  ["avatar-05", "Cobalt Bob", "feminine", "medium", "#8B5A43", "bob", "#211714", "#2457A6", "#F2E9D8", "#F0B84B"],
  ["avatar-06", "Copper Fade", "masculine", "medium_light", "#A96F50", "fade", "#2A1D18", "#A64B2A", "#F3E7D1", "#243B53"],
  ["avatar-07", "Teal Twists", "feminine", "rich_deep", "#593426", "shoulder_twists", "#191310", "#167A7A", "#E9F1E8", "#D7A83E"],
  ["avatar-08", "Gold Crop", "masculine", "light", "#C88968", "close_crop", "#33231D", "#A87916", "#FFF1CE", "#283B62"],
  ["avatar-09", "Plum Locs", "feminine", "medium_deep", "#704632", "short_locs", "#1D1512", "#65345F", "#F1E5EC", "#D7A33F"],
  ["avatar-10", "Slate Waves", "masculine", "medium", "#8C5B43", "short_waves", "#211713", "#465568", "#E8EDF0", "#B88A35"]
].map(([avatar_id, label, presentation, skin_tone, skin_color, hair_style, hair_color, uniform_primary, uniform_secondary, uniform_accent]) =>
  ({ avatar_id, label, presentation, skin_tone, skin_color, hair_style, hair_color, uniform_primary, uniform_secondary, uniform_accent }));
const avatarProfile = () => {
  const selected = AVATARS.find(a => a.avatar_id === player.avatar_id) ?? null;
  return { catalogue_version: 1, setup_complete: player.avatar_setup_complete, selected_avatar_id: selected?.avatar_id ?? null, selected };
};
let player = { player_id: "p1", email: "", username: "", home_base: "Lagos", email_verified: true, display_name: null, pronouns: null, sex: null, avatar_id: null, uniform_id: null, avatar_setup_complete: false, leaderboard_opt_in: false };

const rank = () => [...RANKS].reverse().find(([min]) => points >= min)[1];
const caseDossier = mission => ({
  title: `The Vanishing Carved Ceremonial Staff \u2014 The ${mission} Case`,
  stolen_item: "a carved ceremonial staff",
  premise: "Someone has taken a carved ceremonial staff from Lagos. The route suggests an artifact theft operation, and the object may be moved again before the week is over.",
  opening_briefing: "The local case officer seals the scene in Lagos. Recover a carved ceremonial staff, identify the thief from eight dossier details, and obtain a warrant before the seven-day deadline."
});
const trailStatus = c => c.state === c.route[c.stage] ? "hot" : "cold";
const publicState = c => ({
  mission_id: c.mission, case_dossier: caseDossier(c.mission), difficulty: 2, stage: c.stage, current_state: c.state, trail_status: trailStatus(c), elapsed: c.elapsed, score: c.score,
  career_points: points, dossier: c.dossier, visited_venues: c.visited, searched_hideouts: c.searched ?? [], warrant_suspect: c.warrant, suspect_files: [], resolved_thief_name: c.outcome ? "Demo Thief" : null, outcome: c.outcome,
  opening_budget: c.opening, balance: c.balance, transport_rules_version: 1, assistant_hired: false, assistant_available: true, assistant_cost: 500
});
const reply = (c, events = [], duplicate = false) => ({ api_version: "v1", case_id: c.id, state_version: c.version, duplicate, attempt_kind: c.kind, state: publicState(c), events });
class HttpError extends Error { constructor(status, error, message) { super(message); this.status = status; this.error = error; } }

function finish(c) {
  const solved = c.outcome === "solved";
  const before = rank();
  if (solved && c.kind !== "replay") points += 1600;
  if (rank() !== before) history.push({ old_rank: before, new_rank: rank(), points, earned_at: new Date().toISOString() });
  const unlock = id => { if (!earned.has(id)) earned.set(id, new Date().toISOString()); };
  if (solved && c.kind !== "replay") unlock("first_case");
  if (solved && c.kind !== "replay" && c.wrongTravels === 0) unlock("clean_route");
  if (rank() === "Investigator") unlock("rank_investigator");
  const firstSolve = solved && c.kind === "ordinary" && !archive.some(a => a.mission_id === c.mission && a.first_completion);
  archive.unshift({
    case_id: c.id, mission_id: c.mission, thief_id: "NG-T001", outcome: c.outcome, score: c.score, elapsed_minutes: c.elapsed,
    completed_at: new Date().toISOString(), states_visited: c.trail, correct_travels: c.stage, wrong_travels: c.wrongTravels,
    correct_deductions: Object.keys(c.dossier).length, wrong_deductions: 0,
    attempt_kind: c.kind, first_completion: firstSolve
  });
}

const FARES = {
  interstate: { fly: [1760, 120], drive: [610, 360], hitch_ride: [0, 900] },
  local: { drive: [120, 20], hitch_ride: [0, 56] },
  apprehension: { drive: [400, 45], hitch_ride: [0, 120] }
};
const VENUE_LABEL = { market: "Market", library: "Library", motor_park: "Motor park" };
function quotesFor(c) {
  if (c.outcome) return [];
  if (c.outcome) return [];
  const out = [];
  const add = (scope, id, label, extra = 0) => {
    for (const [mode, [cost, minutes]] of Object.entries(FARES[scope])) {
      const fare = cost === 0 ? 0 : cost + extra;
      out.push({ scope, destination_id: id, label, mode, cost: fare, travel_minutes: minutes + extra / 10, wait_minutes: 0, affordable: c.balance >= fare, rules_version: 1 });
    }
  };
  c.route.forEach((s, i) => { if (s !== c.state) add("interstate", s, s, i * 20); });
  const done = c.visited.filter(v => v.startsWith(`${c.stage}|${c.state}|`)).map(v => v.split("|")[2]);
  for (const [id, label] of Object.entries(VENUE_LABEL)) if (!done.includes(id)) add("local", id, label);
  if (c.warrant) for (const [id, label] of Object.entries(VENUE_LABEL)) add("apprehension", id, label);
  return out;
}
function pay(c, scope, id, mode, origin, destination) {
  const q = quotesFor(c).find(x => x.scope === scope && x.destination_id === id && x.mode === mode);
  if (!q) throw new HttpError(422, "invalid_command", "that journey is not available");
  if (!q.affordable) throw new HttpError(422, "invalid_command", "insufficient funds for that journey");
  c.balance -= q.cost; c.elapsed += q.travel_minutes + q.wait_minutes;
  c.ledger.push({ sequence: c.ledger.length + 1, kind: scope, origin, destination, mode, cost: q.cost, minutes: q.travel_minutes + q.wait_minutes, balance_after: c.balance });
}

function apply(c, cmd) {
  const events = [];
  switch (cmd.type) {
    case "visit_venue": {
      if (!WITNESS[cmd.venue_id]) throw new HttpError(400, "bad_request", "unknown venue_id");
      const key = `${c.stage}|${c.state}|${cmd.venue_id}`;
      if (c.visited.includes(key)) throw new HttpError(422, "rejected", "This witness has already been questioned here.");
      const first = !c.visited.some(v => v.startsWith(`${c.stage}|${c.state}|`));
      pay(c, "local", cmd.venue_id, cmd.mode, c.state, VENUE_LABEL[cmd.venue_id]);
      c.visited.push(key); c.elapsed += 45;
      const status = trailStatus(c);
      const hint = first && status === "hot" ? ` I also noticed the suspect was ${TRAITS[c.stage % 8]}.` : "";
      const message = status === "hot" ? WITNESS[cmd.venue_id] + hint : COLD_WITNESS[cmd.venue_id];
      events.push({ event_type: "witness_account", data: { message, venue_id: cmd.venue_id, stop: c.state, stage: String(c.stage), trail_status: status, venue_name: cmd.venue_id.replace("_", " "), local_venue_name: `${c.state} ${LOCAL_NAME[cmd.venue_id]}`, location_name: c.state, witness_role: WITNESS_ROLE[cmd.venue_id] } });
      break;
    }
    case "record_trait": c.dossier[cmd.trait_name] = cmd.value; break;
    case "travel":
      if (cmd.destination === c.state) throw new HttpError(422, "rejected", "unavailable destination");
      pay(c, "interstate", cmd.destination, cmd.mode, c.state, cmd.destination);
      c.state = cmd.destination; c.trail.push(cmd.destination);
      if (cmd.destination === c.route[c.stage + 1]) c.stage += 1; else { c.score = Math.max(0, c.score - 150); c.wrongTravels += 1; }
      events.push({ event_type: trailStatus(c) === "hot" ? "arrived_on_trail" : "false_destination", data: { trail_status: trailStatus(c) } });
      break;
    case "request_warrant": c.warrant = cmd.suspect_id; c.elapsed += 120; break;
    case "search_hideout":
      c.searched ??= [];
      if (c.searched.includes(cmd.venue_id)) throw new HttpError(422, "rejected", "this hideout has already been searched");
      pay(c, "apprehension", cmd.venue_id, cmd.mode, c.state, VENUE_LABEL[cmd.venue_id]);
      if (cmd.venue_id !== "market") { c.searched.push(cmd.venue_id); events.push({ event_type: "hideout_empty", data: { venue_id: cmd.venue_id } }); break; }
      c.outcome = "solved"; c.score += 2500; finish(c); break;
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
      const error = birthDateError(body.dob_day, body.dob_month, body.dob_year);
      if (error) throw new HttpError(400, "bad_request", error);
      if (body.password !== body.confirm_password) throw new HttpError(400, "bad_request", "Passwords do not match.");
      return send(201, { message: "Account created. Check your email to confirm it." });
    }
    if (path === "/v1/auth/confirm") return send(200, { message: "Email confirmed. You can now log in." });
    if (path === "/v1/auth/confirmation/resend") return send(202, { message: "If that account is awaiting confirmation, a new link has been queued." });
    if (path === "/v1/auth/login") {
      if (body.email === "limit@x.com") throw new HttpError(429, "rate_limited", "slow down");
      if (body.email === "pending@x.com") throw new HttpError(403, "email_unconfirmed", "confirm your email before logging in");
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
    if (path === "/v1/dossier/options" && req.method === "GET") return send(200, DOSSIER_OPTIONS);
    if (path.startsWith("/v1/admin/catalogue")) {
      if (!ROLE) throw new HttpError(403, "forbidden", "content role required");
      if (path === "/v1/admin/catalogue/me") return send(200, { content_role: ROLE });
      if (path === "/v1/admin/catalogue/health") {
        const n = s => [...missions.values()].filter(x => x.lifecycle_status === s).length;
        return send(200, { draft: 8 + n("draft"), editorial_review: n("editorial_review"), validated: n("validated"), scheduled: n("scheduled"), published: PUBLISHED, retired: 2, exhausted_players: 0, minimum_unseen_cases: PUBLISHED - 17, reserve_below_target: n("validated") + n("scheduled") < 50 });
      }
      const am = /^\/v1\/admin\/catalogue\/missions\/([^/]+)(\/validation|\/transition)?$/.exec(path);
      const found = am && missions.get(am[1]);
      if (!found) throw new HttpError(404, "not_found", "mission not found");
      if (am[2] === "/validation") { const issues = ISSUES[found.mission_id] ?? []; return send(200, { mission_id: found.mission_id, valid: !issues.length, issues }); }
      if (am[2] === "/transition") {
        if (ROLE === "editor" && !["draft", "editorial_review"].includes(body.target_status)) throw new HttpError(403, "forbidden", "publisher role required");
        if (body.target_status === "validated" && (ISSUES[found.mission_id] ?? []).length) throw new HttpError(422, "invalid_command", `mission validation failed: ${ISSUES[found.mission_id][0]}`);
        if (body.target_status === "scheduled" && !body.scheduled_for) throw new HttpError(422, "invalid_command", "scheduled_for is required");
        found.history.push({ actor_player_id: "you", from_status: found.lifecycle_status, to_status: body.target_status, content_version: found.content_version, reason: body.reason, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") });
        found.lifecycle_status = body.target_status; found.scheduled_for = body.scheduled_for ?? null;
        return send(200, { message: "mission lifecycle updated" });
      }
      return send(200, found);
    }
    if (path.startsWith("/v1/cooperation")) {
      const me = player.username;
      coopRequests.forEach(r => { if (!r.helper_username) r.helper_username = me; });
      const mine = r => r.owner_username === me || r.helper_username === me;
      if (AGE !== "adult" && path !== "/v1/cooperation/preferences") throw new HttpError(403, "forbidden", "cooperation is not available for this account");
      if (path === "/v1/cooperation/preferences") {
        if (req.method === "PUT") { coopPrefs.enabled = !!body.enabled; coopPrefs.email_enabled = !!body.email_enabled; }
        return send(200, { ...coopPrefs, age_assurance_status: AGE });
      }
      if (path === "/v1/cooperation/reputation") return send(200, { reputation });
      if (path === "/v1/cooperation/requests" && req.method === "GET") return send(200, coopRequests.filter(mine));
      if (path === "/v1/cooperation/requests" && req.method === "POST") {
        if (!/^[A-Za-z0-9_]{3,32}$/.test(body.helper_username ?? "")) throw new HttpError(422, "invalid_command", "helper not found");
        if (blockList.some(b => b[1] === body.helper_username)) throw new HttpError(422, "invalid_command", "that player cannot be asked");
        if (coopRequests.some(r => r.case_id === body.case_id && r.helper_username === body.helper_username)) throw new HttpError(409, "duplicate_request", "you already asked this player for this case");
        const c = cases.get(body.case_id);
        const id = `req-${coopRequests.length + 1}`;
        coopRequests.push({ request_id: id, owner_username: me, helper_username: body.helper_username, case_id: body.case_id, venue_id: body.venue_id, status: "pending", public_scene: { venue_id: body.venue_id, jurisdiction: c?.state ?? "Lagos", stage: c?.stage ?? 0 }, recommendation: null, reward_granted: false, expires_at: new Date(Date.now() + 43200000).toISOString() });
        return send(201, { request_id: id, status: "pending", expires_in_seconds: 43200 });
      }
      const act = /^\/v1\/cooperation\/requests\/([^/]+)\/(accept|decline|complete|acknowledge)$/.exec(path);
      if (act) {
        const r = coopRequests.find(x => x.request_id === act[1] && mine(x));
        if (!r) throw new HttpError(404, "not_found", "request not found");
        const next = { accept: "accepted", decline: "declined", complete: "completed", acknowledge: "acknowledged" }[act[2]];
        if (act[2] === "complete") { if (!body.recommendation?.trim() || body.recommendation.length > 240) throw new HttpError(422, "invalid_command", "recommendation must be 1 to 240 characters"); r.recommendation = { text: body.recommendation }; }
        if (act[2] === "acknowledge") { r.reward_granted = true; reputation += 1; }
        r.status = next;
        return send(200, { status: next });
      }
      if (path === "/v1/cooperation/blocks" && req.method === "GET") return send(200, blockList);
      if (path === "/v1/cooperation/blocks" && req.method === "POST") {
        if (!blockList.some(b => b[1] === body.username)) blockList.push([`pid-${body.username}`, body.username]);
        coopRequests.forEach(r => { if ((r.owner_username === body.username || r.helper_username === body.username) && ["pending", "accepted"].includes(r.status)) r.status = "cancelled"; });
        return send(200, { blocked: true });
      }
      const unblock = /^\/v1\/cooperation\/blocks\/([^/]+)$/.exec(path);
      if (unblock && req.method === "DELETE") { blockList = blockList.filter(b => b[0] !== unblock[1]); return send(200, { blocked: false }); }
      if (path === "/v1/cooperation/reports") return send(201, { report_id: "rep-1" });
    }
    if (path.startsWith("/v1/groups") || path.startsWith("/v1/group-invitations") || path.startsWith("/v1/weekly")) {
      const meName = player.username, meId = `pid-${meName}`;
      const inGroup = g => g.members.some(x => x.player_id === meId);
      const roleOf = g => g.members.find(x => x.player_id === meId)?.role;
      const need = id => { const g = groupsDb.get(id); if (!g || !inGroup(g) || g.status !== "active") throw new HttpError(g ? 403 : 404, g ? "forbidden" : "not_found", g ? "group access denied" : "group not found"); return g; };
      if (path === "/v1/group-invitations") return send(200, invites);
      if (path === "/v1/groups" && req.method === "POST") {
        const id = `grp-${groupsDb.size + 1}`;
        if (!body.name || body.name.trim().length < 3) throw new HttpError(422, "invalid_command", "group name must be 3 to 40 characters");
        groupsDb.set(id, { group_id: id, name: body.name.trim(), capacity: body.capacity ?? 20, status: "active", members: [{ player_id: meId, username: meName, role: "owner" }] });
        return send(201, { group_id: id });
      }
      const ans = /^\/v1\/groups\/invitations\/([^/]+)$/.exec(path);
      if (ans) {
        const inv = invites.find(i => i.invitation_id === ans[1]); if (!inv) throw new HttpError(404, "not_found", "invitation not found");
        if (body.accept) groupsDb.get(inv.group_id).members.push({ player_id: meId, username: meName, role: "member" });
        invites = invites.filter(i => i !== inv); return send(200, { accepted: !!body.accept });
      }
      const gm = /^\/v1\/groups\/([^/]+)(?:\/(delete|members|invitations|leave|transfer-ownership|weekly\/current))?$/.exec(path);
      if (gm) {
        const g = need(gm[1]), act = gm[2];
        if (!act) return send(200, g);
        const manage = ["owner", "admin"].includes(roleOf(g));
        if (act === "delete") { if (roleOf(g) !== "owner") throw new HttpError(403, "forbidden", "only the owner can delete a group"); g.status = "deleted"; return send(200, { deleted: true }); }
        if (act === "leave") { if (roleOf(g) === "owner") throw new HttpError(403, "forbidden", "transfer ownership before leaving"); g.members = g.members.filter(x => x.player_id !== meId); return send(200, { left: true }); }
        if (act === "invitations") { if (!manage) throw new HttpError(403, "forbidden", "only owners and admins can invite"); if (g.members.length >= g.capacity) throw new HttpError(422, "invalid_command", "the group is full"); return send(201, { invitation_id: "inv-new", expires_in_seconds: 604800 }); }
        if (act === "transfer-ownership") { if (roleOf(g) !== "owner") throw new HttpError(403, "forbidden", "only the owner can transfer ownership"); g.members.find(x => x.player_id === body.player_id).role = "owner"; g.members.find(x => x.player_id === meId).role = "admin"; return send(200, { transferred: true }); }
        if (act === "members") {
          const t = g.members.find(x => x.player_id === body.player_id); if (!t || !manage || t.role === "owner") throw new HttpError(403, "forbidden", "not allowed");
          if (body.role) { if (roleOf(g) !== "owner") throw new HttpError(403, "forbidden", "only the owner can change roles"); t.role = body.role; } else g.members = g.members.filter(x => x !== t);
          return send(200, { updated: true });
        }
        if (act === "weekly/current") { const c = challengeFor(g.group_id); return send(200, { challenge_id: c.challenge_id, starts_at_unix: c.starts_at_unix, ends_at_unix: c.ends_at_unix, timezone: "Africa/Lagos", schedule_version: 1, rules_version: 1 }); }
      }
      if (path === "/v1/weekly/history") return send(200, [{ challenge_id: "wk-old", group_name: "Lagos Detectives", status: "closed", week: "2026-W40" }]);
      if (path === "/v1/weekly/notifications") { if (req.method === "PUT") return send(200, { updated: true }); return send(200, weeklyNotify); }
      const wk = /^\/v1\/weekly\/([^/]+)(?:\/(attempt|events|cancel))?$/.exec(path);
      const wa = /^\/v1\/weekly\/attempts\/([^/]+)(\/commands)?$/.exec(path);
      if (wa) {
        const a = attempts.get(wa[1]); if (!a || a.player !== meId) throw new HttpError(403, "forbidden", "attempt access denied");
        if (!wa[2]) return send(200, attemptView(a));
        const view = attemptView(a);
        if (body.expected_version !== a.state_version) throw new HttpError(409, "stale_version", "state version is stale");
        if (a.status === "in_transit") throw new HttpError(422, "invalid_command", "attempt is in transit or challenge closed");
        const cmd = body.command;
        validateTrait(cmd);
        if (cmd.type === "travel") { a.status = "in_transit"; a.transit = { destination: cmd.destination, mode: cmd.mode, arrives: Date.now() + TRANSIT_SECONDS * 1000 }; a.state_version += 1; return send(200, { status: "in_transit", transit_id: "tr-1", duration_seconds: TRANSIT_SECONDS }); }
        if (cmd.type === "record_trait") a.state.dossier[cmd.trait_name] = cmd.value;
        else if (cmd.type === "visit_venue") a.state.visited_venues.push(`0|${a.state.current_state}|${cmd.venue_id}`);
        else if (cmd.type === "request_warrant") a.state.warrant_suspect = cmd.suspect_id;
        else if (cmd.type === "search_hideout") { a.state.outcome = "solved"; a.status = "solved"; const c = [...challenges.values()].find(x => x.challenge_id === a.challenge_id); if (!c.winner) { c.winner = a.attempt_id; c.status = "closed"; wEvents.push({ event_id: wEvents.length + 1, event_type: "first_valid_capture", data: { reward_tokens: 5 }, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") }); } }
        a.state_version += 1; return send(200, attemptView(a));
      }
      if (wk && !["history", "notifications"].includes(wk[1])) {
        const c = [...challenges.values()].find(x => x.challenge_id === wk[1]); if (!c) throw new HttpError(404, "not_found", "challenge not found");
        if (wk[2] === "attempt") {
          let a = [...attempts.values()].find(x => x.challenge_id === c.challenge_id && x.player === meId);
          if (!a) { a = { attempt_id: `att-${attempts.size + 1}`, challenge_id: c.challenge_id, player: meId, username: meName, status: "active", state_version: 1, state: wkState(), transit: null }; attempts.set(a.attempt_id, a); wEvents.push({ event_id: wEvents.length + 1, event_type: "member_started", data: {}, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") }); }
          return send(201, { attempt_id: a.attempt_id });
        }
        if (wk[2] === "events") return send(200, [{ event_id: 0, event_type: "challenge_scheduled", data: {}, created_at: "2026-10-05 06:00:00" }, ...wEvents]);
        if (wk[2] === "cancel") { if (!body.reason || body.reason.trim().length < 3) throw new HttpError(422, "invalid_command", "a reason is required"); c.status = "cancelled"; return send(200, { cancelled: true }); }
        const standings = [{ username: "Ada_01", status: "active", attempt_id: "att-ada", finished_at: null }, ...[...attempts.values()].filter(a => a.challenge_id === c.challenge_id).map(a => ({ username: a.username, status: a.status, attempt_id: a.attempt_id, finished_at: a.status === "solved" ? new Date().toISOString() : null }))];
        return send(200, { challenge_id: c.challenge_id, status: c.status, timezone: "Africa/Lagos", starts_at: new Date(c.starts_at_unix * 1000).toISOString(), ends_at: new Date(c.ends_at_unix * 1000).toISOString(), winner_attempt_id: c.winner, standings });
      }
    }
    if (path === "/v1/cases/catalogue-notifications") return send(200, notices);
    const read = /^\/v1\/cases\/catalogue-notifications\/(\d+)\/read$/.exec(path);
    if (read) { notices = notices.map(n => n.notification_id === Number(read[1]) ? { ...n, read: true } : n); return send(200, { message: "notification read" }); }
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
      if (req.method === "PUT") {
        if (body.avatar_id != null || body.uniform_id != null) throw new HttpError(400, "bad_request", "use /v1/profile/avatar to choose an avatar preset");
        player = { ...player, ...body };
      }
      return send(200, { player });
    }
    if (path === "/v1/avatar/options") return send(200, { catalogue_version: 1, renderer: "babylon_procedural_v1", options: AVATARS });
    if (path === "/v1/profile/avatar") {
      if (req.method === "PUT") {
        if (!AVATARS.some(a => a.avatar_id === body.avatar_id)) throw new HttpError(400, "bad_request", "choose one of the current avatar presets");
        player = { ...player, avatar_id: body.avatar_id, avatar_setup_complete: true };
      }
      return send(200, avatarProfile());
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

    const open = (mission, kind) => {
      const n = Number(/^NG-M(\d{4})$/.exec(mission)?.[1]);
      const shift = n % 4, route = [...STATES.slice(shift), ...STATES.slice(0, shift)];
      const c = { id: `${kind === "replay" ? "replay" : "case"}-${crypto.randomUUID()}`, kind, mission, version: 1, stage: 0, state: route[0], route, trail: [route[0]], wrongTravels: 0, elapsed: 0, score: 800, dossier: {}, visited: [], warrant: null, outcome: null, seen: new Set(), opening: 6000, balance: 6000,
        ledger: [{ sequence: 1, kind: "opening_allocation", origin: "", destination: "", mode: "allocation", cost: 0, minutes: 0, balance_after: 6000 }] };
      cases.set(c.id, c);
      c.accounts = [];
      return send(201, reply(c));
    };
    const solvedMissions = () => new Set(archive.filter(a => a.outcome === "solved" && a.attempt_kind === "ordinary").map(a => a.mission_id));
    const ongoing = kind => [...cases.values()].filter(c => c.kind === kind && c.outcome === null);
    if (path === "/v1/activity/current" && req.method === "GET") {
      const ordinary = ongoing("ordinary")[0] ?? null, replays = ongoing("replay");
      const weekly = [...attempts.values()].filter(a => ["active", "in_transit"].includes(a.status));
      return send(200, { has_ongoing_activity: Boolean(ordinary || replays.length || weekly.length), ordinary_case: ordinary ? reply(ordinary) : null, replay_cases: replays.map(c => reply(c)), weekly_attempts: weekly.map(a => attemptView(a)) });
    }
    if (path === "/v1/cases/current" && req.method === "GET") {
      const current = ongoing("ordinary")[0] ?? null;
      return send(200, { has_ongoing_case: Boolean(current), case: current ? reply(current) : null });
    }
    const abandon = path.match(/^\/v1\/cases\/([^/]+)\/abandon$/);
    if (abandon && req.method === "POST") {
      const current = cases.get(abandon[1]);
      if (!current) throw new HttpError(404, "case_not_found", "case not found");
      if (!Number.isInteger(body.expected_version) || body.expected_version < 1) throw new HttpError(400, "invalid_request", "expected_version must be at least 1");
      if (current.kind !== "ordinary" || current.outcome !== null) throw new HttpError(409, "case_not_abandonable", "only an ongoing ordinary case can be abandoned");
      if (body.expected_version !== current.version) throw new HttpError(409, "stale_version", "state version is stale");
      const previous = current.version;
      current.outcome = "abandoned"; current.version++;
      return send(200, { case_id: current.id, mission_id: current.mission, status: "abandoned", previous_state_version: previous, state_version: current.version, points_reverted: 0, points_after: points, rank_after: rank() });
    }
    if (path === "/v1/cases/catalogue-status") {
      const done = solvedMissions().size;
      return send(200, { published_cases: PUBLISHED, completed_cases: done, unseen_cases: PUBLISHED - done, exhausted: done >= PUBLISHED });
    }
    if (path === "/v1/cases" && req.method === "POST") {
      if (Object.keys(body).length) throw new HttpError(400, "bad_request", "the request body must be empty; the server chooses the case");
      const current = ongoing("ordinary")[0];
      if (current) return send(200, reply(current, [], true));
      const done = solvedMissions();
      const unseen = Array.from({ length: PUBLISHED }, (_, i) => `NG-M${String(i + 1).padStart(4, "0")}`).filter(id => !done.has(id));
      if (!unseen.length) throw new HttpError(409, "catalogue_exhausted", "all currently published missions are complete; replay an archived case or return when new cases publish");
      return open(unseen[Math.floor(Math.random() * unseen.length)], "ordinary");
    }
    if (path === "/v1/cases/replay" && req.method === "POST") {
      if (!solvedMissions().has(body.mission_id)) throw new HttpError(409, "replay_not_available", "only successfully completed missions can be replayed");
      return open(body.mission_id, "replay");
    }
    const sub = path.match(/^\/v1\/cases\/([^/]+)\/(transport-quotes|ledger|accounts)$/);
    if (sub) {
      const found = cases.get(sub[1]);
      if (!found) throw new HttpError(404, "not_found", "case not found");
      return send(200, sub[2] === "accounts" ? found.accounts : sub[2] === "ledger" ? found.ledger : quotesFor(found));
    }
    const match = path.match(/^\/v1\/cases\/([^/]+)(\/commands)?$/);
    const c = match && cases.get(match[1]);
    if (!c) throw new HttpError(404, "not_found", "case not found");
    if (!match[2]) return send(200, reply(c));
    if (c.outcome === "abandoned") throw new HttpError(422, "invalid_command", "case already abandoned");
    if (c.seen.has(body.command_id)) return send(200, reply(c, [], true));
    if (body.expected_version !== c.version) throw new HttpError(409, "stale_version", "state version is stale");
    if (c.outcome) throw new HttpError(422, "rejected", "This case is already closed.");
    validateTrait(body.command);
    const events = apply(c, body.command);
    c.seen.add(body.command_id); c.version += 1;
    c.accounts.push(...events.flatMap((event, index) => event.event_type === "witness_account"
      ? [{ ...event, data: { ...event.data, account_id: `${c.version}:${index}`, state_version: String(c.version) } }] : []));
    return send(200, reply(c, events));
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.error, message: e.message });
    console.error(e);
    return send(500, { error: "internal", message: "Unexpected error." });
  }
});

const port = Number(process.env.PORT ?? 8081);
server.listen(port, "127.0.0.1", () => console.log(`Mock API on http://127.0.0.1:${server.address().port}`));
