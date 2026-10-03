import { cn } from "@/lib/utils";

/**
 * Shared class list for text inputs, selects and textareas — the form-field
 * counterpart of buttonClasses().
 *
 * Text is 16px (`text-base`): iOS Safari zooms the page into any field
 * smaller than that on focus. Single-line fields are 44px tall (`h-11`), the
 * minimum comfortable tap target (docs/mobile-first-requirement.md).
 */
export function inputClasses({
  multiline = false,
  className,
}: { multiline?: boolean; className?: string } = {}) {
  return cn(
    "rounded border border-gray-200 bg-white px-3 text-base text-black",
    multiline ? "py-2" : "h-11",
    className,
  );
}
