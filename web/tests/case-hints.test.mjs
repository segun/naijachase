import test from "node:test";
import assert from "node:assert/strict";
import { storage } from "./controller-runtime.mjs";

const { CaseHintPreference } = await import("../src/ui/case-hints.svelte.ts");

test("hints start visible and remember hide and restore choices across visits", () => {
  const saved = storage();
  const first = new CaseHintPreference(saved);
  assert.equal(first.visible, true);
  first.setVisible(false);
  const returning = new CaseHintPreference(saved);
  assert.equal(returning.visible, false);
  returning.setVisible(true);
  assert.equal(new CaseHintPreference(saved).visible, true);
});

test("blocked storage still permits hiding and restoring hints for the session", () => {
  const hints = new CaseHintPreference({
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Storage blocked"); }
  });
  assert.equal(hints.visible, true);
  hints.setVisible(false);
  assert.equal(hints.visible, false);
  hints.setVisible(true);
  assert.equal(hints.visible, true);
});
