"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ArrowRight, Search } from "lucide-react";
import { PERSONA_TEMPLATES, type PersonaTemplate } from "@/server/personas/templates";
import { CategoryBadge } from "./status-badges";

export interface TemplateLibraryProps {
  onSelectTemplate: (template: PersonaTemplate) => void;
}

export function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  const filtered = PERSONA_TEMPLATES.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Persona Template Library</h2>
          <p className="text-xs text-muted">
            Extensible starting customer profiles representing diverse caller behaviors, edge cases, and expectations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 text-xs"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-9 rounded-md border border-border bg-surface px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <option value="all">All Categories</option>
            <option value="customer_experience">Customer Experience</option>
            <option value="pricing_policies">Pricing & Policies</option>
            <option value="communication">Communication</option>
            <option value="support">Support</option>
          </select>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Card key={t.id} className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-foreground">{t.name}</h3>
                <CategoryBadge category={t.category} />
              </div>

              <p className="text-xs text-muted leading-relaxed">
                {t.description}
              </p>

              {/* Traits / Stats */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground border border-border/60">
                  Patience: {t.initialConfig.personality.patienceLevel}/5
                </span>
                <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground border border-border/60">
                  Assertiveness: {t.initialConfig.personality.assertivenessLevel}/5
                </span>
                <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground border border-border/60">
                  Familiarity: {t.initialConfig.personality.familiarityLevel}/5
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {t.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded border border-border/80 bg-subtle/50 px-1.5 py-0.5 text-[11px] text-muted font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Sample Starting utterance */}
              {t.initialConfig.startingContext.initialUtterance && (
                <div className="rounded-md border border-border/60 bg-subtle/40 p-2.5 text-xs italic text-foreground/80">
                  &ldquo;{t.initialConfig.startingContext.initialUtterance}&rdquo;
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <Button
                size="sm"
                className="w-full"
                onClick={() => onSelectTemplate(t)}
              >
                Use This Template
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
