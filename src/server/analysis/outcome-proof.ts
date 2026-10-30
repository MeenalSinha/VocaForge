import type { TranscriptMessage } from "../simulations/schema";
import type { OutcomeContract, ScenarioConfig } from "../personas/schema";

export type OutcomeProofVerdict = "VERIFIED" | "FAILED" | "UNVERIFIED";

export interface OutcomeFieldComparison {
  field: string;
  expected: unknown;
  actual: unknown;
  status: "match" | "mismatch" | "missing";
}

export interface OutcomeProofResult {
  verdict: OutcomeProofVerdict;
  summary: string;
  contract: OutcomeContract;
  layers: {
    conversationClaim: {
      claimed: boolean;
      claimExcerpt: string | null;
      claimTurnIndex: number | null;
    };
    toolExecution: {
      executed: boolean;
      toolName: string | null;
      invokedParameters: Record<string, unknown> | null;
      toolTurnIndex: number | null;
      parametersMatch: boolean;
      parameterMismatches: Array<{ field: string; expected: unknown; actual: unknown }>;
    };
    businessOutcome: {
      evidencePresent: boolean;
      evidenceType: string | null;
      statusConfirmed: boolean;
      rawEvidence: Record<string, unknown> | null;
    };
  };
  fieldComparisons: OutcomeFieldComparison[];
  reasons: string[];
}

export interface OutcomeEvaluationInput {
  transcript: TranscriptMessage[];
  scenarioSnapshot?: Partial<ScenarioConfig> | null;
  rawResult?: Record<string, unknown> | null;
}

/**
 * Normalizes values for comparison (case-insensitive strings, trimmed, numbers).
 */
function normalizeVal(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim().toLowerCase();
  if (typeof val === "number" || typeof val === "boolean") return String(val).toLowerCase();
  return JSON.stringify(val).toLowerCase();
}

/**
 * Resolves an active or inferred OutcomeContract.
 */
export function resolveOutcomeContract(scenario?: Partial<ScenarioConfig> | null): OutcomeContract {
  if (scenario?.outcomeContract && scenario.outcomeContract.enabled) {
    return scenario.outcomeContract;
  }

  // Derive contract if scenario mentions booking, scheduling, or appointment
  const goal = scenario?.objective?.primaryGoal || "";
  const expectedOutcome = scenario?.objective?.expectedOutcome || "";
  const combined = `${goal} ${expectedOutcome}`.toLowerCase();

  const isAppointment = combined.includes("appointment") || combined.includes("book") || combined.includes("schedul");
  
  if (isAppointment) {
    // Extract day and time if mentioned in goal / expected outcome
    const params: Record<string, string> = {};
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const d of days) {
      if (combined.includes(d)) {
        params.day = d.charAt(0).toUpperCase() + d.slice(1);
        break;
      }
    }

    const timeMatch = combined.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i) || combined.match(/(\d{1,2}\s*(?:am|pm))/i);
    if (timeMatch && timeMatch[1]) {
      params.time = timeMatch[1].toUpperCase();
    }

    return {
      enabled: true,
      action: "appointment_booking",
      parameters: params,
      requiredStatus: "confirmed",
      requiredEvidence: "booking_record",
      claimPatterns: [
        "booked",
        "confirmed",
        "scheduled",
        "appointment is set",
        "appointment has been scheduled",
        "all set",
        "reserved",
      ],
    };
  }

  // Default fallback contract
  return {
    enabled: Boolean(scenario?.outcomeContract?.enabled),
    action: scenario?.outcomeContract?.action || "business_action",
    parameters: scenario?.outcomeContract?.parameters || {},
    requiredStatus: scenario?.outcomeContract?.requiredStatus || "confirmed",
    requiredEvidence: scenario?.outcomeContract?.requiredEvidence || "external_confirmation",
    claimPatterns: scenario?.outcomeContract?.claimPatterns || ["completed", "confirmed", "success"],
  };
}

