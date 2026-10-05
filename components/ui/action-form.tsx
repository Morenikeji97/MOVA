"use client";

import { createContext, useActionState, useContext, useRef, useTransition, type ReactNode, type Ref } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/action-result";

const PendingContext = createContext(false);

/**
 * True while the surrounding <ActionForm> (or a plain <form action>) is
 * submitting. Use in submit buttons instead of useFormStatus alone.
 */
export function useActionPending(): boolean {
  const fromForm = useFormStatus().pending;
  const fromActionForm = useContext(PendingContext);
  return fromForm || fromActionForm;
}

/**
 * A form whose server action reports back (lib/action-result.ts). Shows
 * "Saved…" or "Not saved: <reason>" right under the form, so nothing ever
 * fails silently.
 *
 * Submits through a transition instead of <form action>, so React doesn't
 * reset the fields: after a failure, everything typed is still there.
 */
export function ActionForm({
  action,
  children,
  className,
  onSaved,
  resetOnSaved = false,
  ref,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  /** Called after a confirmed save (e.g. to clear a reason box). */
  onSaved?: () => void;
  /** Clear the fields after a confirmed save (e.g. an "add" form). Never on failure. */
  resetOnSaved?: boolean;
  /** For forms that submit themselves (e.g. a select's onChange → requestSubmit()). */
  ref?: Ref<HTMLFormElement>;
}) {
  const submitted = useRef<HTMLFormElement | null>(null);
  const [result, run] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok) {
      if (resetOnSaved) submitted.current?.reset();
      onSaved?.();
    }
    return r;
  }, null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submitted.current = e.currentTarget;
        const fd = new FormData(e.currentTarget);
        // Keep which button was pressed (e.g. name="action" value="publish"),
        // which FormData(form) leaves out.
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        if (
          (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) &&
          submitter.name
        ) {
          fd.append(submitter.name, submitter.value);
        }
        startTransition(() => run(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {result ? (
        <p
          role="status"
          className={`mt-2 text-sm ${result.ok ? "text-verified-600" : "text-copper-700"}`}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
