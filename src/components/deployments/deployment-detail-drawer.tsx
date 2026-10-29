"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { DeploymentRecord } from "@/server/deployments/schema";

export interface DeploymentDetailDrawerProps {
  deployment: DeploymentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollback?: (deployment: DeploymentRecord) => void;
}

export function DeploymentDetailDrawer({
  deployment,
  open,
  onOpenChange,
  onRollback,
}: DeploymentDetailDrawerProps) {
  if (!deployment) return null;

  const isDeployed = deployment.status === "deployed";
  const r = deployment.readinessSnapshot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Deployment Detail — ${deployment.agentName || "Agent"}`}
        description={`Release Candidate (v${deployment.agentVersion}) for ${deployment.environment}`}
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <div className="space-y-4 pt-2 text-xs">
          {/* Header Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  isDeployed
                    ? "success"
                    : deployment.status === "failed"
                    ? "danger"
                    : deployment.status === "ready_for_release"
                    ? "accent"
                    : "warning"
                }
                className="capitalize"
              >
                {deployment.status.replace(/_/g, " ")}
              </Badge>
              <Badge tone="neutral" className="uppercase">
                {deployment.environment}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>Created: {new Date(deployment.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded border bg-surface p-3 space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase">Configuration Version</span>
              <p className="text-sm font-bold text-foreground">v{deployment.agentVersion}</p>
            </div>
            <div className="rounded border bg-surface p-3 space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase">ElevenLabs Remote ID</span>
              <p className="font-mono text-xs text-foreground font-medium truncate">
                {deployment.remoteAgentId || "(none)"}
              </p>
            </div>
          </div>

          {/* Deployment Notes */}
          {deployment.notes && (
            <div className="rounded border bg-surface p-3 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-accent" />
                Deployment Notes
              </span>
              <p className="text-muted leading-relaxed whitespace-pre-wrap">{deployment.notes}</p>
            </div>
          )}

          {/* Historical Readiness Snapshot */}
          {r && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  Readiness Snapshot at Deployment
                </span>
                <span className="text-muted text-[11px]">
                  Pass Rate: <strong className="text-foreground">{r.passRatePercentage}%</strong> ({r.passedRunsCount}/{r.testedRunsCount} passed)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {(r.checks || []).map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-2 rounded border bg-subtle/30 p-2 text-[11px]"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{check.name}</p>
                      <p className="text-muted">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            {onRollback && isDeployed && (
              <Button
                variant="danger"
                onClick={() => {
                  onOpenChange(false);
                  onRollback(deployment);
                }}
              >
                Rollback Agent
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
