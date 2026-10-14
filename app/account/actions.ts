"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notSaved, saved, SESSION_ENDED, type ActionResult } from "@/lib/action-result";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { confirmedDelete } from "@/lib/account-deletion";
import { notifyAccountDeletionRequested } from "@/lib/notifications";

/**
 * Ask ShipMova to delete your account. Sensitive, so it re-checks the
 * password (a throwaway client: the browser session isn't touched) and needs
 * the confirmation word. Creates one pending request (RLS: own, pending
 * only; one pending per person); staff process it from Action required.
 */
export async function requestAccountDeletion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return notSaved(SESSION_ENDED);

  if (!confirmedDelete(formData.get("confirm"))) return notSaved('type DELETE to confirm.');
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) return notSaved("enter your password.");
  if (!(await checkRateLimit(`account-delete:${user.id}`, 5, 3600))) return notSaved(RATE_LIMIT_MESSAGE);

  const check = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await check.auth.signInWithPassword({ email: user.email, password });
  if (authError) return notSaved("that password isn't right.");
  // Only this throwaway session — the default ("global") would sign them out everywhere.
  await check.auth.signOut({ scope: "local" }).catch(() => {});

  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim().slice(0, 1000) : null;
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: user.id, reason })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return notSaved("you already asked — ShipMova is processing it.");
    return notSaved(error.message);
  }
  await notifyAccountDeletionRequested(data.id);
  revalidatePath("/account");
  return saved("Request sent. ShipMova will email you when your account is deleted, usually within 3 days.");
}
