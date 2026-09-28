import Link from "next/link";
import { isPrelaunch, PRELAUNCH_BANNER } from "@/lib/prelaunch";

/** Site-wide strip shown on every page while PRELAUNCH is on. */
export function PrelaunchBanner() {
  if (!isPrelaunch()) return null;
  return (
    <div className="bg-marine-50 text-marine-700 print:hidden">
      <p className="mx-auto max-w-6xl px-6 py-2 text-center text-sm font-medium">
        <Link href="/how-it-works" className="underline-offset-2 hover:underline">
          {PRELAUNCH_BANNER}
        </Link>
      </p>
    </div>
  );
}