interface ExtractedToolCall {
  turnIndex: number;
  toolName: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

/**
 * Extracts tool calls and their external responses across transcript turns and raw results.
 */
function extractToolCalls(
  transcript: TranscriptMessage[],
  rawResult?: Record<string, unknown> | null,
): ExtractedToolCall[] {
  const calls: ExtractedToolCall[] = [];

  // 1. Scan transcript messages for tool calls
  transcript.forEach((msg, idx) => {
    if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
      for (const rawCall of msg.toolCalls) {
        if (!rawCall || typeof rawCall !== "object") continue;
        const c = rawCall as Record<string, unknown>;
        const toolName = String(
          c.name || c.tool_name || c.function || c.tool || (c.function_call as Record<string, unknown>)?.name || "tool",
        );
        let params: Record<string, unknown> = {};
        const rawParams = c.parameters || c.args || c.arguments || (c.function_call as Record<string, unknown>)?.arguments;
        if (typeof rawParams === "string") {
          try {
            params = JSON.parse(rawParams);
          } catch {
            params = { raw: rawParams };
          }
        } else if (rawParams && typeof rawParams === "object") {
          params = rawParams as Record<string, unknown>;
        }

        let res: Record<string, unknown> | null = null;
        const rawRes = c.result ?? c.response ?? c.output ?? c.returned;
        if (typeof rawRes === "string") {
          try {
            res = JSON.parse(rawRes);
          } catch {
            res = { response: rawRes };
          }
        } else if (rawRes && typeof rawRes === "object") {
          res = rawRes as Record<string, unknown>;
        }

        calls.push({ turnIndex: idx, toolName, parameters: params, result: res });
      }
    }
  });

  // 2. Scan rawResult for top-level tool executions
  if (rawResult && typeof rawResult === "object") {
    const rawCalls = (rawResult.tool_calls || rawResult.toolCalls || rawResult.tools) as unknown[];
    if (Array.isArray(rawCalls)) {
      for (const rawCall of rawCalls) {
        if (!rawCall || typeof rawCall !== "object") continue;
        const c = rawCall as Record<string, unknown>;
        const toolName = String(c.name || c.tool_name || c.function || "tool");
        let params: Record<string, unknown> = {};
        const rawParams = c.parameters || c.args || c.arguments;
        if (typeof rawParams === "string") {
          try {
            params = JSON.parse(rawParams);
          } catch {
            params = { raw: rawParams };
          }
        } else if (rawParams && typeof rawParams === "object") {
          params = rawParams as Record<string, unknown>;
        }
        let res: Record<string, unknown> | null = null;
        const rawRes = c.result ?? c.response ?? c.output;
        if (typeof rawRes === "string") {
          try {
            res = JSON.parse(rawRes);
          } catch {
            res = { response: rawRes };
          }
        } else if (rawRes && typeof rawRes === "object") {
          res = rawRes as Record<string, unknown>;
        }
        calls.push({ turnIndex: -1, toolName, parameters: params, result: res });
      }
    }
  }

  return calls;
}

/**
 * Deterministically evaluates the three outcome layers against the outcome contract.
 */
