"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Move one of the seller's own draft listings into the review queue.
 * Bound to a <form action={submitForReview}> with a hidden `id` field.
 */
export async function submitForReview(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // The seller_id / status filters keep this to the caller's own drafts;
  // the vehicles RLS policy enforces the same ownership check server-side.
  await supabase
    .from("vehicles")
    .update({ status: "pending_review" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("status", "draft");

  revalidatePath("/seller/listings");
}
