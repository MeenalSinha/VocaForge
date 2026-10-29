-- Migration 0006: Deployments, Observability & Release Management
-- Table for tracking agent release candidates, verified deployments, environments, and rollback history.

CREATE TABLE agent_deployments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id                text,
  agent_id                uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  agent_version           integer NOT NULL,
  environment             varchar(32) NOT NULL DEFAULT 'production',
  status                  varchar(32) NOT NULL DEFAULT 'draft',
  remote_agent_id         varchar(128),
  readiness_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                   text,
  previous_deployment_id  uuid REFERENCES agent_deployments (id) ON DELETE SET NULL,
  deployed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_deployments_env_valid CHECK (
    environment IN ('production', 'staging', 'development')
  ),
  CONSTRAINT agent_deployments_status_valid CHECK (
    status IN ('draft', 'verifying', 'ready_for_release', 'publishing', 'deployed', 'failed', 'rolled_back', 'archived')
  )
);

CREATE INDEX agent_deployments_agent_idx ON agent_deployments (agent_id, created_at DESC);
CREATE INDEX agent_deployments_project_idx ON agent_deployments (project_id, created_at DESC);
CREATE INDEX agent_deployments_status_idx ON agent_deployments (status);
CREATE INDEX agent_deployments_env_idx ON agent_deployments (environment);

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_event_type_valid;
ALTER TABLE activity_events ADD CONSTRAINT activity_event_type_valid CHECK (
  event_type IN (
    'project.created', 'project.updated', 'project.archived', 'project.restored',
    'agent.created', 'agent.updated', 'agent.synced', 'agent.archived', 'agent.remote_deleted', 'agent.rollback',
    'persona.created', 'persona.updated', 'persona.duplicated', 'persona.archived',
    'scenario.created', 'scenario.updated', 'scenario.duplicated', 'scenario.archived',
    'collection.created', 'collection.updated', 'collection.deleted',
    'simulation.started', 'simulation.completed', 'simulation.failed',
    'fix_proposal.created', 'fix_proposal.approved', 'fix_proposal.rejected', 'fix_proposal.applied', 'fix_proposal.retested',
    'deployment.created', 'deployment.completed', 'deployment.failed', 'deployment.rolled_back'
  )
);
