// ShipMova — buyer ID step at sign-up, end to end in WebKit (Safari's engine).
//
// Signs in as the private test buyer (unverified) and checks:
//   - after the terms step the buyer lands on /buyer/verify-id, and can't
//     reach browsing or the dashboard until verified;
//   - in sandbox a non-test NIN is refused with "ID verification opens at
//     launch — join the waitlist." (nothing is sent to Dojah);
//   - Togo: an iPhone-style ID photo uploads to the private bucket and the
//     account shows "ShipMova is checking your ID".
// The photo stays for the founder to approve/reject in /admin/buyer-ids,
// which deletes it.
//
// E2E_BUYER_EMAIL / E2E_BUYER_PASSWORD come from .env.local (git-ignored):
//   E2E_BASE_URL=https://deploy-preview-39--mova-marketplace.netlify.app npm run e2e:buyer-id

import { webkit } from "playwright";

const base = process.env.E2E_BASE_URL;
const email = process.env.E2E_BUYER_EMAIL;
const password = process.env.E2E_BUYER_PASSWORD;
if (!base || !email || !password) {
  console.error("Set E2E_BASE_URL, E2E_BUYER_EMAIL and E2E_BUYER_PASSWORD.");
  process.exit(2);
}
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
page.setDefaultTimeout(30000);
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
const noSideScroll = async (label) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, `${label}: no sideways scroll at ${page.viewportSize().width}px (overflow ${over}px)`);
};

try {
  await page.goto(`${base}/login?next=/buyer/dashboard`, { waitUntil: "networkidle" });
  await hydrated("form");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  if (new URL(page.url()).pathname === "/terms/accept") {
    await hydrated('input[type="checkbox"]');
    for (const box of await page.locator('input[type="checkbox"]').all()) await box.check();
    await page.getByRole("button", { name: "I Agree" }).click();
    await page.waitForURL((u) => u.pathname !== "/terms/accept", { timeout: 20000 });
  }
  check(new URL(page.url()).pathname === "/buyer/verify-id", `after sign-in + terms the buyer lands on the ID step (${new URL(page.url()).pathname})`);

  for (const p of ["/browse", "/buyer/dashboard", "/referrals"]) {
    await page.goto(`${base}${p}`, { waitUntil: "domcontentloaded" });
    check(new URL(page.url()).pathname === "/buyer/verify-id", `${p} sends an unverified buyer to the ID step`);
  }

  await page.waitForLoadState("networkidle");
  await hydrated("select");
  await noSideScroll("ID step");

  // Sandbox: a real-looking NIN is refused before Dojah.
  await page.selectOption("select", "NG");
  await page.fill('input[name="legal_name"]', "Test Buyer");
  await page.fill('input[name="id_number"]', "12345678901");
  await page.getByRole("button", { name: /Verify my NIN/ }).click();
  const refused = await page
    .getByText("ID verification opens at launch — join the waitlist.")
    .waitFor({ timeout: 20000 })
    .then(() => true, () => false);
  check(refused, 'a non-test NIN shows "ID verification opens at launch — join the waitlist."');

  // Togo: ID photo.
  await page.selectOption("select", "TG");
  await page.locator('input[name="legal_name"]').fill("Test Buyer");
  await page.locator('input[value="national_id"]').check();
  await page.locator('input[type="file"]').setInputFiles(fixture("iphone-portrait.jpg"));
  const ready = await page.getByText("Photo ready.").waitFor({ timeout: 60000 }).then(() => true, () => false);
  check(ready, "the iPhone ID photo uploads (Photo ready.)");
  await page.getByRole("button", { name: "Send for review" }).click();
  // Saving swaps the form for the "being checked" card straight away.
  const sent = await page.getByText("ShipMova is checking your ID").waitFor({ timeout: 20000 }).then(() => true, () => false);
  check(sent, "sending shows that ShipMova is checking the ID");

  await page.reload({ waitUntil: "networkidle" });
  const pending = await page.getByText("ShipMova is checking your ID").isVisible();
  check(pending, "after reload the buyer sees their ID is being checked");
  await page.setViewportSize({ width: 320, height: 700 });
  await noSideScroll("pending ID step");
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll buyer ID checks passed in WebKit.");
