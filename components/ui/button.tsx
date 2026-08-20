import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded font-sans font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marine-400",
          "disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-copper text-white hover:bg-copper-700 active:bg-copper-700",
          variant === "secondary" &&
            "border border-marine text-marine hover:bg-marine-50",
          variant === "ghost" && "text-slate hover:bg-paper-200",
          size === "sm" && "h-9 px-3 text-sm",
          size === "md" && "h-11 px-5 text-base",
          size === "lg" && "h-13 px-7 text-lg",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
