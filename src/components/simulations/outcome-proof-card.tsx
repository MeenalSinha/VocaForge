"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Layers,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import type { OutcomeProofResult, OutcomeProofVerdict } from "@/server/analysis/outcome-proof";

export interface OutcomeProofCardProps {
  proof: OutcomeProofResult | null;
  className?: string;
}

export function OutcomeProofBadge({ verdict }: { verdict: OutcomeProofVerdict }) {
  if (verdict === "VERIFIED") {
    return (
      <Badge
        tone="success"
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Outcome: VERIFIED
      </Badge>
    );
  }

  if (verdict === "FAILED") {
    return (
      <Badge
        tone="danger"
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:text-rose-400"
      >
        <XCircle className="h-3.5 w-3.5" />
        Outcome: FAILED
      </Badge>
    );
  }

  return (
    <Badge
      tone="warning"
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Outcome: UNVERIFIED
    </Badge>
  );
}

export function OutcomeProofCard({ proof, className = "" }: OutcomeProofCardProps) {
  if (!proof) return null;

  const { verdict, summary, contract, layers, fieldComparisons, reasons } = proof;

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 shadow-xs space-y-4 text-xs ${className}`}>
      {/* Top Header & Verdict */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Outcome Proof</h3>
              <OutcomeProofBadge verdict={verdict} />
            </div>
            <p className="text-[11px] text-muted">
              Deterministic 3-layer verification against business outcome contract
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] text-muted">
          <span className="font-semibold text-foreground">Contract Action:</span>{" "}
          <span className="font-mono">{contract.action}</span>
        </div>
      </div>

      {/* Summary Banner */}
      <div
        className={`rounded-lg border p-3 flex items-start gap-2.5 ${
          verdict === "VERIFIED"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
            : verdict === "FAILED"
            ? "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-300"
            : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
        }`}
      >
        {verdict === "VERIFIED" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : verdict === "FAILED" ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <div className="space-y-0.5">
          <p className="font-semibold">{summary}</p>
          {reasons.length > 0 && (
            <p className="text-[11px] opacity-90 leading-relaxed">{reasons[0]}</p>
          )}
        </div>
      </div>

      {/* 3-Layer Independent Evaluation Grid */}
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-accent" />
          Three-Layer Verification Evidence
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Layer A: Conversational Claim */}
          <div className="rounded-lg border border-border bg-subtle/30 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-subtle/60 pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-accent" />
                A. Conversation Claim
              </span>
              <Badge
                tone={layers.conversationClaim.claimed ? "success" : "neutral"}
                className="text-[10px]"
              >
                {layers.conversationClaim.claimed ? "Claim Made" : "No Claim"}
              </Badge>
            </div>

            {layers.conversationClaim.claimed ? (
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-medium">
                  Turn {layers.conversationClaim.claimTurnIndex !== null ? `#${layers.conversationClaim.claimTurnIndex + 1}` : ""}:
                </p>
                <p className="italic text-foreground bg-surface rounded p-2 border border-border/60 text-[11px] line-clamp-3">
                  &ldquo;{layers.conversationClaim.claimExcerpt}&rdquo;
                </p>
              </div>
            ) : (
              <p className="text-muted text-[11px] italic">
                Agent did not issue verbal confirmation matching completion claim patterns.
              </p>
            )}
          </div>

          {/* Layer B: Tool Execution */}
          <div className="rounded-lg border border-border bg-subtle/30 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-subtle/60 pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-accent" />
                B. Tool Invocation
              </span>
              <Badge
                tone={
                  layers.toolExecution.executed
                    ? layers.toolExecution.parametersMatch
                      ? "success"
                      : "warning"
                    : "neutral"
                }
                className="text-[10px]"
              >
                {layers.toolExecution.executed
                  ? layers.toolExecution.parametersMatch
                    ? "Invoked & Matched"
                    : "Invoked (Mismatch)"
                  : "Not Invoked"}
              </Badge>
            </div>

            {layers.toolExecution.executed ? (
              <div className="space-y-1 font-mono text-[10px]">
                <p className="text-foreground font-semibold">
                  Tool: <span className="text-accent">{layers.toolExecution.toolName}</span>
                </p>
                <div className="bg-surface rounded p-2 border border-border/60 overflow-x-auto max-h-20">
                  <pre>{JSON.stringify(layers.toolExecution.invokedParameters, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p className="text-muted text-[11px] italic">
                No tool call was dispatched to an external scheduling or backend system.
              </p>
            )}
          </div>

          {/* Layer C: Business Outcome Evidence */}
          <div className="rounded-lg border border-border bg-subtle/30 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-subtle/60 pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-accent" />
                C. Outcome Evidence
              </span>
              <Badge
                tone={
                  layers.businessOutcome.statusConfirmed
                    ? "success"
                    : layers.businessOutcome.evidencePresent
                    ? "danger"
                    : "warning"
                }
                className="text-[10px]"
              >
                {layers.businessOutcome.statusConfirmed
                  ? "Confirmed"
                  : layers.businessOutcome.evidencePresent
                  ? "Unconfirmed/Error"
                  : "No Evidence"}
              </Badge>
            </div>

            {layers.businessOutcome.evidencePresent ? (
              <div className="space-y-1 font-mono text-[10px]">
                <p className="text-foreground font-semibold">
                  Source: <span className="text-accent">{layers.businessOutcome.evidenceType}</span>
                </p>
                <div className="bg-surface rounded p-2 border border-border/60 overflow-x-auto max-h-20">
                  <pre>{JSON.stringify(layers.businessOutcome.rawEvidence, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p className="text-muted text-[11px] italic">
                No persistent booking confirmation code or external system response was received.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Field-by-Field Comparison Table */}
      <div className="space-y-1.5 border-t border-subtle pt-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Field-by-Field Contract Comparison
        </h4>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle/50 text-[10px] font-semibold text-muted border-b border-border">
              <tr>
                <th className="py-2 px-3">Field</th>
                <th className="py-2 px-3">Expected Outcome</th>
                <th className="py-2 px-3">Actual System Evidence</th>
                <th className="py-2 px-3 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {fieldComparisons.map((fc, i) => (
                <tr key={i} className="hover:bg-subtle/20 transition-colors">
                  <td className="py-2 px-3 font-mono font-medium text-foreground capitalize">
                    {fc.field}
                  </td>
                  <td className="py-2 px-3 font-mono text-muted">
                    {String(fc.expected ?? "—")}
                  </td>
                  <td className="py-2 px-3 font-mono text-foreground">
                    {fc.actual !== null && fc.actual !== undefined ? (
                      String(fc.actual)
                    ) : (
                      <span className="italic text-muted/70">Missing evidence</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {fc.status === "match" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Match
                      </span>
                    ) : fc.status === "mismatch" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3 w-3" />
                        Mismatch
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Missing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Verification Rule Note */}
      <div className="rounded border border-border/60 bg-subtle/20 p-2 text-[10px] text-muted">
        <strong>VocaForge Deterministic Rule:</strong> A verbal claim or tool invocation alone never qualifies as proof of business completion. Verification requires concrete confirmation evidence returned by the connected backend system.
      </div>
    </div>
  );
}
