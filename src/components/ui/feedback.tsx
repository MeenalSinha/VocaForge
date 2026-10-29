import { AlertTriangle, CheckCircle2, Info, Loader2, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-accent/25 bg-accent-soft text-foreground", icon: Info },
  success: { cls: "border-success/25 bg-success-soft text-foreground", icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning-soft text-foreground", icon: AlertTriangle },
  danger: { cls: "border-danger/25 bg-danger-soft text-foreground", icon: AlertTriangle },
} satisfies Record<string, { cls: string; icon: LucideIcon }>;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, icon: Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border px-4 py-3", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-0.5 text-sm">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("animate-pulse rounded bg-subtle", className)} />
);

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      {Icon && <Icon className="h-6 w-6 text-muted" aria-hidden />}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="mx-auto max-w-md text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** Used when a server-side load fails. Shows a sanitized message, never a stack trace. */
export function ErrorState({ title = "Something went wrong", message, children }: { title?: string; message: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger" title={title}>{message}</Alert>
      {children}
    </div>
  );
}
