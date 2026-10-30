"use client";

import { Menu, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Brand, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr] bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      <a
        href="#main"
        className="sr-only rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 shadow-md"
      >
        Skip to content
      </a>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden border-r border-border/70 bg-surface/80 backdrop-blur-md md:sticky md:top-0 md:flex md:h-screen md:flex-col justify-between">
        <div className="flex flex-col min-h-0 flex-1">
          {/* Workspace Brand / Header */}
          <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
        </div>

        {/* ElevenLabs Status Pill Footer */}
        <div className="border-t border-border/60 p-3 bg-surface/40">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface px-3 py-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground/90">ElevenLabs Connected</span>
            </div>
            <span className="text-[10px] font-mono text-muted">v1.0</span>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col min-h-screen">
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-surface/80 backdrop-blur-md px-4 md:hidden sticky top-0 z-40">
          <Brand />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Flyout Navigation Dialog */}
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-0 top-14 z-50 flex flex-col bg-surface/95 backdrop-blur-md p-4 md:hidden"
          >
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        )}

        {/* Top Control Bar with Breadcrumbs / Workspace Indicator */}
        <div className="hidden md:flex h-12 items-center justify-between border-b border-border/60 bg-surface/50 backdrop-blur-sm px-8 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted">Workspace:</span>
            <span className="rounded-full bg-subtle px-2.5 py-0.5 font-medium text-foreground border border-border/60">
              Autonomous Quality Engineering
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Voice Synthesis Engine Ready
            </span>
          </div>
        </div>

        {/* Main Content Workspace */}
        <main id="main" className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
