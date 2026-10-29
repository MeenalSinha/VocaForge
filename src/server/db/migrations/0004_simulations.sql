-- Phase 4: Simulation & Execution Engine
-- Batches, individual test runs with immutable snapshots, remote test definition cache, transcripts and evaluations.

CREATE TABLE simulation_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id              text,
  target_agent_id       uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  remote_agent_id       text NOT NULL,
  name                  varchar(160) NOT NULL,
  status                varchar(32) NOT NULL DEFAULT 'queued',
  total_scenarios       integer NOT NULL DEFAULT 1,
  completed_scenarios   integer NOT NULL DEFAULT 0,
  passed_scenarios      integer NOT NULL DEFAULT 0,
  failed_scenarios      integer NOT NULL DEFAULT 0,
  errored_scenarios     integer NOT NULL DEFAULT 0,
  remote_invocation_id  text,
  execution_options     jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message         text,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_batches_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT simulation_batches_status_valid CHECK (
    status IN ('queued', 'preparing', 'running', 'completed', 'completed_with_failures', 'failed', 'infrastructure_error', 'timed_out', 'cancelled')
  )
);

CREATE INDEX simulation_batches_project_updated_idx ON simulation_batches (project_id, updated_at DESC);
CREATE INDEX simulation_batches_agent_idx ON simulation_batches (target_agent_id);
CREATE INDEX simulation_batches_status_idx ON simulation_batches (status);

CREATE TABLE simulation_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              uuid NOT NULL REFERENCES simulation_batches (id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id              text,
  target_agent_id       uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  scenario_id           uuid REFERENCES scenarios (id) ON DELETE SET NULL,
  persona_id            uuid REFERENCES personas (id) ON DELETE SET NULL,
  scenario_name         varchar(160) NOT NULL,
  persona_name          varchar(140) NOT NULL,
  scenario_snapshot     jsonb NOT NULL,
  persona_snapshot      jsonb NOT NULL,
  remote_test_id        text,
  remote_test_run_id    text,
  remote_invocation_id  text,
  status                varchar(32) NOT NULL DEFAULT 'pending',
  evaluation_result     varchar(32),
  evaluation_rationale  text,
  transcript            jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_result            jsonb,
  metrics               jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message         text,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_runs_status_valid CHECK (
    status IN ('pending', 'running', 'passed', 'failed_evaluation', 'infrastructure_error', 'timed_out', 'inconclusive')
  )
);

CREATE INDEX simulation_runs_batch_idx ON simulation_runs (batch_id);
CREATE INDEX simulation_runs_project_updated_idx ON simulation_runs (project_id, updated_at DESC);
CREATE INDEX simulation_runs_scenario_idx ON simulation_runs (scenario_id);
CREATE INDEX simulation_runs_persona_idx ON simulation_runs (persona_id);
CREATE INDEX simulation_runs_status_idx ON simulation_runs (status);

CREATE TABLE remote_test_definitions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  scenario_id    uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  persona_id     uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  config_hash    varchar(64) NOT NULL,
  remote_test_id text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remote_test_def_unique UNIQUE (scenario_id, persona_id, config_hash)
);

CREATE INDEX remote_test_def_lookup_idx ON remote_test_definitions (scenario_id, persona_id, config_hash);

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_event_type_valid;
ALTER TABLE activity_events ADD CONSTRAINT activity_event_type_valid CHECK (
  event_type IN (
    'project.created', 'project.updated', 'project.archived', 'project.restored',
    'agent.created', 'agent.updated', 'agent.synced', 'agent.archived', 'agent.remote_deleted',
    'persona.created', 'persona.updated', 'persona.duplicated', 'persona.archived',
    'scenario.created', 'scenario.updated', 'scenario.duplicated', 'scenario.archived',
    'collection.created', 'collection.updated', 'collection.deleted',
    'simulation.started', 'simulation.completed', 'simulation.failed'
  )
);
