# Simulation & Execution Architecture (Phase 4)

## Architecture Overview

The Phase 4 Simulation & Execution Engine bridges VocaForge's persona modeling (Phase 3) with ElevenLabs voice agent infrastructure (Phases 1-2).

```
   ┌────────────────────────────────────────────────────────┐
   │                     Test Lab UI                        │
   │  (/test-lab - Agent Picker, Scenario Checklist, Runs)  │
   └──────────────────────────┬─────────────────────────────┘
                              │
               1. Preflight   │   2. Start Batch
               POST /preflight│   POST /api/simulations
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │              Simulation Service Layer                  │
   │  - runPreflightCheck()      - startSimulationBatch()   │
   │  - pollSimulationBatch()    - rerunSimulationRun()     │
   └───────────────┬────────────────────────────┬───────────┘
                   │                            │
   3. SHA-256 Hash │ Caching        4. Mapping  │
                   ▼                            ▼
   ┌──────────────────────────┐   ┌─────────────────────────┐
   │ remote_test_definitions  │   │  ElevenLabs Client      │
   │ (Cache table by hash)    │   │  - createSimulationTest │
   └──────────────────────────┘   │  - runTests             │
                   ▲              │  - getTestInvocation    │
                   │              └─────────────┬───────────┘
                   │                            │
   5. PostgreSQL Transaction                    │ 6. Remote Test Invocation
   ┌───────────────────────────────────┐        │
   │ - simulation_batches              │◄───────┘
   │ - simulation_runs (Snapshots)     │
   │ - activity_events                 │
   └───────────────────────────────────┘
```

## Lifecycle Flow

1. **Preflight Verification (`runPreflightCheck`)**:
   - Validates active project ownership.
   - Verifies target voice agent exists and possesses a synchronized `remoteAgentId`.
   - Inspects each chosen scenario and its linked virtual customer persona for readiness, draft warnings, and critical blockers (e.g., missing failure conditions, unconfigured objectives).
   - Detects declared agent tool capabilities and surfaces tool safety notices.

2. **Test Preparation & Caching (`mapToElevenLabsTestInput`, `computeSimulationConfigHash`)**:
   - Synthesizes caller persona traits, communication style, patience level, knowledge boundaries, and scenario starting conditions into a cohesive prompt.
   - Extracts success conditions (capped at 10 items) including positive goals, critical checkpoints, and negative conditions (prefixed with `The agent must not:`).
   - Computes deterministic SHA-256 fingerprint:
     `SHA256(personaName, personaCategory, personaConfig, scenarioName, scenarioConfig)`
   - Checks `remote_test_definitions` table. If cached, reuses existing `remoteTestId`. If new or edited, provisions a fresh test via ElevenLabs Agent Testing API (`POST /v1/convai/agent-testing/create`).

3. **Execution Triggering & Snapshot Persistence**:
   - Opens a PostgreSQL transaction (`withTransaction`).
   - Inserts `simulation_batches` record with execution options (concurrency, repeats).
   - Inserts `simulation_runs` for each scenario, embedding immutable JSONB snapshots:
     - `scenario_snapshot`
     - `persona_snapshot`
   - Submits test IDs to ElevenLabs (`POST /v1/convai/agents/:agent_id/run-tests`).
   - Records `remote_invocation_id` and transitions batch and runs to `running`.
   - Records activity event `simulation.started`.

4. **Background Polling & Classification (`pollSimulationBatch`)**:
   - Retrieves invocation details from ElevenLabs (`GET /v1/convai/test-invocations/:invocation_id`).
   - Maps raw messages to standardized `TranscriptMessage[]` format (normalizing user/agent roles and preserving timing).
   - Classifies run outcome via `classifyRemoteRun`:
     - Distinguishes evaluation failures (`failed_evaluation`, where criteria checks ran and failed) from transport/runtime errors (`infrastructure_error` / `timed_out`).
   - Computes turn counts and metrics.
   - Aggregates overall batch outcomes: `completed`, `completed_with_failures`, `failed`, or `infrastructure_error`.

5. **Non-Destructive Reruns (`rerunSimulationRun`)**:
   - Fetches the historical run and its original scenario reference.
   - Spawns a fresh rerun batch and run without mutating or deleting historical evidence.
