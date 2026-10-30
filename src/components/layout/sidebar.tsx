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

  // ElevenLabs navigation groupings: Studio, Testing, Intelligence, Production
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
      title: "Optimization & Release",
      items: NAV_ITEMS.filter((i) => ["/refinement", "/deployments", "/settings"].includes(i.href)),
    },
  ];

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 px-3 py-4 select-none">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <p className="px-3 text-[11px] font-medium tracking-wide text-muted/70 uppercase">
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
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                    active
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-foreground/80 hover:bg-subtle hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-background" : "text-muted group-hover:text-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {plannedPhase && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      active ? "bg-white/20 text-white" : "bg-subtle text-muted"
                    )}>
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
      className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
    >
      {/* ElevenLabs-style minimal geometric mark */}
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Audio waveform glyph */}
          <path d="M12 3v18M17 7v10M7 8v8M21 11v2M3 11v2" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-semibold tracking-tight text-foreground text-[14px]">VocaForge</span>
        <span className="rounded-full bg-subtle border border-border px-1.5 py-0.2 text-[9px] font-mono text-muted uppercase">
          AI
        </span>
      </div>
    </Link>
  );
}
