import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaUrl } from "./media-url.ts";

const SB = "https://dplwwsednwkcvhgnuvgw.supabase.co";

test("public photo URL -> /media/<bucket>/<path>", () => {
  assert.equal(
    mediaUrl(`${SB}/storage/v1/object/public/vehicle-photos/seller-uid/abc.jpg`, SB),
    "/media/vehicle-photos/seller-uid/abc.jpg",
  );
});

test("public video URL -> /media/<bucket>/<path>", () => {
  assert.equal(
    mediaUrl(`${SB}/storage/v1/object/public/vehicle-videos/seller-uid/clip.mp4`, SB),
    "/media/vehicle-videos/seller-uid/clip.mp4",
  );
});

test("signed URL keeps its token", () => {
  assert.equal(
    mediaUrl(`${SB}/storage/v1/object/sign/vehicle-title-photos/u/t.png?token=eyJabc`, SB),
    "/media-signed/vehicle-title-photos/u/t.png?token=eyJabc",
  );
});

test("a trailing slash on the project URL doesn't matter", () => {
  assert.equal(
    mediaUrl(`${SB}/storage/v1/object/public/vehicle-photos/a.jpg`, `${SB}/`),
    "/media/vehicle-photos/a.jpg",
  );
});

test("other hosts and non-storage URLs are left alone", () => {
  assert.equal(mediaUrl("https://example.com/a.jpg", SB), "https://example.com/a.jpg");
  assert.equal(mediaUrl(`${SB}/rest/v1/vehicles`, SB), `${SB}/rest/v1/vehicles`);
  assert.equal(mediaUrl("/media/vehicle-photos/a.jpg", SB), "/media/vehicle-photos/a.jpg");
  assert.equal(
    mediaUrl("https://evil.supabase.co.example.com/storage/v1/object/public/x.jpg", SB),
    "https://evil.supabase.co.example.com/storage/v1/object/public/x.jpg",
  );
});

test("empty input gives an empty src", () => {
  assert.equal(mediaUrl(null, SB), "");
  assert.equal(mediaUrl(undefined, SB), "");
});
