# Phase 5 — Retesting & Regression Verification

## Retest Execution Pipeline
Once a fix proposal has been applied, users trigger a targeted retest with one click from either the Fix Review modal or Test Lab.
1. **Targeted Retest Invocation**: A new simulation batch is created with `name: Retest: <summary>`, referencing the exact scenario that previously failed.
2. **Regression Scenarios**: Additional scenarios may be appended to verify that fixing one problem did not break existing capabilities.
3. **Automated Comparison Generation**: Upon retest completion, `buildAndStoreComparison` automatically evaluates:
   - `failureResolved`: `true` if the original run failed (`failed_evaluation`, `inconclusive`, etc.) and the retest run passed (`passed`).
   - `outcomeChanged`: `true` if the run statuses differ.
   - `comparisonSummary`: Clear explanation of before-and-after outcome.
   - `originalMetrics` vs `retestMetrics`: Compares turns count, call duration, and evaluator rationales.

## Non-Destructive Preservation
Original run transcripts, snapshots, and evaluator evaluations are never overwritten or mutated. The `retest_comparisons` table maintains foreign key references to both `original_run_id` and `retest_run_id`, guaranteeing full auditability.

