# Phase 6: Telemetry, Observability & Analytics

## 1. Real-Time Operational Telemetry
The VocaForge Observability Engine (`src/server/observability/service.ts`) computes genuine performance and safety metrics directly from recorded simulation executions and failure analyses.

No metrics, pass rates, or category counts are ever hardcoded or simulated.

---

## 2. Aggregated Operational Metrics
The **Results & Observability** dashboard displays 6 core KPI cards:
1. **Total Test Runs**: Cumulative count of all recorded simulation executions.
2. **Completed Evaluations**: Settled evaluations (`passed`, `failed_evaluation`, `inconclusive`). Infrastructure errors are tracked separately so network faults do not distort AI quality metrics.
3. **Passing Rate (%)**: $\frac{\text{passedEvaluations}}{\text{completedEvaluations}} \times 100$. Rendered with threshold indicators ($\ge 80\%$ emerald, $50-79\%$ amber, $<50\%$ rose).
4. **Unresolved Findings**: Count of open, actionable failure findings requiring remediation.
5. **Retest Resolution Rate (%)**: Ratio of approved fix proposals whose retests demonstrated positive regression resolution.
6. **Deployed Agents Count**: Number of active production voice releases across the project.

---

## 3. Failure Category Breakdown
VocaForge categorizes conversation discrepancies across 12 canonical failure categories:
- `unsupported_answer`
- `objective_failed`
- `unnecessary_repetition`
- `missing_information`
- `policy_violation`
- `incorrect_tool_usage`
- `tool_execution_failed`
- `language_barrier`
- `premature_end`
- `excessive_turns`
- `contradictory_response`
- `insufficient_evidence`

The Results workspace renders a visual category breakdown grid displaying exact counts and definitions.

---

## 4. Filterable Execution History & Transcript Inspection
The Results table enables operators to:
- Filter executions by target agent, verdict status (`passed`, `failed_evaluation`, `infrastructure_error`, `inconclusive`), or scenario/persona search.
- Review findings counts and retest resolution badges.
- One-click click to open the **TranscriptDrawer**, displaying full turn-by-turn conversation transcripts, timestamps, speaker tags, and linked failure findings.

