import { cn } from "@/lib/utils";

interface VinDataProps {
  label: string;
  value: string;
  className?: string;
}

export function VinData({ label, value, className }: VinDataProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </span>
      <span className="font-mono text-base text-ink-900">{value}</span>
    </div>
  );
}
