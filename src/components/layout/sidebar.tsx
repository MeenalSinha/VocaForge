"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon, plannedPhase }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
              active ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-subtle",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {plannedPhase && <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-muted">Phase {plannedPhase}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 rounded px-1 text-base font-semibold tracking-tight">
      <span aria-hidden className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-bold text-accent-foreground">V</span>
      VocaForge
    </Link>
  );
}
