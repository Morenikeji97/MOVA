import { test } from "node:test";
import assert from "node:assert/strict";
import { displayCity, displayPlace } from "./place.ts";

test("cities show capitalised, whatever the seller typed", () => {
  assert.equal(displayCity("New york"), "New York");
  assert.equal(displayCity("new  york "), "New York");
  assert.equal(displayCity("winston-salem"), "Winston-Salem");
  assert.equal(displayCity("st. louis"), "St. Louis");
  assert.equal(displayCity("McAllen"), "McAllen");
  assert.equal(displayPlace("houston", "tx"), "Houston, TX");
  assert.equal(displayPlace("New york", "New york"), "New York, New York");
});
