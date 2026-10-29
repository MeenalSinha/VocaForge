"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Rocket,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { ReleaseReadinessSnapshot } from "@/server/deployments/schema";

export interface ReadinessCardProps {
  agentName: string;
  agentVersion: number;
  readiness: ReleaseReadinessSnapshot;
  onPromote?: () => void;
  isPromoting?: boolean;
}

export function ReadinessCard({
  agentName,
  agentVersion,
  readiness,
  onPromote,
  isPromoting = false,
}: ReadinessCardProps) {
  const isReady = readiness.isReady;

  return (
    <Card className="space-y-4 p-5">
      {/* Header & Status Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-foreground">
              {agentName} (v{agentVersion})
            </h3>
            <Badge tone={isReady ? "success" : "warning"} className="text-xs uppercase">
              {isReady ? "Ready for Release" : "Release Blocked"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Readiness Score: <strong className="text-foreground">{readiness.score}%</strong> of launch criteria verified.
          </p>
        </div>

        {onPromote && (
          <Button
            variant="primary"
            size="sm"
            disabled={!isReady || isPromoting}
            onClick={onPromote}
          >
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            {isPromoting ? "Promoting..." : "Promote to Production"}
          </Button>
        )}
      </div>

      {/* Blockers Alert if any */}
      {readiness.blockers.length > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger-soft p-3.5 text-xs">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="space-y-1">
              <span className="font-semibold text-danger">
                Blocking Release Requirements ({readiness.blockers.length})
              </span>
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {readiness.blockers.map((blocker, i) => (
                  <li key={i}>{blocker}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings if any */}
      {readiness.warnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-3.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <span className="font-semibold text-warning">
                Release Warnings ({readiness.warnings.length})
              </span>
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {readiness.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Verification Checklist */}
      <div className="space-y-2.5 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Pre-Release Verification Checklist
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {readiness.checks.map((check) => (
            <div
              key={check.id}
              className={`flex items-start gap-2.5 rounded-md border p-3 text-xs ${
                check.passed
                  ? "border-border bg-surface text-foreground"
                  : check.isBlocker
                  ? "border-danger/30 bg-danger-soft/20 text-foreground"
                  : "border-warning/30 bg-warning-soft/20 text-foreground"
              }`}
            >
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : check.isBlocker ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">{check.name}</p>
                <p className="text-[11px] text-muted">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

