import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Calendar, CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import type { SimulationBatchRecord } from "@/server/simulations/schema";
import { BatchStatusBadge } from "./batch-status-badge";

export interface BatchHistoryTableProps {
  batches: SimulationBatchRecord[];
  onSelectBatch: (batch: SimulationBatchRecord) => void;
}

export function BatchHistoryTable({ batches, onSelectBatch }: BatchHistoryTableProps) {
  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <FlaskConical className="h-8 w-8 text-muted" />
        <h4 className="mt-2 text-sm font-semibold text-foreground">No Historical Simulation Runs</h4>
        <p className="mt-1 text-xs text-muted max-w-sm">
          Run your first simulation test to establish an execution history and benchmark your voice agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const passRate =
          batch.completedScenarios > 0
            ? Math.round((batch.passedScenarios / batch.completedScenarios) * 100)
            : 0;

        return (
          <Card
            key={batch.id}
            className="flex flex-col gap-3 p-4 transition-colors hover:border-border/80 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{batch.name}</span>
                <BatchStatusBadge status={batch.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1 font-mono">
                  <Bot className="h-3 w-3 text-accent" />
                  Agent: {batch.remoteAgentId.slice(0, 12)}...
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(batch.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-2 sm:border-t-0 sm:pt-0">
              {/* Outcome Counters */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-success font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {batch.passedScenarios} passed
                </span>
                {batch.failedScenarios > 0 && (
                  <span className="flex items-center gap-1 text-danger font-medium">
                    <XCircle className="h-3.5 w-3.5" />
                    {batch.failedScenarios} failed
                  </span>
                )}
                <span className="text-muted">
                  ({batch.completedScenarios}/{batch.totalScenarios} finished · {passRate}%)
                </span>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => onSelectBatch(batch)}
                className="text-xs"
              >
                Inspect Batch
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
