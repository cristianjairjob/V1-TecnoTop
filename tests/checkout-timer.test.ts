import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleSeconds, CHECKOUT_CYCLE_MS, formatCountdown } from "../src/lib/checkout-timer";
test("timer follows elapsed time, resumes and repeats every two hours", () => {
  const start = 100000;
  assert.equal(formatCountdown(cycleSeconds(start, start)), "02:00:00");
  assert.equal(formatCountdown(cycleSeconds(start, start + 61000)), "01:58:59");
  assert.equal(cycleSeconds(start, start + CHECKOUT_CYCLE_MS - 1), 1);
  assert.equal(cycleSeconds(start, start + CHECKOUT_CYCLE_MS), 7200);
  assert.equal(cycleSeconds(start, start + CHECKOUT_CYCLE_MS * 3 + 1000), 7199);
});
