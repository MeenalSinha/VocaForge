# Phase 4 Implementation Plan: Simulation & Execution Engine

## 1. Overview & Objectives

Phase 4 bridges VocaForge's configuration and modeling systems (Phases 0-3) to real-world voice agent testing by delivering the **Simulation & Execution Engine** and the interactive **Test Lab**.

Users can deploy configured virtual customer personas and testing scenarios against real ElevenLabs conversational voice agents, execute test batches, monitor progress through automated polling, and inspect authentic conversation transcripts and criteria evaluations.

## 2. Key Architecture Principles

1. **Official ElevenLabs Agent Testing API:** Uses modern agent testing workflows (`POST /v1/convai/agent-testing/create`, `POST /v1/convai/agents/:agent_id/run-tests`, `GET /v1/convai/test-invocations/:invocation_id`). Deprecated `/simulate-conversation` endpoints are strictly excluded.
2. **Immutable Snapshot Persistence:** Every simulation run captures full JSONB snapshots of the scenario and persona at execution time. Future edits to personas or scenarios do not mutate historical evidence.
3. **Deterministic Remote Definition Caching:** Uses SHA-256 fingerprinting across `(personaName, personaCategory, personaConfig, scenarioName, scenarioConfig)`. Identical combinations reuse provisioned remote test IDs, preventing clutter in ElevenLabs while ensuring any change produces a new test definition.
4. **Defensive Error vs. Evaluation Classification:** Accurately separates condition evaluation failures (`failed_evaluation`, where criteria were evaluated and failed) from transport/runtime issues (`infrastructure_error` / `timed_out`).
5. **Non-Destructive Reruns:** Rerunning a scenario triggers a fresh batch execution without overwriting or deleting historical test evidence.

## 3. Implementation Milestones

- [x] Pre-upgrade audit and defect repair (Phases 0-3 verified).
- [x] Database migration `0004_simulations.sql` (`simulation_batches`, `simulation_runs`, `remote_test_definitions`, and `activity_events` enum updates).
- [x] Schema & Mapping Layer (`src/server/simulations/schema.ts`, `mapping.ts`).
- [x] Status Classifier & Transcript Normalizer (`src/server/simulations/classifier.ts`).
- [x] Execution Engine & Repository Service (`src/server/simulations/repository.ts`, `service.ts`).
- [x] API Route Handlers (`/api/simulations/*`).
- [x] Interactive Test Lab UI (`src/app/(app)/test-lab/page.tsx` and components).
- [x] Automated Unit, Integration, and UI Tests.
- [x] Documentation & Production Build Verification.
