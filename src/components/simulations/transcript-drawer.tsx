"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Bot, CheckCircle2, RotateCw, User, XCircle } from "lucide-react";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import { RunStatusBadge } from "./batch-status-badge";

export interface TranscriptDrawerProps {
  run: SimulationRunRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerun?: (run: SimulationRunRecord) => void;
}

export function TranscriptDrawer({
  run,
  open,
  onOpenChange,
  onRerun,
}: TranscriptDrawerProps) {
  if (!run) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`${run.scenarioName} — Test Result`}
        description={`Simulated Customer: ${run.personaName}`}
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
      >
        <div className="space-y-5 pt-2 text-xs">
          {/* Top Status & Evaluation Verdict */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <RunStatusBadge status={run.status} />
              {run.evaluationResult && (
                <span
                  className={`font-semibold uppercase tracking-wider ${
                    run.evaluationResult === "passed"
                      ? "text-success"
                      : run.evaluationResult === "failed"
                      ? "text-danger"
                      : "text-warning"
                  }`}
                >
                  Verdict: {run.evaluationResult}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-muted">
              {run.metrics.turnsCount !== undefined && <span>{run.metrics.turnsCount} turns</span>}
              {run.completedAt && (
                <span>Finished {new Date(run.completedAt).toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {/* Evaluation Rationale / Error Details */}
          {run.evaluationRationale && (
            <div
              className={`rounded-md border p-3.5 leading-relaxed ${
                run.status === "passed"
                  ? "border-success/30 bg-success-soft"
                  : run.status === "failed_evaluation"
                  ? "border-danger/30 bg-danger-soft"
                  : "border-warning/30 bg-warning-soft"
              }`}
            >
              <div className="flex items-start gap-2">
                {run.status === "passed" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                )}
                <div>
                  <p className="font-semibold text-foreground">ElevenLabs Evaluator Rationale:</p>
                  <p className="mt-1 text-muted whitespace-pre-wrap">{run.evaluationRationale}</p>
                </div>
              </div>
            </div>
          )}

          {run.errorMessage && !run.evaluationRationale && (
            <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-danger">
              <p className="font-semibold">Error Message:</p>
              <p className="mt-0.5 whitespace-pre-wrap text-muted">{run.errorMessage}</p>
            </div>
          )}

          {/* Conversation Transcript */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Simulation Conversation Transcript ({run.transcript.length} Messages)
            </h4>

            {run.transcript.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-muted">
                No transcript messages recorded for this execution.
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border bg-subtle/30 p-4">
                {run.transcript.map((msg, i) => {
                  const isAgent = msg.role === "agent";
                  const isUser = msg.role === "user";

                  return (
                    <div
                      key={i}
                      className={`flex gap-3 ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isUser
                            ? "bg-accent text-accent-foreground"
                            : isAgent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                        title={msg.role}
                      >
                        {isUser ? <User className="h-3.5 w-3.5" /> : isAgent ? <Bot className="h-3.5 w-3.5" /> : "S"}
                      </div>

                      <div
                        className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                          isUser
                            ? "bg-accent/15 text-foreground rounded-tr-none border border-accent/25"
                            : isAgent
                            ? "bg-surface text-foreground rounded-tl-none border shadow-xs"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-4 text-[10px] text-muted font-medium">
                          <span className="capitalize">{msg.role}</span>
                          {msg.timeInCallSecs !== undefined && (
                            <span>{msg.timeInCallSecs.toFixed(1)}s</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test Rubric & Snapshot Context */}
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Tested Objectives & Success Criteria
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div className="rounded border bg-surface p-2.5">
                <span className="font-semibold text-foreground">Primary Mission Goal:</span>
                <p className="mt-1 text-muted">
                  {run.scenarioSnapshot.objective.primaryGoal || "Not specified"}
                </p>
              </div>
              <div className="rounded border bg-surface p-2.5">
                <span className="font-semibold text-foreground">Success Criteria:</span>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                  {(run.scenarioSnapshot.evaluation.successCriteria || []).map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {onRerun && (
              <Button
                variant="primary"
                onClick={() => {
                  onOpenChange(false);
                  onRerun(run);
                }}
              >
                <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                Rerun This Scenario
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
