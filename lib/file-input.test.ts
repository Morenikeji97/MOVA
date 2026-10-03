import { test } from "node:test";
import assert from "node:assert/strict";
import { takeFiles } from "./file-input.ts";

/**
 * Behaves like a real file input in Safari and Chrome: `files` is a live
 * list that clearing `value` empties in place.
 */
function fakeInput(names: string[]) {
  const live = names.map((name) => ({ name }) as unknown as File);
  return {
    get files() {
      return live;
    },
    get value() {
      return live.length ? `C:\\fakepath\\${live[0].name}` : "";
    },
    set value(v: string) {
      if (v === "") live.length = 0;
    },
  };
}

test("returns every picked file even though clearing the input empties its list", () => {
  const input = fakeInput(["IMG_0001.jpg", "IMG_0002.jpg"]);
  const files = takeFiles(input);
  assert.deepEqual(
    files.map((f) => f.name),
    ["IMG_0001.jpg", "IMG_0002.jpg"],
  );
});

test("clears the input so the same photo can be picked again", () => {
  const input = fakeInput(["IMG_0001.jpg"]);
  takeFiles(input);
  assert.equal(input.value, "");
  assert.equal(input.files.length, 0);
});

test("the fake really is live — reading after clearing gets nothing (the original bug)", () => {
  const input = fakeInput(["IMG_0001.jpg"]);
  const list = input.files;
  input.value = "";
  assert.equal(Array.from(list).length, 0);
});

test("a cancelled picker gives an empty list", () => {
  assert.deepEqual(takeFiles({ files: null, value: "" }), []);
});
