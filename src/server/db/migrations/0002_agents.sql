-- Phase 2: agents, immutable configuration versions, and a creation-operation ledger.
-- An agents row exists ONLY after ElevenLabs returned a real agent id, so remote_agent_id is NOT NULL.

CREATE TABLE agents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects (id),
  owner_id           text,
  name               varchar(100) NOT NULL,
  description        text,
  use_case           varchar(40),
  creation_prompt    text,
  config             jsonb NOT NULL,
  config_version     integer NOT NULL DEFAULT 1,
  synced_version     integer,
  voice_id           text,
  primary_language   varchar(12) NOT NULL,
  remote_agent_id    text NOT NULL,
  status             varchar(20) NOT NULL DEFAULT 'active',
  remote_checked_at  timestamptz,
  remote_status_note text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agents_status_valid CHECK (status IN ('active', 'remote_missing', 'remote_deleted', 'archived')),
  CONSTRAINT agents_version_positive CHECK (config_version >= 1),
  CONSTRAINT agents_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX agents_remote_agent_id_unique ON agents (remote_agent_id);
CREATE INDEX agents_project_updated_idx ON agents (project_id, updated_at DESC);

CREATE TABLE agent_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  version     integer NOT NULL,
  config      jsonb NOT NULL,
  summary     text NOT NULL,
  source      varchar(20) NOT NULL,
  sync_status varchar(12) NOT NULL DEFAULT 'not_synced',
  synced_at   timestamptz,
  sync_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_versions_source_valid CHECK (source IN ('created', 'manual_edit', 'refinement')),
  CONSTRAINT agent_versions_sync_valid CHECK (sync_status IN ('not_synced', 'synced', 'failed'))
);
CREATE UNIQUE INDEX agent_versions_agent_version_unique ON agent_versions (agent_id, version);

CREATE TABLE agent_operations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects (id),
  owner_id        text,
  idempotency_key varchar(80) NOT NULL,
  status          varchar(20) NOT NULL,
  config          jsonb NOT NULL,
  creation_prompt text,
  use_case        varchar(40),
  remote_agent_id text,
  agent_id        uuid REFERENCES agents (id) ON DELETE SET NULL,
  error_code      varchar(40),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_operations_status_valid CHECK (status IN ('pending', 'remote_created', 'completed', 'failed', 'unknown', 'dismissed'))
);
CREATE UNIQUE INDEX agent_operations_key_unique ON agent_operations (idempotency_key);
CREATE INDEX agent_operations_status_idx ON agent_operations (status, created_at DESC);

ALTER TABLE activity_events DROP CONSTRAINT activity_event_type_valid;
ALTER TABLE activity_events ADD CONSTRAINT activity_event_type_valid CHECK (
  event_type IN ('project.created', 'project.updated', 'project.archived', 'project.restored',
                 'agent.created', 'agent.updated', 'agent.synced', 'agent.archived', 'agent.remote_deleted')
);
