import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

/**
 * Shared class list for buttons. Exported so links that should look like a
 * button (`<Link className={buttonClasses({ size: "sm" })}>`) stay in sync
 * without nesting a <button> inside an <a>.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink",
    "disabled:opacity-50 disabled:pointer-events-none",
    // Design system (redesign PR A): black primary, white-outline secondary.
    variant === "primary" && "bg-ink text-white hover:bg-neutral-800 active:bg-neutral-800",
    variant === "secondary" && "border border-ink bg-white text-ink hover:bg-band active:bg-band",
    variant === "ghost" && "text-ink hover:bg-band active:bg-band",
    // Every size is at least 44px tall (tap target); sm is just narrower.
    size === "sm" && "h-11 px-4 text-sm",
    size === "md" && "h-11 px-5 text-base",
    size === "lg" && "h-13 px-7 text-lg",
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonClasses({ variant, size, className })}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
