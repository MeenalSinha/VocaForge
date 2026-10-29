"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { RetestComparisonRecord } from "@/server/analysis/schema";

export interface RetestComparisonDrawerProps {
  comparison: RetestComparisonRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewOriginalRun?: (runId: string) => void;
  onViewRetestRun?: (runId: string) => void;
}

export function RetestComparisonDrawer({
  comparison,
  open,
  onOpenChange,
  onViewOriginalRun,
  onViewRetestRun,
}: RetestComparisonDrawerProps) {
  if (!comparison) return null;

  const isResolved = comparison.failureResolved;
  const originalTurns = Number(comparison.originalMetrics.turnsCount || 0);
  const retestTurns = Number(comparison.retestMetrics.turnsCount || 0);
  const originalDuration = Number(comparison.originalMetrics.durationSecs || 0);
  const retestDuration = Number(comparison.retestMetrics.durationSecs || 0);
  const originalStatus = String(comparison.originalMetrics.status || "failed_evaluation");
  const retestStatus = String(comparison.retestMetrics.status || "passed");
  const originalRationale = String(comparison.originalMetrics.rationale || "");
  const retestRationale = String(comparison.retestMetrics.rationale || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Retest Verification Comparison"
        description={`Before & After Verification: Tested Agent v${comparison.testedAgentVersion}`}
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
      >
        <div className="space-y-5 pt-2 text-xs">
          {/* Verdict Banner */}
          <div
            className={`rounded-lg border p-4 ${
              isResolved
                ? "border-success/30 bg-success-soft text-foreground"
                : "border-danger/30 bg-danger-soft text-foreground"
            }`}
          >
            <div className="flex items-start gap-3">
              {isResolved ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone={isResolved ? "success" : "danger"} className="text-xs uppercase">
                    {isResolved ? "Failure Resolved" : "Failure Persists"}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {isResolved
                      ? "Configuration remediation verified successfully."
                      : "Remediation did not resolve the test failure."}
                  </span>
                </div>
                <p className="text-muted leading-relaxed">
                  {comparison.comparisonSummary ||
                    (isResolved
                      ? "The updated agent instructions satisfied all customer requirements and passed evaluation criteria."
                      : "The agent continued to trigger evaluation failure or error during retesting.")}
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Original Run Column */}
            <div className="rounded-lg border bg-surface p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  Original Run
                </div>
                <Badge tone="danger" className="capitalize text-[10px]">
                  {originalStatus.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="space-y-2 text-muted">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Turns:
                  </span>
                  <span className="font-semibold text-foreground">
                    {originalTurns}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Duration:
                  </span>
                  <span className="font-semibold text-foreground">
                    {originalDuration ? `${originalDuration}s` : "N/A"}
                  </span>
                </div>
              </div>

              {originalRationale && (
                <div className="rounded border bg-danger-soft/20 p-2.5">
                  <span className="font-semibold text-danger text-[10px] uppercase">
                    Original Evaluator Rationale
                  </span>
                  <p className="mt-1 text-muted whitespace-pre-wrap leading-relaxed">
                    {originalRationale}
                  </p>
                </div>
              )}

              {onViewOriginalRun && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onViewOriginalRun(comparison.originalRunId)}
                >
                  <ExternalLink className="mr-1.5 h-3 w-3" />
                  View Original Transcript
                </Button>
              )}
            </div>

            {/* Retest Run Column */}
            <div className="rounded-lg border bg-surface p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isResolved ? "bg-success" : "bg-warning"
                    }`}
                  />
                  Retest Run (v{comparison.testedAgentVersion})
                </div>
                <Badge
                  tone={isResolved ? "success" : "warning"}
                  className="capitalize text-[10px]"
                >
                  {retestStatus.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="space-y-2 text-muted">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Turns:
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    {retestTurns}
                    {retestTurns < originalTurns ? (
                      <TrendingDown className="h-3.5 w-3.5 text-success" />
                    ) : retestTurns > originalTurns ? (
                      <TrendingUp className="h-3.5 w-3.5 text-warning" />
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Duration:
                  </span>
                  <span className="font-semibold text-foreground">
                    {retestDuration ? `${retestDuration}s` : "N/A"}
                  </span>
                </div>
              </div>

              {retestRationale && (
                <div
                  className={`rounded border p-2.5 ${
                    isResolved ? "bg-success-soft/20" : "bg-warning-soft/20"
                  }`}
                >
                  <span
                    className={`font-semibold text-[10px] uppercase ${
                      isResolved ? "text-success" : "text-warning"
                    }`}
                  >
                    Retest Evaluator Rationale
                  </span>
                  <p className="mt-1 text-muted whitespace-pre-wrap leading-relaxed">
                    {retestRationale}
                  </p>
                </div>
              )}

              {onViewRetestRun && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onViewRetestRun(comparison.retestRunId)}
                >
                  <ExternalLink className="mr-1.5 h-3 w-3" />
                  View Retest Transcript
                </Button>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close Comparison
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
