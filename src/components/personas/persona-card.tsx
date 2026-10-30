"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import type { PersonaRecord } from "@/server/personas/schema";
import { CategoryBadge, PersonaStatusBadge } from "./status-badges";

export interface PersonaCardProps {
  persona: PersonaRecord;
  scenarioCount?: number;
  onPreview: (persona: PersonaRecord) => void;
  onEdit: (persona: PersonaRecord) => void;
  onDuplicate: (persona: PersonaRecord) => void;
  onArchive: (persona: PersonaRecord) => void;
  onCreateScenario: (persona: PersonaRecord) => void;
}

export function PersonaCard({
  persona,
  scenarioCount = 0,
  onPreview,
  onEdit,
  onDuplicate,
  onArchive,
  onCreateScenario,
}: PersonaCardProps) {
  const config = persona.config || ({} as Partial<typeof persona.config>);
  const p = config.personality || {
    traits: [],
    patienceLevel: 3,
    assertivenessLevel: 3,
    familiarityLevel: 2,
  };
  const language = config.language || { primary: "en", additional: [] };
  const defaultObjective = config.defaultObjective || { intent: "" };

  return (
    <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{persona.name}</h3>
            {persona.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted">
                {persona.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <PersonaStatusBadge status={persona.status} />
            <CategoryBadge category={persona.category} />
          </div>
        </div>

        {/* Traits & Metrics */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground">
            Patience: {p.patienceLevel ?? 3}/5
          </span>
          <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground">
            Assertiveness: {p.assertivenessLevel ?? 3}/5
          </span>
          <span className="rounded bg-subtle px-2 py-0.5 font-medium text-foreground">
            Familiarity: {p.familiarityLevel ?? 2}/5
          </span>
          <span className="rounded bg-subtle px-2 py-0.5 font-medium uppercase text-muted">
            {language.primary || "en"}
          </span>
          {(language.additional || []).length > 0 && (
            <span className="rounded bg-subtle px-1.5 py-0.5 text-xs text-muted">
              +{(language.additional || []).join(", ")}
            </span>
          )}
        </div>

        {/* Personality Traits Chips */}
        {(p.traits || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(p.traits || []).slice(0, 4).map((trait, i) => (
              <span
                key={i}
                className="rounded-full border bg-surface px-2 py-0.5 text-xs text-muted"
              >
                {trait}
              </span>
            ))}
            {(p.traits || []).length > 4 && (
              <span className="text-xs text-muted">+{(p.traits || []).length - 4} more</span>
            )}
          </div>
        )}

        {/* Objective Preview */}
        {defaultObjective.intent && (
          <div className="rounded-md border bg-subtle/50 p-2.5 text-xs">
            <span className="font-medium text-foreground">Objective: </span>
            <span className="text-muted line-clamp-2">
              {defaultObjective.intent}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>v{persona.version} · {scenarioCount} scenario(s)</span>
          <span title={persona.updatedAt}>
            Updated {new Date(persona.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPreview(persona)}
              title="Inspect configuration"
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Inspect
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(persona)}
              title="Edit persona"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDuplicate(persona)}
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {persona.status !== "archived" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onArchive(persona)}
                title="Archive"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted hover:text-danger" />
              </Button>
            )}
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => onCreateScenario(persona)}
            title="Create test scenario using this customer"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Scenario
          </Button>
        </div>
      </div>
    </Card>
  );
}
