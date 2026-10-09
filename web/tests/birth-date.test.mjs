import test from "node:test";
import assert from "node:assert/strict";
import { birthDateError } from "../src/domain/birth-date.mjs";
import { controller } from "./controller-runtime.mjs";

const today = new Date("2026-10-09T23:59:59Z");
const underage = "You must be 18 years or older.";

test("registration eligibility changes on the eighteenth birthday, using UTC", () => {
  assert.equal(birthDateError(9, 10, 2008, today), "");
  assert.equal(birthDateError(8, 10, 2008, today), "");
  assert.equal(birthDateError(10, 10, 2008, today), underage);
  assert.equal(birthDateError(1, 1, 2009, today), underage);
  assert.equal(birthDateError(9, 10, 2008, new Date("2026-10-10T00:30:00+02:00")), "");
  assert.equal(birthDateError(10, 10, 2008, new Date("2026-10-10T00:30:00+02:00")), underage);
  assert.equal(birthDateError(10, 10, 2026, today), "Date of birth cannot be in the future.");
});

test("DOB validation rejects missing, mistyped, fractional and impossible dates", () => {
  for (const date of [
    [undefined, 1, 2000], [1, undefined, 2000], [1, 1, undefined],
    ["1", 1, 2000], [null, 1, 2000], [1.5, 1, 2000], [NaN, 1, 2000],
    [0, 1, 2000], [32, 1, 2000], [31, 4, 2000], [29, 2, 1900],
    [29, 2, 2001], [1, 0, 2000], [1, 13, 2000], [1, 1, 0],
    [1, 1, 999], [1, 1, 10000], [1, 1, -2000]
  ]) {
    assert.equal(birthDateError(...date, today), "Enter a valid date of birth.");
  }
  assert.equal(birthDateError(29, 2, 2000, today), "");
});

test("leap-day birthdays reach eighteen on March 1 in non-leap years", () => {
  assert.equal(birthDateError(29, 2, 2008, new Date("2026-02-28T12:00:00Z")), underage);
  assert.equal(birthDateError(29, 2, 2008, new Date("2026-03-01T00:00:00Z")), "");
});

const form = { email: "adult@example.invalid", password: "a-long-password", confirm: "a-long-password", username: "adult", homeBase: "Lagos", dobDay: 29, dobMonth: 2, dobYear: 2000 };

test("registration controller blocks bad DOB without sending a request and permits correction", async () => {
  const app = controller();
  const requests = [];
  app.api.register = async body => { requests.push(body); return { message: "Account created." }; };
  assert.equal(await app.register({ ...form, dobYear: new Date().getUTCFullYear() - 17, dobDay: 1, dobMonth: 1 }), false);
  assert.equal(app.toasts.at(-1).text, underage);
  assert.equal(app.toasts.at(-1).kind, "error");
  assert.equal(await app.register({ ...form, dobDay: 31, dobMonth: 4 }), false);
  assert.equal(requests.length, 0);
  assert.equal(await app.register(form), true);
  assert.deepEqual(requests, [{
    email: form.email, password: form.password, confirm_password: form.confirm,
    username: form.username, home_base: form.homeBase,
    dob_day: 29, dob_month: 2, dob_year: 2000
  }]);
});
