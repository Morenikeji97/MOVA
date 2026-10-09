"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { DELETE_CONFIRM_WORD } from "@/lib/account-deletion";
import { requestAccountDeletion } from "./actions";

function Submit() {
  const pending = useActionPending();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full border-copper-700 text-copper-700 sm:w-auto">
      {pending ? "Sending…" : "Delete my account"}
    </Button>
  );
}

export function DeleteAccountForm() {
  return (
    <ActionForm action={requestAccountDeletion} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        Why are you leaving? (optional)
        <textarea name="reason" rows={2} maxLength={1000} className={inputClasses({ multiline: true })} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Your password
        <input name="password" type="password" required autoComplete="current-password" className={inputClasses()} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Type {DELETE_CONFIRM_WORD} to confirm
        <input name="confirm" required autoComplete="off" autoCapitalize="characters" className={inputClasses()} />
      </label>
      <Submit />
    </ActionForm>
  );
}
