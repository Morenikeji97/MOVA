import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUYER_ID_BUCKET, idCountry } from "@/lib/id-verification";
import { BuyerIdReviewForms } from "./review-forms";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
/** ID photo links work for 5 minutes, only from this code-checked page. */
const PHOTO_LINK_SECONDS = 300;

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/**
 * Buyer IDs waiting for the founder: names that didn't match the NIN /
 * Ghana Card record, and Togo/Benin ID photos. The photo bucket has no read
 * rule for anyone; this page (admin with the authenticator code) makes a
 * short-lived link with the service role. Deciding deletes the photo.
 */
export default async function AdminBuyerIdsPage() {
  const ctx = await requireAdmin();
  if (!ctx) redirect("/login?next=/admin/buyer-ids");

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("buyer_profiles")
    .select(
      "user_id, id_country, id_method, id_legal_name, id_record_name, id_name_match, id_document_type, id_document_path, created_at",
    )
    .eq("verification_status", "pending")
    .not("id_method", "is", null)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);

  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: users } = ids.length
    ? await admin.from("users").select("id, email, is_test_account").in("id", ids)
    : { data: [] };
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  const photos = new Map<string, string>();
  for (const r of rows ?? []) {
    if (!r.id_document_path) continue;
    const { data } = await admin.storage.from(BUYER_ID_BUCKET).createSignedUrl(r.id_document_path, PHOTO_LINK_SECONDS);
    if (data?.signedUrl) photos.set(r.user_id, data.signedUrl);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">Buyer IDs to review</h1>
      <p className="mt-2 text-sm text-gray-500">
        These buyers can&rsquo;t use their account until you decide. Approving or rejecting
        deletes the ID photo; the decision is kept in the audit log.
      </p>

      {error ? (
        <p className="mt-6 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Couldn&rsquo;t load buyer IDs: {error.message}
        </p>
      ) : !rows || rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing to review.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map((r) => {
            const u = userById.get(r.user_id);
            const country = idCountry(r.id_country);
            const photo = photos.get(r.user_id);
            return (
              <li key={r.user_id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="break-all font-medium text-black">
                    {u?.email ?? r.user_id}
                    {u?.is_test_account ? (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">TEST</span>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-gray-500">Signed up {when.format(new Date(r.created_at))}</p>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {country?.name ?? r.id_country} ·{" "}
                  {r.id_method === "document"
                    ? r.id_document_type === "passport"
                      ? "Passport photo"
                      : "National ID photo"
                    : `${country?.idLabel} found — name didn't match`}
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Name they typed</dt>
                    <dd className="text-black">{r.id_legal_name}</dd>
                  </div>
                  {r.id_record_name ? (
                    <div>
                      <dt className="text-gray-500">Name on the government record</dt>
                      <dd className="text-black">{r.id_record_name}</dd>
                    </div>
                  ) : null}
                </dl>
                {r.id_document_path ? (
                  photo ? (
                    <a href={photo} target="_blank" rel="noreferrer" className="mt-3 block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived link */}
                      <img
                        src={photo}
                        alt="Buyer's ID"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="max-h-80 w-full rounded border border-gray-200 object-contain"
                      />
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-copper-700">The ID photo couldn&rsquo;t be loaded.</p>
                  )
                ) : null}
                <BuyerIdReviewForms buyerId={r.user_id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
