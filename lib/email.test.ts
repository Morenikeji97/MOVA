import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail, renderEmailShell } from "./email.ts";

test("renderEmailShell includes the heading and body", () => {
  const html = renderEmailShell({
    heading: "New message",
    bodyHtml: "<p>You have a new message.</p>",
  });
  assert.match(html, /New message/);
  assert.match(html, /You have a new message\./);
  assert.match(html, /<!DOCTYPE html>/);
});

test("renderEmailShell renders a CTA button only when both label and href are given", () => {
  const withCta = renderEmailShell({
    heading: "Test",
    bodyHtml: "<p>Body</p>",
    ctaLabel: "View details",
    ctaHref: "https://example.com/x",
  });
  assert.match(withCta, /View details/);
  assert.match(withCta, /https:\/\/example\.com\/x/);

  const withoutCta = renderEmailShell({ heading: "Test", bodyHtml: "<p>Body</p>" });
  assert.doesNotMatch(withoutCta, /View details/);
});

test("sendEmail never throws when RESEND_API_KEY is unset — it no-ops", async () => {
  const original = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    // Must resolve, not reject — every call site in this codebase awaits
    // this without a try/catch, relying on it never throwing.
    await assert.doesNotReject(
      sendEmail({ to: "buyer@example.com", subject: "Test", html: "<p>Hi</p>" }),
    );
  } finally {
    if (original !== undefined) process.env.RESEND_API_KEY = original;
  }
});
