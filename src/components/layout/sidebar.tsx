"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  items: typeof NAV_ITEMS;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // Group items into functional clusters for clean developer tool hierarchy
  const sections: NavSection[] = [
    {
      title: "Workspace",
      items: NAV_ITEMS.filter((i) => ["/dashboard", "/projects", "/agents"].includes(i.href)),
    },
    {
      title: "Simulation & QA",
      items: NAV_ITEMS.filter((i) => ["/virtual-customers", "/test-lab", "/results"].includes(i.href)),
    },
    {
      title: "Operations & Release",
      items: NAV_ITEMS.filter((i) => ["/refinement", "/deployments", "/settings"].includes(i.href)),
    },
  ];

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-5 px-3 py-4">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon, plannedPhase }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150",
                    active
                      ? "bg-accent-soft font-medium text-accent shadow-[inset_2px_0_0_0_hsl(var(--accent))]"
                      : "text-foreground/90 hover:bg-subtle hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-accent" : "text-muted group-hover:text-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {plannedPhase && (
                    <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-muted">
                      Phase {plannedPhase}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-md px-1 py-1 text-base font-semibold tracking-tight transition-opacity hover:opacity-90"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-[0_1px_2px_0_rgba(29,78,216,0.3)]">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v20M17 5v14M7 9v6M22 10v4M2 11v2" />
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold tracking-tight text-foreground">VocaForge</span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          v1.0
        </span>
      </div>
    </Link>
  );
}
