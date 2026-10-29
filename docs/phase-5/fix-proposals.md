# Phase 5 — AI Remediation Fix Proposals

## Overview
Remediation Fix Proposals turn diagnosed failure findings into concrete, minimal configuration improvements. Users review the proposed modifications side-by-side using a structured visual diff before anything is committed or deployed.

## Core Rules for Fix Proposals
1. **Targeted and Minimal**: Modifications strictly target the root cause identified in the finding. Core identity, voice configurations, language parameters, and unrelated sections are preserved without perturbation.
2. **Strict Schema Validation**: All proposed configurations are parsed and validated against `agentConfigSchema` with Zod prior to persistence.
3. **Structured Review Lifecycle**:
   - `pending_review`: Initial state upon AI generation.
   - `approved`: Explicitly authorized by the user for deployment.
   - `rejected`: Declined by the user with optional documented rationale.
   - `applied_locally`: Configuration committed as a new agent version in PostgreSQL.
   - `synced_remotely`: Successfully synchronized with ElevenLabs Conversational AI.
   - `sync_failed`: Local commit succeeded, but remote API call failed (re-syncable via button).

## Concurrency and Stale Version Detection
When generating a fix proposal, the agent's current version is captured as `baseVersion`.
If the agent is modified between the time the proposal is generated and when the user clicks "Apply & Deploy Fix":
- The engine halts execution with a `409 ConflictError`.
- The user is notified that the agent has evolved to a newer version.
- The UI exposes a reconciliation option (`reconcileStale: true`) to safely merge changes and increment the configuration version without corrupting intermediate updates.

