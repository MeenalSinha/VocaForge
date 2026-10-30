import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// ElevenLabs style: Pill badges with subtle tints, crisp dot indicators, and hairline borders
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-subtle text-foreground/80 border border-border/80",
        accent: "bg-accent-soft text-accent border border-accent/20",
        success: "bg-success-soft text-success border border-success/20",
        warning: "bg-warning-soft text-warning border border-warning/20",
        danger: "bg-danger-soft text-danger border border-danger/20",
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
