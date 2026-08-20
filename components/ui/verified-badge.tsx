import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  label?: string;
  className?: string;
}

export function VerifiedBadge({ label = "Verified Listing", className }: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-verified-50 px-2.5 py-1 text-sm font-medium text-verified-600",
        className
      )}
    >
      <BadgeCheck className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </span>
  );
}
