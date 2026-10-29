import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-[0_1px_3px_0_rgba(15,23,42,0.02)]">
    <table className={cn("w-full text-left text-sm divide-y divide-border/60", className)} {...p} />
  </div>
);

export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    scope="col"
    className={cn(
      "border-b border-border/80 bg-subtle/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
      className,
    )}
    {...p}
  />
);

export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-b border-border/60 px-4 py-3.5 align-middle text-sm", className)} {...p} />
);
