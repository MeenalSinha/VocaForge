import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// ElevenLabs-inspired tactile buttons: clean geometry, subtle pills, near-black primary
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.985]",
  {
    variants: {
      variant: {
        primary:
          "bg-foreground text-background hover:bg-foreground/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.12)] border border-foreground/10",
        secondary:
          "border border-border bg-surface text-foreground hover:bg-subtle/80 hover:border-foreground/20 shadow-xs",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm shadow-accent/20 border border-accent/20",
        ghost: "text-foreground hover:bg-subtle hover:text-foreground",
        danger:
          "bg-danger text-white hover:bg-danger/90 shadow-xs active:scale-[0.985]",
        subtle:
          "bg-subtle text-foreground hover:bg-border/60 border border-transparent",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-full",
        md: "h-9 px-4 text-sm rounded-full",
        lg: "h-10 px-5 text-sm rounded-full font-semibold",
        icon: "h-8 w-8 rounded-full",
        "icon-sm": "h-7 w-7 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
