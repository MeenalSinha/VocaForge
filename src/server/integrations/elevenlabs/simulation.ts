import { ElevenLabsError } from "./errors";
import type { ElevenLabsClient } from "./client";
import type { TestInvocation, TestRun } from "./schemas";

/**
 * Three distinct outcomes, as required by the Phase 0 brief:
 *  - passed:               the simulation ran and every success condition held
 *  - failed_criteria:      the simulation ran and the success conditions were evaluated as failed
 *  - infrastructure_error: the run itself did not complete (no evaluation, or an API/transport error)
 * Plus `pending` (still running) and `inconclusive` (status we do not recognise).
 */
export type SimulationOutcomeKind = "passed" | "failed_criteria" | "infrastructure_error" | "pending" | "inconclusive";

export interface SimulationOutcome {
  kind: SimulationOutcomeKind;
  status: string | null;
  rationale: string | null;
  testRunId: string | null;
}

const PENDING = new Set(["pending", "queued", "running", "in_progress", "started"]);
const PASSED = new Set(["passed", "success", "succeeded", "completed_success"]);
const FAILED = new Set(["failed", "failure"]);
const ERRORED = new Set(["error", "errored", "cancelled", "canceled", "timed_out", "timeout"]);

export function classifyRun(run: TestRun): SimulationOutcome {
  const status = run.status ? run.status.toLowerCase() : null;
  const result = run.condition_result?.result?.toLowerCase() ?? null;
  const rawRationale = run.condition_result?.rationale;
  const rationale = rawRationale ? (typeof rawRationale === "object" ? JSON.stringify(rawRationale) : String(rawRationale)) : null;
  const base = { status, rationale, testRunId: run.test_run_id ?? null };

  if (status && PENDING.has(status)) return { ...base, kind: "pending" };
  if (status && ERRORED.has(status)) return { ...base, kind: "infrastructure_error" };
  if (status && PASSED.has(status)) return { ...base, kind: "passed" };
  if (status && FAILED.has(status)) {
    // A failed run with no evaluation result never reached the criteria check.
    return { ...base, kind: result ? "failed_criteria" : "infrastructure_error" };
  }
  return { ...base, kind: "inconclusive" };
}

export function classifyInvocation(inv: TestInvocation): SimulationOutcome[] {
  return inv.test_runs.map(classifyRun);
}

export const isSettled = (outcomes: SimulationOutcome[]) =>
  outcomes.length > 0 && outcomes.every((o) => o.kind !== "pending");

export interface WaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export async function waitForInvocation(
  client: Pick<ElevenLabsClient, "getTestInvocation">,
  invocationId: string,
  o: WaitOptions = {},
): Promise<{ invocation: TestInvocation; outcomes: SimulationOutcome[] }> {
  const interval = o.intervalMs ?? 3000;
  const timeout = o.timeoutMs ?? 180000;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const start = now();
  for (;;) {
    const invocation = await client.getTestInvocation(invocationId);
    const outcomes = classifyInvocation(invocation);
    if (isSettled(outcomes)) return { invocation, outcomes };
    if (now() - start >= timeout) {
      throw new ElevenLabsError("timeout", `Test invocation ${invocationId} was still pending after ${Math.round(timeout / 1000)} seconds.`);
    }
    await sleep(interval);
  }
}
