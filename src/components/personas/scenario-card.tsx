"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Copy, Pencil, Trash2, User } from "lucide-react";
import type { PersonaRecord, ScenarioRecord } from "@/server/personas/schema";
import { ScenarioPriorityBadge, ScenarioStatusBadge } from "./status-badges";

export interface ScenarioCardProps {
  scenario: ScenarioRecord;
  persona?: PersonaRecord | null;
  agentName?: string | null;
  onEdit: (scenario: ScenarioRecord) => void;
  onDuplicate: (scenario: ScenarioRecord) => void;
  onArchive: (scenario: ScenarioRecord) => void;
}

export function ScenarioCard({
  scenario,
  persona,
  agentName,
  onEdit,
  onDuplicate,
  onArchive,
}: ScenarioCardProps) {
  const { config } = scenario;

  return (
    <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">{scenario.name}</h3>
            {scenario.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted">
                {scenario.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <ScenarioStatusBadge status={scenario.status} />
            <ScenarioPriorityBadge priority={scenario.priority} />
          </div>
        </div>

        {/* Association Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {persona && (
            <span className="flex items-center gap-1 rounded bg-subtle px-2 py-0.5 font-medium text-foreground">
              <User className="h-3 w-3 text-accent" />
              {persona.name}
            </span>
          )}
          {agentName ? (
            <span className="flex items-center gap-1 rounded bg-subtle px-2 py-0.5 font-medium text-foreground">
              <Bot className="h-3 w-3 text-muted" />
              {agentName}
            </span>
          ) : (
            <span className="rounded bg-subtle/50 px-2 py-0.5 text-xs text-muted">
              Any agent
            </span>
          )}
          <span className="rounded bg-subtle/50 px-2 py-0.5 text-xs text-muted">
            Max {config.executionLimits.maxTurns} turns
          </span>
        </div>

        {/* Success Criteria Preview */}
        {config.evaluation.successCriteria.length > 0 && (
          <div className="rounded-md border bg-subtle/40 p-2.5 text-xs">
            <span className="font-semibold text-foreground">
              Success Criteria ({config.evaluation.successCriteria.length}):
            </span>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted line-clamp-2">
              {config.evaluation.successCriteria.slice(0, 2).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{config.evaluation.failureConditions.length} failure condition(s)</span>
          <span title={scenario.updatedAt}>
            Updated {new Date(scenario.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onEdit(scenario)}
            title="Edit scenario"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDuplicate(scenario)}
            title="Duplicate scenario"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {scenario.status !== "archived" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArchive(scenario)}
              title="Archive scenario"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted hover:text-danger" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
