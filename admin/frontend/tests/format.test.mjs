import test from "node:test";
import assert from "node:assert/strict";
import { bytes, chartPoints, count, duration, usedPercent, utc } from "../src/format.mjs";

test("missing and failed measurements never look like measured zeroes", () => {
  for (const missing of [undefined, null, NaN, Infinity]) {
    assert.equal(count(missing), "Unavailable");
    assert.equal(bytes(missing), "Unavailable");
    assert.equal(duration(missing), "Unavailable");
  }
  assert.equal(count(0), "0");
  assert.equal(bytes(0), "0 B");
  assert.equal(bytes(1024 ** 3), "1 GiB");
  assert.equal(duration(90000), "1d 1h");
});
test("resource usage distinguishes absent/no-swap data and clamps platform samples", () => {
  assert.equal(usedPercent(null, 10), null);
  assert.equal(usedPercent(0, 0), null);
  assert.equal(usedPercent(100, 25), 75);
  assert.equal(usedPercent(100, 110), 0);
  assert.equal(usedPercent(100, -5), 100);
});
test("timestamps explicitly use UTC independent of browser timezone", () => {
  assert.match(utc("2026-10-20T01:30:00+01:00"), /20 Oct 2026, 00:30 UTC/);
  assert.equal(utc("not-a-date"), "Unavailable");
  assert.equal(utc(null), "Unavailable");
});
test("daily chart handles empty, flat and single-day windows without invalid coordinates", () => {
  assert.equal(chartPoints([], 0), "");
  assert.equal(chartPoints([0, 0], 0), "0,180 800,180");
  assert.equal(chartPoints([5], 5), "400,0");
  assert.equal(chartPoints([0, 5, 10], 10), "0,180 400,90 800,0");
});
