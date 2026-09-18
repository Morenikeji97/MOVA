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
    "inline-flex items-center justify-center rounded font-sans font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black",
    "disabled:opacity-50 disabled:pointer-events-none",
    variant === "primary" &&
      "bg-black text-white hover:bg-gray-800 active:bg-gray-800",
    variant === "secondary" &&
      "border border-black text-black hover:bg-gray-100",
    variant === "ghost" && "text-gray-700 hover:bg-gray-100",
    size === "sm" && "h-9 px-3 text-sm",
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
