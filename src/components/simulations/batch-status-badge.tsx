import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { BatchStatus, EvaluationResult, RunStatus } from "@/server/simulations/schema";

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  switch (status) {
    case "completed":
      return (
        <Badge tone="success" className="gap-1.5 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed
        </Badge>
      );
    case "completed_with_failures":
      return (
        <Badge tone="warning" className="gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          Completed with Failures
        </Badge>
      );
    case "failed":
      return (
        <Badge tone="danger" className="gap-1.5 font-medium">
          <XCircle className="h-3.5 w-3.5" />
          Failed
        </Badge>
      );
    case "infrastructure_error":
      return (
        <Badge tone="danger" className="gap-1.5 font-medium">
          <AlertCircle className="h-3.5 w-3.5" />
          Infrastructure Error
        </Badge>
      );
    case "running":
    case "preparing":
      return (
        <Badge tone="accent" className="gap-1.5 font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Running
        </Badge>
      );
    case "queued":
      return (
        <Badge tone="neutral" className="gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5" />
          Queued
        </Badge>
      );
    case "timed_out":
      return (
        <Badge tone="danger" className="gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5" />
          Timed Out
        </Badge>
      );
    case "cancelled":
      return (
        <Badge tone="neutral" className="gap-1.5 font-medium">
          Cancelled
        </Badge>
      );
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  switch (status) {
    case "passed":
      return (
        <Badge tone="success" className="gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          Passed
        </Badge>
      );
    case "failed_evaluation":
      return (
        <Badge tone="danger" className="gap-1 text-xs">
          <XCircle className="h-3 w-3" />
          Failed Evaluation
        </Badge>
      );
    case "infrastructure_error":
      return (
        <Badge tone="danger" className="gap-1 text-xs">
          <AlertCircle className="h-3 w-3" />
          Infrastructure Error
        </Badge>
      );
    case "running":
      return (
        <Badge tone="accent" className="gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge tone="neutral" className="gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "timed_out":
      return (
        <Badge tone="danger" className="gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Timed Out
        </Badge>
      );
    case "inconclusive":
      return (
        <Badge tone="warning" className="gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Inconclusive
        </Badge>
      );
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function EvaluationResultBadge({ result }: { result: EvaluationResult | null }) {
  if (!result) return null;
  switch (result) {
    case "passed":
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">PASSED</span>;
    case "failed":
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">FAILED</span>;
    case "error":
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">ERROR</span>;
    case "inconclusive":
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">INCONCLUSIVE</span>;
    default:
      return null;
  }
}
