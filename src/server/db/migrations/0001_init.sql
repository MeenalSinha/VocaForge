-- Phase 1 foundation: projects and persisted activity.
-- gen_random_uuid() is built in to PostgreSQL 13+.

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  description text,
  status      varchar(16)  NOT NULL DEFAULT 'active',
  -- Reserved for per-user ownership once authentication exists. NULL = single shared workspace.
  owner_id    text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT projects_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT projects_status_valid CHECK (status IN ('active', 'archived')),
  CONSTRAINT projects_description_length CHECK (description IS NULL OR length(description) <= 2000)
);

-- Active project names are unique (case-insensitive). Archived projects free up their name.
CREATE UNIQUE INDEX projects_active_name_unique ON projects (lower(name)) WHERE status = 'active';
CREATE INDEX projects_status_updated_idx ON projects (status, updated_at DESC);

CREATE TABLE activity_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects (id) ON DELETE SET NULL,
  owner_id   text,
  event_type varchar(32) NOT NULL,
  summary    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_event_type_valid CHECK (
    event_type IN ('project.created', 'project.updated', 'project.archived', 'project.restored')
  )
);

CREATE INDEX activity_events_created_idx ON activity_events (created_at DESC);
