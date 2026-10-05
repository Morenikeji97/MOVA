/**
 * ShipMova — what every form action reports back. Never silent: the form
 * shows "Saved…" only once the write is confirmed, otherwise
 * "Not saved: <reason>". Rendered by components/ui/action-form.tsx.
 */
export type ActionResult = { ok: boolean; message: string } | null;

export function saved(message: string): ActionResult {
  return { ok: true, message };
}

export function notSaved(reason: string): ActionResult {
  return { ok: false, message: `Not saved: ${reason}` };
}

export const SESSION_ENDED = "your session has ended or you don't have access. Sign in again (with your code, for admin).";

/**
 * Confirms an insert/update/delete that ended with `.select(...)`: an error
 * becomes "Not saved: <error>", and zero rows (RLS refused it, or a status
 * filter didn't match because someone else already changed it) becomes
 * "Not saved: <nothingChanged>". Returns null when the write took effect.
 */
export function checkWrite(
  result: { data: unknown[] | null; error: { message: string } | null },
  nothingChanged = "nothing was changed. It may already have been updated — reload to see the current state.",
): ActionResult {
  if (result.error) return notSaved(result.error.message);
  if (!result.data || result.data.length === 0) return notSaved(nothingChanged);
  return null;
}

/** Success, noting if the admin audit entry couldn't be written. */
export function savedWithAudit(message: string, auditError: string | null): ActionResult {
  return auditError
    ? { ok: true, message: `${message} (Warning: the audit log entry failed: ${auditError}. Tell the developer.)` }
    : saved(message);
}
