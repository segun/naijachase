import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { investigatorNameProblem } from "../src/domain/investigator-name.ts";

const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("Investigator Name validation is explicit and matches the API rules", () => {
  assert.equal(investigatorNameProblem("Agent_07"), null);
  assert.match(investigatorNameProblem("Agent Seven"), /Investigator Name.*not use spaces/s);
  assert.match(investigatorNameProblem("agent@example"), /Investigator Name.*@/s);
  assert.match(investigatorNameProblem("ab"), /Investigator Name.*3 and 32/);
  const auth = read("screens/entry/AuthPanel.svelte");
  assert.match(auth, />Investigator Name</);
  assert.match(auth, /pattern="\[A-Za-z0-9_-\]\+"/);
  assert.doesNotMatch(auth, />Username</i);
});

test("mobile full-screen rooms and ordinary pages reserve iPhone safe areas", () => {
  const terminal = read("styles/terminal.css"), layout = read("styles/layout.css");
  assert.match(terminal, /\.t-content \{[\s\S]*?safe-area-inset-top[\s\S]*?safe-area-inset-right[\s\S]*?safe-area-inset-bottom[\s\S]*?safe-area-inset-left/);
  assert.match(terminal, /\.sheet-bar \{[\s\S]*?safe-area-inset-top/);
  assert.match(terminal, /\.sheet-body \{[\s\S]*?safe-area-inset-right[\s\S]*?safe-area-inset-bottom[\s\S]*?safe-area-inset-left/);
  assert.match(layout, /\.app:not\(\.no-rail\) > \.content \{[\s\S]*?safe-area-inset-top/);
});

test("first-login avatar action floats above the phone home indicator", () => {
  assert.match(read("avatar/AvatarPicker.svelte"), /class:first/);
  const css = read("avatar/AvatarPicker.svelte");
  assert.match(css, /\.avatar-picker\.first \.avatar-actions \{[\s\S]*?position: fixed;[\s\S]*?safe-area-inset-bottom/);
  assert.match(css, /\.avatar-picker\.first \{[\s\S]*?padding:[^;]*safe-area-inset-bottom/);
});

test("cards, settings values, warrant profiles and venue rows may shrink instead of clipping right", () => {
  const layout = read("styles/layout.css"), screens = read("styles/screens.css"), account = read("styles/account.css"), profiles = read("styles/profile-list.css"), warrant = read("styles/warrant.css"), terminal = read("styles/case-terminal.css");
  assert.match(layout, /\.page > \*, \.card \{ min-width: 0; max-width: 100%; \}/);
  assert.match(account, /\.profile-fact \{[^}]*minmax\(0, 1fr\)[^}]*minmax\(0, auto\)/);
  assert.match(profiles, /\.profile-list dd \{[^}]*overflow-wrap: anywhere/);
  assert.match(screens, /\.venue \{[^}]*width: 100%;[^}]*min-width: 0/);
  assert.match(warrant, /\.phases \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(warrant, /@container \(max-width: 720px\) \{[\s\S]*?\.phases, \.suspects \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(terminal, /\.t-embed \{[\s\S]*?width: 100%; min-width: 0; max-width: 100%; overflow-x: clip/);
});
