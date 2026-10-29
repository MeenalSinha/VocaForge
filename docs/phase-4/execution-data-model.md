# Execution Data Model (Phase 4)

## Schema Overview

Migration `0004_simulations.sql` introduces three primary relational tables and updates activity event constraints.

### 1. `simulation_batches` Table

Tracks top-level test execution requests.

| Column | Type | Constraints / Defaults | Description |
|--------|------|------------------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique batch identifier |
| `project_id` | `uuid` | `REFERENCES projects(id) ON DELETE CASCADE` | Scoped project |
| `owner_id` | `text` | Nullable | Tenant / user owner |
| `target_agent_id` | `uuid` | `REFERENCES agents(id) ON DELETE CASCADE` | Local agent record |
| `remote_agent_id` | `text` | `NOT NULL` | ElevenLabs remote agent ID |
| `name` | `varchar(160)` | `NOT NULL, CHECK (length(btrim(name)) > 0)` | Human-readable batch name |
| `status` | `varchar(32)` | `DEFAULT 'queued'` | Status: `queued`, `preparing`, `running`, `completed`, `completed_with_failures`, `failed`, `infrastructure_error`, `timed_out`, `cancelled` |
| `total_scenarios` | `integer` | `DEFAULT 1` | Scenario count |
| `completed_scenarios`| `integer` | `DEFAULT 0` | Finished scenario count |
| `passed_scenarios` | `integer` | `DEFAULT 0` | Passed scenario count |
| `failed_scenarios` | `integer` | `DEFAULT 0` | Failed evaluation count |
| `errored_scenarios` | `integer` | `DEFAULT 0` | Transport / error count |
| `remote_invocation_id` | `text` | Nullable | ElevenLabs invocation ID |
| `execution_options` | `jsonb` | `DEFAULT '{}'::jsonb` | Repeat count, concurrency |
| `error_message` | `text` | Nullable | Error details if batch failed |
| `started_at` | `timestamptz` | Nullable | Time execution started |
| `completed_at` | `timestamptz` | Nullable | Time execution finished |
| `created_at` / `updated_at` | `timestamptz` | `DEFAULT now()` | Timestamps |

### 2. `simulation_runs` Table

Stores individual simulation test executions with immutable snapshot payloads and parsed transcripts.

| Column | Type | Constraints / Defaults | Description |
|--------|------|------------------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Run identifier |
| `batch_id` | `uuid` | `REFERENCES simulation_batches(id) ON DELETE CASCADE` | Parent batch |
| `project_id` | `uuid` | `REFERENCES projects(id) ON DELETE CASCADE` | Scoped project |
| `target_agent_id` | `uuid` | `REFERENCES agents(id) ON DELETE CASCADE` | Tested agent |
| `scenario_id` | `uuid` | `REFERENCES scenarios(id) ON DELETE SET NULL` | Scenario link |
| `persona_id` | `uuid` | `REFERENCES personas(id) ON DELETE SET NULL` | Persona link |
| `scenario_name` | `varchar(160)` | `NOT NULL` | Snapshot name |
| `persona_name` | `varchar(140)` | `NOT NULL` | Snapshot name |
| `scenario_snapshot` | `jsonb` | `NOT NULL` | Immutable scenario config |
| `persona_snapshot` | `jsonb` | `NOT NULL` | Immutable persona config |
| `remote_test_id` | `text` | Nullable | Provisioned remote test ID |
| `remote_test_run_id` | `text` | Nullable | Remote run ID |
| `remote_invocation_id` | `text` | Nullable | Invocation ID |
| `status` | `varchar(32)` | `DEFAULT 'pending'` | Status: `pending`, `running`, `passed`, `failed_evaluation`, `infrastructure_error`, `timed_out`, `inconclusive` |
| `evaluation_result` | `varchar(32)` | Nullable | `passed`, `failed`, `error`, `inconclusive` |
| `evaluation_rationale` | `text` | Nullable | ElevenLabs LLM judge explanation |
| `transcript` | `jsonb` | `DEFAULT '[]'::jsonb` | Array of `TranscriptMessage` |
| `raw_result` | `jsonb` | Nullable | Raw remote response |
| `metrics` | `jsonb` | `DEFAULT '{}'::jsonb` | Turns count, duration |
| `error_message` | `text` | Nullable | Error details if failed |

### 3. `remote_test_definitions` Table

Caches remote ElevenLabs test definitions by SHA-256 fingerprint.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | ID |
| `project_id` | `uuid` | `REFERENCES projects(id) ON DELETE CASCADE` | Scoped project |
| `scenario_id` | `uuid` | `REFERENCES scenarios(id) ON DELETE CASCADE` | Scenario link |
| `persona_id` | `uuid` | `REFERENCES personas(id) ON DELETE CASCADE` | Persona link |
| `config_hash` | `varchar(64)` | `NOT NULL` | SHA-256 hex hash |
| `remote_test_id` | `text` | `NOT NULL` | ElevenLabs test ID |
| `created_at` / `updated_at` | `timestamptz` | `DEFAULT now()` | Timestamps |
| `CONSTRAINT` | `UNIQUE` | `(scenario_id, persona_id, config_hash)` | Unique cache constraint |
