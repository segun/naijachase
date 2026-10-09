import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resumableCase } from "../src/domain/model.ts";

const ordinary = { case_id: "case-1" };
const replays = [{ case_id: "replay-2" }, { case_id: "replay-1" }];

test("the desk resumes the server's unfinished case, not browser storage", () => {
  assert.equal(resumableCase({ ordinary_case: null, replay_cases: [] }, "case-stale"), null);
  assert.equal(resumableCase({ ordinary_case: ordinary, replay_cases: replays }), ordinary);
  assert.equal(resumableCase({ ordinary_case: null, replay_cases: replays }), replays[0]);
  assert.equal(resumableCase({ ordinary_case: ordinary, replay_cases: replays }, "replay-1"), replays[1]);
  assert.equal(resumableCase({ ordinary_case: ordinary, replay_cases: replays }, "case-gone"), ordinary);
});

test("sign-in and boot ask the current-activity API", () => {
  const app = fs.readFileSync(new URL("../src/state/app.svelte.ts", import.meta.url), "utf8");
  assert.match(app, /api\.currentActivity\(\)/);
  assert.match(app, /async login[\s\S]*?await this\.syncCurrentCase\(\)[\s\S]*?return true;/);
  assert.match(app, /async boot[\s\S]*?await this\.syncCurrentCase\(\)/);
});
