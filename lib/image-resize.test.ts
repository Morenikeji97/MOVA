import { test } from "node:test";
import assert from "node:assert/strict";
import { fitWithin, FULL_LONG_EDGE, THUMB_LONG_EDGE } from "./image-resize.ts";

test("a landscape phone photo shrinks to the long-edge limit, keeping its shape", () => {
  assert.deepEqual(fitWithin(4032, 3024, FULL_LONG_EDGE), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(4032, 3024, THUMB_LONG_EDGE), { width: 480, height: 360 });
});

test("a portrait photo is limited by its height", () => {
  assert.deepEqual(fitWithin(3024, 4032, FULL_LONG_EDGE), { width: 1200, height: 1600 });
});

test("a photo already within the limit is never enlarged", () => {
  assert.deepEqual(fitWithin(1200, 800, FULL_LONG_EDGE), { width: 1200, height: 800 });
  assert.deepEqual(fitWithin(1600, 900, FULL_LONG_EDGE), { width: 1600, height: 900 });
});

test("an extreme panorama keeps at least 1px on the short edge", () => {
  assert.deepEqual(fitWithin(20000, 10, THUMB_LONG_EDGE), { width: 480, height: 1 });
});
