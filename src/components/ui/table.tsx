import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto rounded-lg border bg-surface">
    <table className={cn("w-full text-left text-sm", className)} {...p} />
  </div>
);
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn("border-b bg-subtle px-4 py-2.5 text-xs font-medium text-muted", className)} {...p} />
);
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-b px-4 py-3 align-top last:border-b-0", className)} {...p} />
);
