"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCode,
  FlaskConical,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { FixProposalRecord } from "@/server/analysis/schema";

export interface FixReviewModalProps {
  proposal: FixProposalRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgentVersion?: number;
  onApprove?: (proposalId: string) => Promise<void> | void;
  onReject?: (proposalId: string) => Promise<void> | void;
  onApply?: (proposalId: string, reconcileStale?: boolean) => Promise<void> | void;
  onRetest?: (proposalId: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isApplying?: boolean;
  isRetesting?: boolean;
}

export function FixReviewModal({
  proposal,
  open,
  onOpenChange,
  currentAgentVersion,
  onApprove,
  onReject,
  onApply,
  onRetest,
  isApproving,
  isRejecting,
  isApplying,
  isRetesting,
}: FixReviewModalProps) {
  if (!proposal) return null;

  const isStale =
    currentAgentVersion !== undefined && currentAgentVersion !== proposal.baseVersion;
  const isApplied =
    proposal.status === "applied_locally" || proposal.status === "synced_remotely";
  const isApproved = proposal.status === "approved";
  const isPending = proposal.status === "pending_review";
  const isRejected = proposal.status === "rejected";
  const proposedVersion = proposal.appliedAgentVersion || proposal.baseVersion + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="AI Remediation Proposal Review"
        description={`Remediation for Agent (Base v${proposal.baseVersion} → v${proposedVersion})`}
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
      >
        <div className="space-y-5 pt-2 text-xs">
          {/* Header & Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  isApplied
                    ? "success"
                    : isApproved
                    ? "accent"
                    : isRejected
                    ? "danger"
                    : "warning"
                }
                className="capitalize"
              >
                {proposal.status.replace(/_/g, " ")}
              </Badge>
              {proposal.remoteSyncStatus && proposal.remoteSyncStatus !== "not_applied" && (
                <Badge
                  tone={
                    proposal.remoteSyncStatus === "synced"
                      ? "success"
                      : proposal.remoteSyncStatus === "failed"
                      ? "danger"
                      : "warning"
                  }
                >
                  Remote: {proposal.remoteSyncStatus}
                </Badge>
              )}
            </div>
            <div className="text-muted">
              Created {new Date(proposal.createdAt).toLocaleString()}
            </div>
          </div>

          {/* Stale Version Alert */}
          {isStale && !isApplied && (
            <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft p-3 text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Stale Base Version Detected</p>
                <p className="mt-0.5 text-muted leading-relaxed">
                  The target agent has evolved to <strong>v{currentAgentVersion}</strong> since this
                  fix proposal was generated against <strong>v{proposal.baseVersion}</strong>. Applying
                  will merge and increment to <strong>v{(currentAgentVersion || 0) + 1}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Remediation Overview */}
          <div className="rounded-md border bg-surface p-3.5 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>Remediation Rationale</span>
            </div>
            <p className="text-muted leading-relaxed whitespace-pre-wrap">{proposal.rationale}</p>

            <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
              <div className="rounded border bg-subtle/40 p-2.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Expected Improvement
                </span>
                <p className="mt-1 text-muted leading-relaxed">{proposal.expectedImprovement}</p>
              </div>
              <div className="rounded border bg-subtle/40 p-2.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  Potential Risks & Guardrails
                </span>
                <p className="mt-1 text-muted leading-relaxed">{proposal.potentialRisks}</p>
              </div>
            </div>
          </div>

          {/* Visual Diff Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                Proposed Configuration Changes ({proposal.fieldChanges.length})
              </h4>
              <span className="text-[11px] text-muted">
                v{proposal.baseVersion} → v{proposedVersion}
              </span>
            </div>

            {proposal.fieldChanges.length === 0 ? (
              <div className="rounded border border-dashed p-4 text-center text-muted">
                No field-level differences recorded between base and proposed configs.
              </div>
            ) : (
              <div className="space-y-2.5">
                {proposal.fieldChanges.map((change, idx) => (
                  <div key={idx} className="rounded-md border bg-surface overflow-hidden">
                    <div className="flex items-center justify-between border-b bg-subtle/50 px-3 py-1.5 text-[11px]">
                      <span className="font-mono font-semibold text-foreground">
                        {change.label} ({change.path})
                      </span>
                      {change.explanation && (
                        <span className="text-[10px] text-muted">{change.explanation}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <div className="p-3 bg-danger-soft/20">
                        <div className="text-[10px] font-semibold text-danger uppercase mb-1">
                          Original (v{proposal.baseVersion})
                        </div>
                        <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted break-all">
                          {change.before || "(empty)"}
                        </pre>
                      </div>

                      <div className="p-3 bg-success-soft/20">
                        <div className="text-[10px] font-semibold text-success uppercase mb-1">
                          Proposed (v{proposedVersion})
                        </div>
                        <pre className="font-mono text-[11px] whitespace-pre-wrap text-foreground break-all">
                          {change.after || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {isPending && (
                <>
                  {onReject && (
                    <Button
                      variant="danger"
                      disabled={isRejecting}
                      onClick={() => onReject(proposal.id)}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Reject Fix
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      variant="primary"
                      disabled={isApproving}
                      onClick={() => onApprove(proposal.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Approve Proposal
                    </Button>
                  )}
                </>
              )}

              {isApproved && onApply && (
                <Button
                  variant="primary"
                  disabled={isApplying}
                  onClick={() => onApply(proposal.id, isStale)}
                >
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  Apply & Deploy Fix
                </Button>
              )}

              {isApplied && onRetest && (
                <Button
                  variant="primary"
                  disabled={isRetesting}
                  onClick={() => onRetest(proposal.id)}
                >
                  <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                  Rerun Test Lab Simulation
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
