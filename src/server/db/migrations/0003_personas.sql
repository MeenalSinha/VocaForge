-- Phase 3: Virtual Customer Studio
-- Personas, Scenarios, and Collections for testing voice AI agents.

CREATE TABLE personas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id     text,
  name         varchar(120) NOT NULL,
  description  text,
  category     varchar(60) NOT NULL DEFAULT 'custom',
  template_id  varchar(80),
  status       varchar(24) NOT NULL DEFAULT 'draft',
  version      integer NOT NULL DEFAULT 1,
  config       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personas_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT personas_version_positive CHECK (version >= 1),
  CONSTRAINT personas_status_valid CHECK (status IN ('draft', 'needs_configuration', 'ready_for_testing', 'archived')),
  CONSTRAINT personas_category_valid CHECK (
    category IN ('customer_experience', 'pricing_policies', 'communication', 'support', 'custom')
  )
);

CREATE INDEX personas_project_updated_idx ON personas (project_id, updated_at DESC);
CREATE INDEX personas_project_status_idx ON personas (project_id, status);

CREATE TABLE scenarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id        text,
  persona_id      uuid NOT NULL REFERENCES personas (id) ON DELETE RESTRICT,
  target_agent_id uuid REFERENCES agents (id) ON DELETE SET NULL,
  name            varchar(140) NOT NULL,
  description     text,
  status          varchar(24) NOT NULL DEFAULT 'draft',
  priority        varchar(20) NOT NULL DEFAULT 'medium',
  config          jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scenarios_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT scenarios_status_valid CHECK (status IN ('draft', 'needs_configuration', 'ready_for_testing', 'archived')),
  CONSTRAINT scenarios_priority_valid CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX scenarios_project_updated_idx ON scenarios (project_id, updated_at DESC);
CREATE INDEX scenarios_persona_idx ON scenarios (persona_id);
CREATE INDEX scenarios_target_agent_idx ON scenarios (target_agent_id);

CREATE TABLE persona_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id    text,
  name        varchar(120) NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collections_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX collections_project_idx ON persona_collections (project_id, updated_at DESC);

CREATE TABLE persona_collection_items (
  collection_id uuid NOT NULL REFERENCES persona_collections (id) ON DELETE CASCADE,
  persona_id    uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  scenario_id   uuid REFERENCES scenarios (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, persona_id)
);

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_event_type_valid;
ALTER TABLE activity_events ADD CONSTRAINT activity_event_type_valid CHECK (
  event_type IN (
    'project.created', 'project.updated', 'project.archived', 'project.restored',
    'agent.created', 'agent.updated', 'agent.synced', 'agent.archived', 'agent.remote_deleted',
    'persona.created', 'persona.updated', 'persona.duplicated', 'persona.archived',
    'scenario.created', 'scenario.updated', 'scenario.duplicated', 'scenario.archived',
    'collection.created', 'collection.updated', 'collection.deleted'
  )
);

