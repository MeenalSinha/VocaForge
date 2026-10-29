import type { Agent, AgentVersion } from "../agents/repository";
import type { SimulationRunRecord } from "../simulations/schema";
import type { FailureFindingRecord } from "../analysis/schema";
import type { ReadinessCheckItem, ReleaseReadinessSnapshot } from "./schema";

export function evaluateReleaseReadiness(
  agent: Agent,
  version: AgentVersion | null,
  runs: SimulationRunRecord[],
  findings: FailureFindingRecord[],
): ReleaseReadinessSnapshot {
  const checks: ReadinessCheckItem[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Agent Configuration Validity
  const hasValidConfig = Boolean(
    agent.config &&
      agent.config.identity &&
      agent.config.identity.name &&
      agent.config.behavior &&
      agent.config.behavior.welcomeMessage
  );
  checks.push({
    id: "config_valid",
    name: "Valid Agent Configuration",
    passed: hasValidConfig,
    message: hasValidConfig
      ? "Agent configuration is structurally complete and valid."
      : "Agent configuration is incomplete or missing required fields.",
    isBlocker: true,
  });
  if (!hasValidConfig) {
    blockers.push("Agent configuration is incomplete or invalid.");
  }

  // 2. Remote Synchronization Status
  const isSynced =
    agent.remoteAgentId !== null &&
    agent.syncedVersion !== null &&
    agent.syncedVersion === agent.configVersion;
  checks.push({
    id: "remote_synced",
    name: "ElevenLabs Remote Synchronization",
    passed: isSynced,
    message: isSynced
      ? `Configuration v${agent.configVersion} is fully synchronized with ElevenLabs remote agent (${agent.remoteAgentId}).`
      : agent.remoteAgentId
      ? `Configuration v${agent.configVersion} has not been synchronized remotely (synced: v${agent.syncedVersion || 0}).`
      : "No ElevenLabs remote agent has been provisioned for this agent.",
    isBlocker: true,
  });
  if (!isSynced) {
    blockers.push(
      agent.remoteAgentId
        ? `Local configuration v${agent.configVersion} differs from ElevenLabs synced version v${agent.syncedVersion || 0}.`
        : "Agent has not been provisioned on ElevenLabs."
    );
  }

  // 3. Completed Simulation Runs & Pass Rate
  const completedRuns = runs.filter(
    (r) => r.status === "passed" || r.status === "failed_evaluation" || r.status === "inconclusive"
  );
  const passedRuns = runs.filter((r) => r.status === "passed");
  const testedCount = completedRuns.length;
  const passedCount = passedRuns.length;
  const passRate = testedCount > 0 ? Math.round((passedCount / testedCount) * 100) : 0;

  const hasMinimumTests = testedCount >= 1;
  checks.push({
    id: "test_execution",
    name: "Simulation Test Executions",
    passed: hasMinimumTests,
    message: hasMinimumTests
      ? `${testedCount} completed simulation scenario(s) recorded.`
      : "No completed simulation test executions recorded for this agent.",
    isBlocker: true,
  });
  if (!hasMinimumTests) {
    blockers.push("At least one completed simulation scenario execution is required before release.");
  }

  const passRateAcceptable = testedCount > 0 && passRate >= 80;
  checks.push({
    id: "pass_rate",
    name: "Evaluation Pass Rate Threshold (>= 80%)",
    passed: passRateAcceptable,
    message:
      testedCount > 0
        ? `Pass rate is ${passRate}% (${passedCount}/${testedCount} passed).`
        : "No test results available to calculate pass rate.",
    isBlocker: true,
  });
  if (testedCount > 0 && !passRateAcceptable) {
    blockers.push(`Evaluation pass rate is ${passRate}%, below the required 80% threshold.`);
  } else if (testedCount > 0 && passRate < 100) {
    warnings.push(`${testedCount - passedCount} scenario execution(s) did not pass evaluation.`);
  }

  // 4. Critical & Major Failure Findings
  const criticalFindings = findings.filter(
    (f) => f.severity === "critical" && f.isActionable
  );
  const majorFindings = findings.filter(
    (f) => f.severity === "major" && f.isActionable
  );

  const noCritical = criticalFindings.length === 0;
  checks.push({
    id: "no_critical_findings",
    name: "No Unresolved Critical Findings",
    passed: noCritical,
    message: noCritical
      ? "Zero unresolved critical behavioral findings detected."
      : `${criticalFindings.length} unresolved critical finding(s) require remediation.`,
    isBlocker: true,
  });
  if (!noCritical) {
    blockers.push(
      `${criticalFindings.length} critical failure finding(s) detected: ${criticalFindings.map((f) => f.title).join("; ")}`
    );
  }

  if (majorFindings.length > 0) {
    warnings.push(
      `${majorFindings.length} major finding(s) identified that may affect conversational quality.`
    );
  }

  // 5. Tool Safety Notice Check
  const declaredCaps = (agent.config.capabilities || []).map((c) => c.name);
  const sideEffectCaps = declaredCaps.filter((cap) =>
    /book|pay|email|message|sms|cancel|order|delete|transfer/i.test(cap)
  );
  if (sideEffectCaps.length > 0) {
    warnings.push(
      `Agent declares external side-effect capability: ${sideEffectCaps.join(", ")}. Verify safety guardrails before deploying to live callers.`
    );
  }

  // Calculate score & readiness
  const totalChecks = checks.length;
  const passedChecksCount = checks.filter((c) => c.passed).length;
  const score = totalChecks > 0 ? Math.round((passedChecksCount / totalChecks) * 100) : 0;
  const isReady = blockers.length === 0;

  return {
    isReady,
    score,
    testedRunsCount: testedCount,
    passedRunsCount: passedCount,
    passRatePercentage: passRate,
    hasCriticalFindings: criticalFindings.length > 0,
    unresolvedFindingsCount: findings.length,
    isSyncedRemotely: isSynced,
    checks,
    blockers,
    warnings,
    evaluatedAt: new Date().toISOString(),
  };
}

