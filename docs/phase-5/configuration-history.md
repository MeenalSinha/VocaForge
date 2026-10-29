# Phase 5 — Configuration History & Versioning

## Schema and Lineage Tracking
Every agent configuration change applied via a fix proposal is recorded as an immutable version in `agent_versions`:
- `version`: Monotonically increasing version number ($1, 2, 3, \dots$).
- `source`: Explicitly tracked as `fix_proposal` (distinguished from `created`, `manual_edit`, `refinement`, or `rollback`).
- `summary`: Change summary explaining the exact remediation made.
- `syncStatus`: `synced` vs `not_synced` vs `failed`.
- `syncedAt`: Timestamp of successful synchronization with ElevenLabs.

## Audit Trails & Activity Log
All lifecycle events are recorded in `activity_events`:
- `fix_proposal.created`
- `fix_proposal.approved`
- `fix_proposal.rejected`
- `fix_proposal.applied`
- `fix_proposal.retested`

## Rollback Readiness
Because each applied configuration change is preserved as a complete snapshot of `AgentConfig`, any version can be restored or rolled back to if a retest or regression test indicates degraded performance.
