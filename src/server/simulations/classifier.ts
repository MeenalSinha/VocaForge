import type { TestRun } from "../integrations/elevenlabs/schemas";
import type {
  BatchStatus,
  EvaluationResult,
  RunStatus,
  SimulationMetrics,
  SimulationRunRecord,
  TranscriptMessage,
} from "./schema";

const PENDING_STATUSES = new Set(["pending", "queued", "running", "in_progress", "started", "preparing"]);
const PASSED_STATUSES = new Set(["passed", "success", "succeeded", "completed_success"]);
const FAILED_STATUSES = new Set(["failed", "failure"]);
const ERROR_STATUSES = new Set(["error", "errored", "cancelled", "canceled", "timed_out", "timeout"]);

export interface NormalizedRunResult {
  status: RunStatus;
  evaluationResult: EvaluationResult | null;
  evaluationRationale: string | null;
  transcript: TranscriptMessage[];
  metrics: SimulationMetrics;
  errorMessage: string | null;
}

/**
 * Normalizes an arbitrary response transcript message from ElevenLabs.
 */
export function normalizeTranscript(rawResponses: unknown[] | null | undefined): TranscriptMessage[] {
  if (!Array.isArray(rawResponses)) return [];

  const transcript: TranscriptMessage[] = [];

  for (const item of rawResponses) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;

    // Role mapping
    let role: "user" | "agent" | "system" = "agent";
    const rawRole = String(rec.role || rec.speaker || rec.type || "").toLowerCase();
    if (rawRole.includes("user") || rawRole.includes("customer") || rawRole.includes("human")) {
      role = "user";
    } else if (rawRole.includes("system")) {
      role = "system";
    }

    // Message text
    const message = String(rec.message ?? rec.content ?? rec.text ?? rec.utterance ?? "").trim();

    // Timing
    const timeInCallSecs =
      typeof rec.time_in_call_secs === "number"
        ? rec.time_in_call_secs
        : typeof rec.timestamp === "number"
        ? rec.timestamp
        : undefined;

    // Tool calls
    const toolCalls = Array.isArray(rec.tool_calls) ? rec.tool_calls : undefined;

    if (message || toolCalls) {
      transcript.push({ role, message, timeInCallSecs, toolCalls });
    }
  }

  return transcript;
}

/**
 * Normalizes and classifies an individual test run from ElevenLabs.
 */
export function classifyRemoteRun(run: TestRun): NormalizedRunResult {
  const rawStatus = (run.status || "").toLowerCase().trim();
  const condResult = run.condition_result?.result?.toLowerCase().trim() || null;
  const rationale = run.condition_result?.rationale || null;
  const transcript = normalizeTranscript(run.agent_responses);

  const metrics: SimulationMetrics = {
    turnsCount: transcript.length,
  };

  // 1. Pending states
  if (!rawStatus || PENDING_STATUSES.has(rawStatus)) {
    return {
      status: "running",
      evaluationResult: null,
      evaluationRationale: null,
      transcript,
      metrics,
      errorMessage: null,
    };
  }

  // 2. Transport or execution infrastructure error
  if (ERROR_STATUSES.has(rawStatus)) {
    return {
      status: rawStatus.includes("time") ? "timed_out" : "infrastructure_error",
      evaluationResult: "error",
      evaluationRationale: rationale || `Remote execution encountered an error: ${rawStatus}`,
      transcript,
      metrics,
      errorMessage: rationale || `Execution failed with status: ${rawStatus}`,
    };
  }

  // 3. Remote test completed and passed
  if (PASSED_STATUSES.has(rawStatus)) {
    // If condition result explicitly says failed, treat as failed_evaluation
    if (condResult === "failed" || condResult === "failure") {
      return {
        status: "failed_evaluation",
        evaluationResult: "failed",
        evaluationRationale: rationale,
        transcript,
        metrics,
        errorMessage: null,
      };
    }
    return {
      status: "passed",
      evaluationResult: "passed",
      evaluationRationale: rationale,
      transcript,
      metrics,
      errorMessage: null,
    };
  }

  // 4. Remote test completed with failure
  if (FAILED_STATUSES.has(rawStatus)) {
    // If there was an actual evaluation condition result, it's a failed evaluation
    if (condResult) {
      return {
        status: "failed_evaluation",
        evaluationResult: "failed",
        evaluationRationale: rationale,
        transcript,
        metrics,
        errorMessage: null,
      };
    }
    // If no condition result exists, it failed prior to evaluation (infrastructure error)
    return {
      status: "infrastructure_error",
      evaluationResult: "error",
      evaluationRationale: rationale || "Run failed before evaluation could be performed.",
      transcript,
      metrics,
      errorMessage: "Run failed before evaluation completed.",
    };
  }

  // 5. Inconclusive or unexpected status
  return {
    status: "inconclusive",
    evaluationResult: "inconclusive",
    evaluationRationale: rationale || `Unrecognized remote status: "${rawStatus}"`,
    transcript,
    metrics,
    errorMessage: `Unrecognized status: ${rawStatus}`,
  };
}

/**
 * Aggregates individual runs to update the parent execution batch summary.
 */
export function aggregateBatchOutcomes(runs: SimulationRunRecord[]): {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  errored: number;
  batchStatus: BatchStatus;
} {
  const total = runs.length;
  let completed = 0;
  let passed = 0;
  let failed = 0;
  let errored = 0;
  let hasPending = false;

  for (const r of runs) {
    if (r.status === "pending" || r.status === "running") {
      hasPending = true;
      continue;
    }

    completed++;
    if (r.status === "passed") {
      passed++;
    } else if (r.status === "failed_evaluation") {
      failed++;
    } else if (r.status === "infrastructure_error" || r.status === "timed_out") {
      errored++;
    } else if (r.status === "inconclusive") {
      errored++;
    }
  }

  let batchStatus: BatchStatus = "running";

  if (hasPending) {
    batchStatus = "running";
  } else if (total === 0) {
    batchStatus = "queued";
  } else if (passed === total) {
    batchStatus = "completed";
  } else if (errored === total) {
    batchStatus = "infrastructure_error";
  } else if (failed === total) {
    batchStatus = "failed";
  } else if (passed > 0 && (failed > 0 || errored > 0)) {
    batchStatus = "completed_with_failures";
  } else if (failed > 0 && errored > 0) {
    batchStatus = "failed";
  }

  return {
    total,
    completed,
    passed,
    failed,
    errored,
    batchStatus,
  };
}
