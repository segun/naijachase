import test from "node:test";
import assert from "node:assert/strict";
import { roomRendererStalled } from "../src/scenes/shared/room-watchdog.ts";

test("garage remains in 3D after settling, idling, dragging and opening an ad", () => {
  const began = 1000;
  let lastFrame = 4000;
  assert.equal(roomRendererStalled("intro", lastFrame, began, 4000, false), false);
  for (const time of [7500, 15000, 60000]) {
    assert.equal(roomRendererStalled("desk", lastFrame, began, time, false), false);
    lastFrame = time; // A drag redraws once, then the scene becomes idle again.
    assert.equal(roomRendererStalled("desk", lastFrame, began, time + 3500, false), false);
  }
  assert.equal(roomRendererStalled("look", lastFrame, began, 120000, false), false);
  assert.equal(roomRendererStalled("outro", lastFrame, began, 120000, false), false);
});

test("real startup and animation stalls still activate the fallback", () => {
  assert.equal(roomRendererStalled("intro", 0, 1000, 8000, false), false);
  assert.equal(roomRendererStalled("intro", 0, 1000, 8001, false), true);
  assert.equal(roomRendererStalled("look", 0, 1000, 8001, false), true);
  assert.equal(roomRendererStalled("intro", 4000, 1000, 7001, false), true);
  assert.equal(roomRendererStalled("intro", 4000, 1000, 7001, true), false);
});
