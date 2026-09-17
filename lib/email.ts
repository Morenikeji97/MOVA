import { Resend } from "resend";

/**
 * Transactional email sending for MOVA — the first app-code-driven email
 * sending in this codebase. There is no existing SMTP/email infrastructure
 * to reuse: no email dependency, no SMTP env vars (locally or in Netlify),
 * nothing beyond Supabase Auth's own hosted email sending (used only for
 * signup confirmation and password reset, via a template configured in the
 * Supabase dashboard — see supabase/email-templates/recovery.html — which
 * app code never calls into and can't reuse for arbitrary notifications).
 * The one existing hint of a plan was an unused `RESEND_API_KEY` placeholder
 * already reserved in .env.example under "Added in later phases" — Resend is
 * used here for exactly that reason, not Zoho.
 *
 * `sendEmail` never throws. Every trigger point in this codebase (chat
 * messages, payments, reservations, reviews, disputes) must keep working
 * even if email sending is unconfigured, misconfigured, or the provider is
 * down — callers should never need a try/catch around this.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`sendEmail: RESEND_API_KEY not set — skipping "${subject}" to ${to}`);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS || "MOVA <notifications@shipmova.com>",
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`sendEmail: Resend rejected "${subject}" to ${to}:`, error);
    }
  } catch (err) {
    console.error(`sendEmail: failed to send "${subject}" to ${to}:`, err);
  }
}

/**
 * Shared HTML shell for every notification email — same table-based layout,
 * colors, and inlined styles as supabase/email-templates/recovery.html (the
 * one existing email template in this codebase), so a MOVA email looks like
 * a MOVA email regardless of which system sent it. Table-based (not <div>)
 * for the same reason as that file: Outlook's Word-based HTML engine ignores
 * a lot of modern CSS.
 *
 * Kept deliberately short — one heading, one short paragraph, one optional
 * button — per the "keep emails short and actionable" requirement.
 */
export function renderEmailShell({
  heading,
  bodyHtml,
  ctaLabel,
  ctaHref,
}: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
}): string {
  const button =
    ctaLabel && ctaHref
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td style="border-radius:8px; background-color:#B8622A;">
              <a href="${ctaHref}" style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:8px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${heading}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F3F4F1; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F1; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #EBECE8;">
            <tr>
              <td style="background-color:#0E1B2C; padding:24px 32px;">
                <span style="font-family:'SFMono-Regular',ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF;">MOVA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px; font-size:20px; line-height:28px; color:#0E1B2C;">${heading}</h1>
                <div style="margin:0; font-size:15px; line-height:24px; color:#5B6472;">${bodyHtml}</div>
                ${button}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#F3F4F1; border-top:1px solid #EBECE8;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#5C7086;">
                  You&rsquo;re receiving this because of activity on your MOVA account.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
