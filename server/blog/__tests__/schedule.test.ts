// Ported with shared/blog-schedule.ts (autoblog-parity SC-06). Kept identical to
// the Xkedule suite on purpose: the module is shared, so the two products
// answering "when is the next post?" differently would be the bug.
import test from "node:test";
import assert from "node:assert/strict";
import {
  isRunDue,
  nextScheduledRun,
  scheduledHours,
  zonedHourAndDay,
} from "#shared/blog-schedule.js";

test("no anchor hour means no schedule (the drifting cadence still governs)", () => {
  assert.deepEqual(scheduledHours(null, 1), []);
  assert.deepEqual(scheduledHours(undefined, 2), []);
});

test("postsPerDay spreads slots evenly from the anchor", () => {
  assert.deepEqual(scheduledHours(9, 1), [9]);
  assert.deepEqual(scheduledHours(9, 2), [9, 21]);
  assert.deepEqual(scheduledHours(9, 4), [3, 9, 15, 21]);
});

test("slots wrap past midnight rather than falling off the day", () => {
  assert.deepEqual(scheduledHours(22, 2), [10, 22]);
});

test("a rounded collision collapses so a slot never doubles up", () => {
  const hours = scheduledHours(0, 5);
  assert.equal(new Set(hours).size, hours.length);
});

test("out of range or zero-frequency config yields no slots", () => {
  assert.deepEqual(scheduledHours(24, 1), []);
  assert.deepEqual(scheduledHours(-1, 1), []);
  assert.deepEqual(scheduledHours(9, 0), []);
});

test("the hour is read in the tenant timezone, not UTC", () => {
  // 2026-08-27T00:30Z is still 26 Aug, 20:30 in New York (EDT, UTC-4).
  const at = new Date("2026-08-27T00:30:00Z");
  assert.deepEqual(zonedHourAndDay(at, "America/New_York"), { hour: 20, day: "2026-08-26" });
  assert.deepEqual(zonedHourAndDay(at, "UTC"), { hour: 0, day: "2026-08-27" });
});

test("an unusable timezone falls back to UTC instead of throwing", () => {
  const at = new Date("2026-08-27T00:30:00Z");
  assert.deepEqual(zonedHourAndDay(at, "Not/AZone"), { hour: 0, day: "2026-08-27" });
});

test("a run is due inside the scheduled local hour", () => {
  // 13:00Z is 09:00 in New York.
  const decision = isRunDue({
    now: new Date("2026-08-27T13:00:00Z"),
    timeZone: "America/New_York",
    postingHour: 9,
    postsPerDay: 1,
    lastRunAt: null,
  });
  assert.equal(decision.due, true);
});

test("a run is not due outside the scheduled hour", () => {
  const decision = isRunDue({
    now: new Date("2026-08-27T14:00:00Z"),
    timeZone: "America/New_York",
    postingHour: 9,
    postsPerDay: 1,
    lastRunAt: null,
  });
  assert.equal(decision.due, false);
  assert.equal(decision.reason, "not_scheduled_hour");
});

test("a second cron fire inside the same local hour does not post twice", () => {
  const decision = isRunDue({
    now: new Date("2026-08-27T13:45:00Z"),
    timeZone: "America/New_York",
    postingHour: 9,
    postsPerDay: 1,
    lastRunAt: new Date("2026-08-27T13:00:10Z"),
  });
  assert.equal(decision.due, false);
  assert.equal(decision.reason, "already_ran_this_hour");
});

test("the same hour on the NEXT day is due again", () => {
  const decision = isRunDue({
    now: new Date("2026-08-28T13:00:00Z"),
    timeZone: "America/New_York",
    postingHour: 9,
    postsPerDay: 1,
    lastRunAt: new Date("2026-08-27T13:00:10Z"),
  });
  assert.equal(decision.due, true);
});

test("nextScheduledRun lands on the configured local hour", () => {
  const next = nextScheduledRun({
    now: new Date("2026-08-27T14:00:00Z"),
    timeZone: "America/New_York",
    postingHour: 9,
    postsPerDay: 1,
  });
  assert.ok(next);
  assert.equal(zonedHourAndDay(next!, "America/New_York").hour, 9);
  assert.ok(next!.getTime() > new Date("2026-08-27T14:00:00Z").getTime());
});

test("nextScheduledRun is null with no anchor, because there is nothing to promise", () => {
  assert.equal(
    nextScheduledRun({ now: new Date(), timeZone: "UTC", postingHour: null, postsPerDay: 1 }),
    null,
  );
});
