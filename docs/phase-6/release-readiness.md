# Phase 6: Automated Pre-Release Readiness Evaluation

## 1. Release Readiness Engine
Before any voice agent can be promoted to production, VocaForge evaluates release readiness against objective, multi-criteria benchmarks derived directly from recorded simulation executions and failure analyses.

The readiness evaluator (`src/server/deployments/readiness.ts`) operates on genuine test data and never fabricates compliance metrics.

---

## 2. Readiness Evaluation Criteria

| Check Name | Target Criterion | Severity | Failure Impact |
| :--- | :--- | :--- | :--- |
| **Valid Agent Configuration** | Structurally complete identity, behavior, guardrails, and voice settings | Blocker | Cannot deploy incomplete or invalid configurations. |
| **ElevenLabs Remote Synchronization** | Local version strictly matches remote synced version (`synced_version === config_version`) | Blocker | Cannot promote local edits that have not been provisioned remotely. |
| **Simulation Test Executions** | Minimum of $\ge 1$ completed simulation scenario execution | Blocker | Untested agents are strictly barred from release. |
| **Evaluation Pass Rate Threshold** | $\ge 80\%$ evaluation pass rate across all completed simulation runs | Blocker | Agents failing $\ge 20\%$ of tested scenarios cannot be deployed. |
| **Zero Critical Behavioral Findings** | $0$ unresolved critical failure findings | Blocker | Critical policy deviations or security vulnerabilities must be remediated first. |
| **Major Findings Notice** | Count of actionable major findings | Warning | Highlights potential customer friction before release. |
| **Side-Effect Capability Notice** | Inspects declared capabilities for tools with external side effects | Warning | Flags external tool invocations requiring human confirmation. |

---

## 3. Snapshot Immutability
When a deployment candidate is created or promoted, the complete `ReleaseReadinessSnapshot` is computed and stored directly in the `agent_deployments.readiness_snapshot` column.

This snapshot records:
- Overall readiness decision (`isReady: boolean`)
- Readiness score ($0 - 100\%$)
- Number of tested and passed runs
- Pass rate percentage
- List of blockers and warnings
- Timestamp of evaluation

Auditors can review the exact evidence and criteria results that authorized any deployment at any point in history.

