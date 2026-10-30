import * as React from "react";
import { cn } from "@/lib/utils";

// ElevenLabs style: Clean geometric inputs with smooth borders and subtle focus states
const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/50 transition-all duration-150 focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => (
    <input
      ref={ref}
      className={cn(control, "h-9 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]", className)}
      {...p}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => (
    <textarea
      ref={ref}
      className={cn(control, "min-h-24 py-2.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]", className)}
      {...p}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => (
    <select
      ref={ref}
      className={cn(
        control,
        "h-9 pr-8 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] cursor-pointer bg-no-repeat",
        className,
      )}
      {...p}
    />
  ),
);
Select.displayName = "Select";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (a: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
}

/** Associates label, hint and error with the control for assistive technology. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-foreground/80 tracking-tight">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && <p id={`${id}-hint`} className="text-[11px] text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
