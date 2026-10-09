// ShipMova — shipper insurance certificate upload, end to end in WebKit.
//
// Signs in as the private test buyer account (shippers use ordinary
// accounts), applies as a shipper (a pending application is never public),
// then in the shipper portal uploads an iPhone photo and a PDF certificate
// and sends the PDF for review. Checks there's no sideways scroll at 360px
// and 320px. Clean up afterwards with the service role (see the PR).
//
//   E2E_BASE_URL=http://localhost:3100 npm run e2e:shipper-coi

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
const seen = (text, timeout = 20000) =>
  page.getByText(text).first().waitFor({ timeout }).then(() => true, () => false);

try {
  await page.goto(`${base}/login?next=/shipper/signup`, { waitUntil: "networkidle" });
  await hydrated("form");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  check(new URL(page.url()).pathname === "/shipper/signup", `an unverified buyer-role login reaches the shipper application (${new URL(page.url()).pathname})`);

  await page.waitForLoadState("networkidle");
  await hydrated('input[name="company_name"]');
  await page.fill('input[name="company_name"]', "E2E Test Shipper (delete me)");
  await page.fill('input[name="contact_name"]', "Test Person");
  await page.fill('input[name="contact_email"]', email);
  await page.fill('input[name="contact_phone"]', "+15555550100");
  await page.fill('input[name="fmc_oti_license_number"]', "023456N");
  await page.locator('input[name="service_countries"]').first().check();
  await page.locator('input[name="service_areas"]').first().check();
  await page.locator('input[name="terms_accepted"]').check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/shipper/signup/success"), { timeout: 30000 });
  check(true, "application submitted");

  await page.goto(`${base}/shipper/portal`, { waitUntil: "networkidle" });
  check(await seen("Verification"), "portal shows the Verification section for a pending application");
  check(await seen("Upload your certificate of marine cargo insurance."), "it asks for the certificate");
  await noSideScroll("shipper portal (pending)");

  const file = page.locator('input[type="file"]');
  await hydrated('input[type="file"]');
  await file.setInputFiles(fixture("iphone-portrait.jpg"));
  check(await seen("Certificate ready.", 60000), "an iPhone photo of the certificate uploads");
  await file.setInputFiles(fixture("test-coi.pdf"));
  check(await seen("Certificate ready.", 60000), "a PDF certificate uploads");

  await page.fill('input[name="insurer"]', "Test Marine Insurance Co");
  await page.fill('input[name="cargo_limit_usd"]', "50000");
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  await page.fill('input[name="expires_on"]', nextYear);
  await page.getByRole("button", { name: "Send certificate for review" }).click();
  check(await seen("ShipMova is checking your certificate."), "sending shows the certificate is being checked");

  await page.reload({ waitUntil: "networkidle" });
  check(await seen("ShipMova is checking your certificate."), "after reload it's still being checked");
  check(await seen("ShipMova will check your license on the FMC's OTI list."), "license shows as not yet checked");
  await page.setViewportSize({ width: 320, height: 700 });
  await noSideScroll("shipper portal (certificate pending)");
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll shipper certificate checks passed in WebKit.");
