import { cn } from "@/lib/utils";

interface VinDataProps {
  label: string;
  value: string;
  className?: string;
}

export function VinData({ label, value, className }: VinDataProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}