export function evaluateOutcomeProof(input: OutcomeEvaluationInput): OutcomeProofResult {
  const contract = resolveOutcomeContract(input.scenarioSnapshot);
  const transcript = input.transcript || [];

  // LAYER A: Conversation Claim Evaluation
  let claimed = false;
  let claimExcerpt: string | null = null;
  let claimTurnIndex: number | null = null;

  for (let i = 0; i < transcript.length; i++) {
    const msg = transcript[i];
    if (msg && msg.role === "agent") {
      const lower = (msg.message || "").toLowerCase();
      for (const pattern of contract.claimPatterns) {
        if (lower.includes(pattern.toLowerCase())) {
          claimed = true;
          claimExcerpt = msg.message;
          claimTurnIndex = i;
          break;
        }
      }
      if (claimed) break;
    }
  }

  // LAYER B: Tool Execution Evaluation
  const toolCalls = extractToolCalls(transcript, input.rawResult);
  const primaryTool = toolCalls[0] || null;
  const executed = Boolean(primaryTool);
  const toolName = primaryTool?.toolName || null;
  const invokedParameters = primaryTool?.parameters || null;
  const toolTurnIndex = primaryTool ? (primaryTool.turnIndex >= 0 ? primaryTool.turnIndex : null) : null;

  const parameterMismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  let parametersMatch = true;

  if (executed && invokedParameters) {
    for (const [k, expectedVal] of Object.entries(contract.parameters)) {
      // Look for key in invokedParameters (case-insensitive check)
      const matchingKey = Object.keys(invokedParameters).find((p) => p.toLowerCase() === k.toLowerCase());
      const actualVal = matchingKey ? invokedParameters[matchingKey] : undefined;

      if (actualVal === undefined || normalizeVal(actualVal) !== normalizeVal(expectedVal)) {
        parametersMatch = false;
        parameterMismatches.push({
          field: k,
          expected: expectedVal,
          actual: actualVal ?? null,
        });
      }
    }
  } else if (Object.keys(contract.parameters).length > 0) {
    parametersMatch = false;
  }

  // LAYER C: Business Outcome Evidence Evaluation
  const rawEvidence = primaryTool?.result || null;
  const evidencePresent = Boolean(rawEvidence && Object.keys(rawEvidence).length > 0);
  let statusConfirmed = false;
  let evidenceType: string | null = null;

  if (evidencePresent && rawEvidence) {
    evidenceType = contract.requiredEvidence || "external_api_response";
    const statusVal = String(rawEvidence.status || rawEvidence.state || rawEvidence.result || "").toLowerCase();
    const hasBookingId = Boolean(
      rawEvidence.bookingId ||
      rawEvidence.booking_id ||
      rawEvidence.appointmentId ||
      rawEvidence.appointment_id ||
      rawEvidence.confirmationCode ||
      rawEvidence.confirmation_code ||
      rawEvidence.id,
    );
    const hasError = Boolean(
      rawEvidence.error ||
      rawEvidence.errorMessage ||
      statusVal === "failed" ||
      statusVal === "error" ||
      statusVal === "rejected",
    );

    if (hasError) {
      statusConfirmed = false;
    } else if (
      statusVal.includes(contract.requiredStatus.toLowerCase()) ||
      statusVal.includes("success") ||
      hasBookingId
    ) {
      statusConfirmed = true;
    }
  }

  // FIELD-BY-FIELD COMPARISONS
  const fieldComparisons: OutcomeFieldComparison[] = [];

  // 1. Action field
  fieldComparisons.push({
    field: "action",
    expected: contract.action,
    actual: toolName || (claimed ? "verbal_claim_only" : null),
    status: executed ? "match" : "missing",
  });

  // 2. Expected parameters from contract
  for (const [key, expectedVal] of Object.entries(contract.parameters)) {
    // Check evidence first, then tool invocation
    let actualVal: unknown = undefined;
    if (rawEvidence) {
      const matchKey = Object.keys(rawEvidence).find((k) => k.toLowerCase() === key.toLowerCase());
      if (matchKey) actualVal = rawEvidence[matchKey];
    }
    if (actualVal === undefined && invokedParameters) {
      const matchKey = Object.keys(invokedParameters).find((k) => k.toLowerCase() === key.toLowerCase());
      if (matchKey) actualVal = invokedParameters[matchKey];
    }

    if (actualVal === undefined || actualVal === null) {
      fieldComparisons.push({
        field: key,
        expected: expectedVal,
        actual: null,
        status: "missing",
      });
    } else if (normalizeVal(actualVal) === normalizeVal(expectedVal)) {
      fieldComparisons.push({
        field: key,
        expected: expectedVal,
        actual: actualVal,
        status: "match",
      });
    } else {
      fieldComparisons.push({
        field: key,
        expected: expectedVal,
        actual: actualVal,
        status: "mismatch",
      });
    }
  }

  // 3. Status field
  const actualStatus = rawEvidence
    ? (rawEvidence.status ?? rawEvidence.state ?? (statusConfirmed ? "confirmed" : "unknown"))
    : null;
  fieldComparisons.push({
    field: "status",
    expected: contract.requiredStatus,
    actual: actualStatus,
    status:
      actualStatus && normalizeVal(actualStatus).includes(normalizeVal(contract.requiredStatus))
        ? "match"
        : actualStatus
        ? "mismatch"
        : "missing",
  });

  // VERDICT DETERMINATION
  // VERIFIED: Actual outcome evidence satisfies the contract.
  // FAILED: Available evidence proves that the operation failed or its values are incorrect.
  // UNVERIFIED: Insufficient evidence exists to establish the outcome.
  let verdict: OutcomeProofVerdict = "UNVERIFIED";
  const reasons: string[] = [];

  const hasMismatches = fieldComparisons.some((f) => f.status === "mismatch");
  const hasExplicitFailure =
    rawEvidence &&
    (Boolean(rawEvidence.error) ||
      normalizeVal(rawEvidence.status).includes("fail") ||
      normalizeVal(rawEvidence.status).includes("error") ||
      normalizeVal(rawEvidence.status).includes("reject"));

  if (hasExplicitFailure) {
    verdict = "FAILED";
    reasons.push(
      `External booking system returned an explicit failure: ${
        rawEvidence?.error || rawEvidence?.message || "Operation failed"
      }`,
    );
  } else if (hasMismatches) {
    verdict = "FAILED";
    const mismatches = fieldComparisons
      .filter((f) => f.status === "mismatch")
      .map((f) => `${f.field} (expected: "${String(f.expected)}", actual: "${String(f.actual)}")`)
      .join(", ");
    reasons.push(`Available outcome evidence contradicts contract values: ${mismatches}`);
  } else if (executed && evidencePresent && statusConfirmed && parametersMatch) {
    verdict = "VERIFIED";
    reasons.push(
      `Genuine business outcome evidence verified: system confirmed "${contract.action}" with matching contract parameters and status "${contract.requiredStatus}".`,
    );
  } else if (claimed && !executed) {
    verdict = "UNVERIFIED";
    reasons.push(
      `Agent verbally claimed completion ("${claimExcerpt?.slice(0, 80)}..."), but no tool was invoked and no external outcome evidence exists. Verbal claims cannot serve as proof of business completion.`,
    );
  } else if (executed && !evidencePresent) {
    verdict = "UNVERIFIED";
    reasons.push(
      `Tool "${toolName}" was invoked, but no confirmation response or persisted record was returned by the connected system.`,
    );
  } else {
    verdict = "UNVERIFIED";
    reasons.push("Insufficient external outcome evidence to verify completion of the business contract.");
  }

  // Summary message
  let summary = "";
  if (verdict === "VERIFIED") {
    summary = `Business Outcome Verified: ${contract.action} confirmed by connected system evidence.`;
  } else if (verdict === "FAILED") {
    summary = `Business Outcome Failed: System evidence contradicts expected contract criteria.`;
  } else {
    summary = `Business Outcome Unverified: Lacks external system confirmation evidence.`;
  }

  return {
    verdict,
    summary,
    contract,
    layers: {
      conversationClaim: {
        claimed,
        claimExcerpt,
        claimTurnIndex,
      },
      toolExecution: {
        executed,
        toolName,
        invokedParameters,
        toolTurnIndex,
        parametersMatch,
        parameterMismatches,
      },
      businessOutcome: {
        evidencePresent,
        evidenceType,
        statusConfirmed,
        rawEvidence,
      },
    },
    fieldComparisons,
    reasons,
  };
}
