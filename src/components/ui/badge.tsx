import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium tracking-tight transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-subtle text-foreground border border-border/80",
        accent: "bg-accent-soft text-accent border border-accent/25",
        success: "bg-success-soft text-success border border-success/25",
        warning: "bg-warning-soft text-warning border border-warning/25",
        danger: "bg-danger-soft text-danger border border-danger/25",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  tone,
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}
