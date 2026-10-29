import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Bot, CheckCircle2, ShieldAlert } from "lucide-react";
import type { PreflightCheckResult } from "@/server/simulations/schema";

export interface PreflightCardProps {
  preflight: PreflightCheckResult;
}

export function PreflightCard({ preflight }: PreflightCardProps) {
  const targetAgent = preflight.targetAgent || {
    id: "",
    name: "Agent",
    remoteAgentId: "",
    primaryLanguage: "en",
    declaredCapabilities: [],
  };
  const canExecute = Boolean(preflight.canExecute);
  const summaryBlockers = preflight.summaryBlockers || [];
  const summaryWarnings = preflight.summaryWarnings || [];
  const toolSafetyNotice = preflight.toolSafetyNotice || {
    hasTools: false,
    toolNames: [],
    consequentialRiskWarning: null,
  };
  const scenarios = preflight.scenarios || [];

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Target Agent: {targetAgent.name}</span>
          <span className="rounded bg-subtle px-2 py-0.5 text-xs uppercase text-muted font-mono">
            {targetAgent.primaryLanguage}
          </span>
        </div>
        <div>
          {canExecute ? (
            <Badge tone="success" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Preflight Passed ({preflight.readyScenarios}/{preflight.totalScenarios} Scenarios Ready)
            </Badge>
          ) : (
            <Badge tone="danger" className="gap-1.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              Preflight Blocked
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Blockers */}
      {summaryBlockers.length > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-foreground">
          <div className="flex items-center gap-2 font-semibold text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Execution Blockers ({summaryBlockers.length}):</span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-muted">
            {summaryBlockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tool Safety Alert */}
      {toolSafetyNotice.hasTools && (
        <div className="rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-foreground">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Tool Safety & Consequential Execution Notice</span>
          </div>
          <p className="mt-1 text-muted leading-relaxed">
            {toolSafetyNotice.consequentialRiskWarning}
          </p>
        </div>
      )}

      {/* Summary Warnings */}
      {summaryWarnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-xs text-foreground">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Configuration Warnings ({summaryWarnings.length}):</span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-muted">
            {summaryWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scenario Breakdown */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Selected Scenarios & Virtual Customer Pairings ({scenarios.length})
        </h4>
        <div className="space-y-1.5">
          {scenarios.map((sc) => (
            <div
              key={sc.scenarioId}
              className="flex items-start justify-between gap-3 rounded-md border bg-subtle/30 p-2.5 text-xs"
            >
              <div>
                <p className="font-medium text-foreground">{sc.scenarioName}</p>
                <p className="text-muted">Customer Persona: {sc.personaName}</p>
                {sc.warnings.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠ {sc.warnings.join(" · ")}
                  </p>
                )}
                {sc.blockers.length > 0 && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    ✕ {sc.blockers.join(" · ")}
                  </p>
                )}
              </div>
              <div>
                {sc.isReady ? (
                  <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-0.5 font-medium text-danger">
                    <AlertCircle className="h-3 w-3" />
                    Needs Fix
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
