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
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Skip to content
      </a>

      <aside className="hidden border-r bg-surface md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex h-14 items-center border-b px-4"><Brand /></div>
        <Sidebar />
        <p className="border-t px-4 py-3 text-xs text-muted">Foundation release (Phases 0 and 1)</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="flex h-14 items-center justify-between border-b bg-surface px-4 md:hidden">
          <Brand />
          <Button variant="ghost" size="icon" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button aria-label="Close navigation" className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
            <div id="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <Brand />
                <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpen(false)} autoFocus>
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
