import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { achievementSharePayload, SHARE_NETWORKS, socialShareUrl } from "../src/domain/achievement-share.ts";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const achievement = { id: "demoted", title: "Demoted", description: "Receive a rank demotion from a disciplinary panel." };

test("achievement posts contain the achievement, investigator and app link", () => {
  const payload = achievementSharePayload(achievement, "Ada", "https://naijachase.app");
  assert.match(payload.title, /Demoted/);
  assert.match(payload.text, /Ada unlocked/);
  assert.match(payload.text, /disciplinary panel/);
  assert.equal(new URL(payload.url).origin, "https://naijachase.app");
  assert.equal(new URL(payload.url).searchParams.get("achievement"), "demoted");
});

test("every listed social network receives a valid prefilled share URL", () => {
  const payload = achievementSharePayload(achievement, "Ada", "https://naijachase.app");
  assert.deepEqual(SHARE_NETWORKS.map(item => item.id), ["facebook", "x", "whatsapp", "linkedin", "telegram", "reddit", "bluesky"]);
  for (const network of SHARE_NETWORKS) {
    const url = new URL(socialShareUrl(network.id, payload));
    assert.equal(url.protocol, "https:", network.id);
    assert.ok(url.hostname, network.id);
    assert.match(decodeURIComponent(url.search), /naijachase\.app|Demoted/, network.id);
  }
});

test("new awards and earned achievement cards both open the same share dialog", () => {
  const app = read("src/state/app.svelte.ts");
  const shell = read("src/App.svelte");
  const desk = read("src/scenes/office/CaseDesk.svelte");
  const dialog = read("src/ui/AchievementShareDialog.svelte");
  assert.match(app, /previous\.achievements/);
  assert.match(app, /newlyEarned: true/);
  assert.match(shell, /app\.achievementShare && !app\.panel/);
  assert.match(desk, /app\.openAchievementShare\(a\.id/);
  assert.match(dialog, /achievementCardFile/);
  assert.match(dialog, /navigator\.share/);
});
