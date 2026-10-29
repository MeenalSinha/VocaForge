# Phase 6: Deployment Model

## 1. Overview
The VocaForge deployment model establishes a disciplined, audit-trailed pathway for transitioning AI voice agents from development and experimental evaluation into live caller-facing environments.

Rather than conflating local configuration edits with remote release status, VocaForge maintains strict separation between:
1. **Local Agent Configuration Revisions (`agent_versions`)**: Immutable historical revisions of prompt instructions, guardrails, voice settings, and declared capabilities.
2. **Remote Provider State (`synced_version` / `remote_agent_id`)**: Remote synchronization with ElevenLabs.
3. **Environment Deployments (`agent_deployments`)**: Tracked deployments targeting specific environments (`production`, `staging`, `development`), capturing verification snapshots, promotion timestamps, and rollback links.

---

## 2. Target Environments
- **`development`**: For iterative prompt tuning, active scenario authoring, and preliminary simulation runs.
- **`staging`**: Pre-release qualification environment where multi-persona scenario suites and regression benchmarks run.
- **`production`**: Live caller-facing release. Strict release readiness verification required before promotion.

---

## 3. Deployment Lifecycle States
A deployment record transitions through the following lifecycle states:
- **`draft`**: Initial release candidate registered, but pre-release verification checklist has outstanding blockers.
- **`ready_for_release`**: Automated pre-release readiness evaluation passed with zero blockers. Eligible for promotion.
- **`verifying`**: In-flight verification suite or preflight qualification execution.
- **`publishing`**: Synchronization and release promotion in-flight.
- **`deployed`**: Active live deployment serving callers in the designated environment.
- **`rolled_back`**: Superseded by a rollback action that safely restored an earlier baseline.
- **`archived`**: Previous active deployment superseded by a newer verified release candidate.
- **`failed`**: Promotion failed (e.g., ElevenLabs API rejection, credentials error, or safety violation).

---

## 4. Referential Integrity and Database Constraints
The deployment model is backed by PostgreSQL migration `0006_deployments_and_observability.sql`:
- Foreign keys link to `projects(id)` and `agents(id)` with cascading integrity.
- Self-referencing foreign key `previous_deployment_id` tracks lineage across releases.
- JSONB `readiness_snapshot` permanently preserves the evidence-based criteria score, blockers, and check results at the exact instant of release.
- Unique constraints and index structures ensure high-speed lookups of active deployed agents per environment.
