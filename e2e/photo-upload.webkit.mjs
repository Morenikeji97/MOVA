// ShipMova — listing photo upload, end to end in WebKit (Safari's engine).
//
// Signs in as a seller, picks photos on the new-listing form exactly as a
// phone does, and checks that every pick is either shown or explained:
//   - two iPhone-style JPEGs (one with an EXIF rotation) must appear,
//     resized, as WebP thumbnails;
//   - a HEIC must produce a visible error, not silence.
// Then it removes the uploaded photos again (the × button deletes them from
// Storage). Regression test for the silent iPhone upload failure fixed in
// PR #32 (lib/file-input.ts).
//
// Needs a running site and a seller account whose terms are accepted.
// E2E_SELLER_EMAIL / E2E_SELLER_PASSWORD come from .env.local (git-ignored)
// or CI secrets — never commit them:
//   E2E_BASE_URL=http://localhost:3000 npm run e2e:photos
// One-time browser setup: npx playwright install --with-deps webkit

import { webkit } from "playwright";

const base = process.env.E2E_BASE_URL;
const email = process.env.E2E_SELLER_EMAIL;
const password = process.env.E2E_SELLER_PASSWORD;
if (!base || !email || !password) {
  console.error("Set E2E_BASE_URL, E2E_SELLER_EMAIL and E2E_SELLER_PASSWORD.");
  process.exit(2);
}
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const PHOTO_INPUT = 'input[type="file"][multiple][accept="image/jpeg,image/png,image/webp"]';
const PHOTO = 'img[alt^="Vehicle photo"]';

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// The library's default action timeout is none: a stuck click would hang forever.
page.setDefaultTimeout(30000);
// Interacting before React hydrates loses input (hydration resets it).
const hydrated = (selector) =>
  page.waitForFunction(
    (s) => Object.keys(document.querySelector(s) ?? {}).some((k) => k.startsWith("__react")),
    selector,
  );
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await hydrated("form");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  await page.goto(`${base}/seller/listings/new`, { waitUntil: "networkidle" });
  await hydrated(PHOTO_INPUT);
  const input = page.locator(PHOTO_INPUT);

  // 1. Two iPhone photos picked at once.
  await input.setInputFiles([fixture("iphone-rotated.jpg"), fixture("iphone-portrait.jpg")]);
  await page.locator(PHOTO).nth(1).waitFor({ timeout: 60000 }).catch(() => {});
  // Tiles are loading="lazy" and sit below the fold: bring them into view.
  await page.locator(PHOTO).first().scrollIntoViewIfNeeded().catch(() => {});
  await page
    .waitForFunction(
      (sel) => [...document.querySelectorAll(sel)].every((i) => i.complete && i.naturalWidth > 0),
      PHOTO,
      { timeout: 20000 },
    )
    .catch(() => {});
  const photos = await page.$$eval(PHOTO, (imgs) =>
    imgs.map((img) => ({ src: img.currentSrc, w: img.naturalWidth, h: img.naturalHeight })),
  );
  check(photos.length === 2, `two picked photos appear (got ${photos.length})`);
  check(photos.length === 2 && photos.every((p) => p.src.endsWith("-thumb.webp")), "each shows its WebP thumbnail");
  check(
    photos.length === 2 && photos.every((p) => Math.max(p.w, p.h) === 480 && p.h > p.w),
    `thumbnails are 480px and upright portrait (${photos.map((p) => `${p.w}x${p.h}`).join(", ")})`,
  );

  // 2. A HEIC must explain itself.
  await input.setInputFiles(fixture("photo.heic"));
  const heicError = await page
    .getByText(/photo\.heic: HEIC photos aren't supported/)
    .waitFor({ timeout: 20000 })
    .then(() => true, () => false);
  check(heicError, "a HEIC shows a visible error");
  check((await page.locator(PHOTO).count()) === 2, "the HEIC adds no photo");
} finally {
  // Clean up: × deletes each uploaded file from Storage.
  for (let n = await page.locator(PHOTO).count(); n > 0; n--) {
    await page.getByRole("button", { name: /^Remove photo 1$/ }).click();
    await page.waitForTimeout(500);
  }
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll photo upload checks passed in WebKit.");
