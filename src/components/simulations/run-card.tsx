import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, RotateCw, User } from "lucide-react";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import { RunStatusBadge } from "./batch-status-badge";
import { OutcomeProofBadge } from "./outcome-proof-card";
import { evaluateOutcomeProof } from "@/server/analysis/outcome-proof";

export interface RunCardProps {
  run: SimulationRunRecord;
  onInspect: (run: SimulationRunRecord) => void;
  onRerun?: (run: SimulationRunRecord) => void;
}

export function RunCard({ run, onInspect, onRerun }: RunCardProps) {
  const proof = React.useMemo(() => {
    return evaluateOutcomeProof({
      transcript: run.transcript,
      scenarioSnapshot: run.scenarioSnapshot,
      rawResult: run.rawResult,
    });
  }, [run]);

  return (
    <Card className="flex flex-col justify-between p-4 transition-shadow hover:shadow-sm">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{run.scenarioName}</h4>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <User className="h-3 w-3 text-accent" />
              <span>{run.personaName}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RunStatusBadge status={run.status} />
            <OutcomeProofBadge verdict={proof.verdict} />
          </div>
        </div>

        {/* Evaluation Rationale Preview or Error */}
        {run.evaluationRationale ? (
          <p className="line-clamp-2 text-xs text-muted bg-subtle/50 rounded p-2 italic">
            &ldquo;{run.evaluationRationale}&rdquo;
          </p>
        ) : run.errorMessage ? (
          <p className="line-clamp-2 text-xs text-danger bg-danger-soft/50 rounded p-2">
            {run.errorMessage}
          </p>
        ) : (
          <p className="line-clamp-2 text-xs text-muted">
            {run.scenarioSnapshot?.objective?.primaryGoal || "Testing scenario goal"}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span>{run.transcript?.length ?? 0} turns</span>
          {run.completedAt && (
            <span>{new Date(run.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onRerun && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRerun(run)}
              title="Rerun scenario"
              className="h-7 px-2"
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onInspect(run)}
            className="h-7 text-xs"
          >
            <FileText className="mr-1 h-3 w-3" />
            Inspect Result
          </Button>
        </div>
      </div>
    </Card>
  );
}
