"use client";

import { Menu, ShieldCheck, X } from "lucide-react";
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
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr] bg-background">
      <a
        href="#main"
        className="sr-only rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 shadow-md"
      >
        Skip to content
      </a>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-screen md:flex-col justify-between">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex h-14 items-center border-b border-border/70 px-4">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
        </div>

        {/* System Heartbeat & Operational Status */}
        <div className="border-t border-border/70 p-3 bg-subtle/30">
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground">Operational</span>
            </div>
            <span className="text-[11px] font-mono text-muted">v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-col">
        {/* Mobile Header Bar */}
        <div className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        {/* Mobile Navigation Drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-foreground/30 backdrop-blur-xs transition-opacity"
              onClick={() => setOpen(false)}
            />
            <div
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl border-r border-border"
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Brand />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                  autoFocus
                >
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Desktop Top Utilities Bar */}
        <div className="hidden md:flex h-12 items-center justify-between border-b border-border/60 bg-surface/80 backdrop-blur-xs px-8">
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            <span>Autonomous Quality Engineering Active</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Connected
            </span>
          </div>
        </div>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
