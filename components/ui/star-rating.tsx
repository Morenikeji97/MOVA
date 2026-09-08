"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

/**
 * Read-only star display. `value` may be fractional (e.g. an average of 4.3);
 * the last partial star is clipped with a width overlay.
 */
export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 align-middle", className)}
      role="img"
      aria-label={`${v.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className={cn("relative", SIZES[size])}>
            <Star className={cn(SIZES[size], "absolute inset-0 text-copper-100")} strokeWidth={1.5} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={cn(SIZES[size], "fill-copper text-copper")} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Interactive 1–5 star picker (radiogroup). Keyboard: arrow keys move, the
 * hovered/focused value previews.
 */
export function StarRatingInput({
  value,
  onChange,
  name,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  name?: string;
  disabled?: boolean;
}) {
  const groupId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div
      role="radiogroup"
      aria-label="Your rating"
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {name ? <input type="hidden" name={name} value={value || ""} /> : null}
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          id={`${groupId}-${n}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(5, (value || 0) + 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(1, (value || 1) - 1));
            }
          }}
          className="rounded p-0.5 text-copper transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine-400 disabled:opacity-50"
        >
          <Star
            className={cn(
              "h-7 w-7",
              n <= shown ? "fill-copper text-copper" : "text-copper-100",
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
