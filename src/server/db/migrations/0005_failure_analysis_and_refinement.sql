-- Migration 0005: Failure Analysis & Closed-Loop Refinement
-- Tables for failure findings, AI fix proposals, and retest before-and-after comparisons.

CREATE TABLE failure_findings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  uuid NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  batch_id                uuid NOT NULL REFERENCES simulation_batches (id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id                text,
  target_agent_id         uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  tested_version          integer NOT NULL DEFAULT 1,
  category                varchar(64) NOT NULL,
  severity                varchar(16) NOT NULL DEFAULT 'major',
  title                   varchar(200) NOT NULL,
  description             text NOT NULL,
  evidence_references     jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_behavior       text NOT NULL,
  observed_behavior       text NOT NULL,
  discrepancy_explanation text NOT NULL,
  confidence              varchar(16) NOT NULL DEFAULT 'proven',
  is_actionable           boolean NOT NULL DEFAULT true,
  suggested_action        text NOT NULL,
  analysis_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT failure_findings_severity_valid CHECK (
    severity IN ('critical', 'major', 'minor', 'info')
  ),
  CONSTRAINT failure_findings_confidence_valid CHECK (
    confidence IN ('proven', 'hypothesis', 'inconclusive')
  )
);

CREATE INDEX failure_findings_run_idx ON failure_findings (run_id, created_at DESC);
CREATE INDEX failure_findings_agent_idx ON failure_findings (target_agent_id, created_at DESC);
CREATE INDEX failure_findings_project_idx ON failure_findings (project_id, created_at DESC);

CREATE TABLE fix_proposals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id              text,
  target_agent_id       uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  source_run_id         uuid NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  source_finding_id     uuid NOT NULL REFERENCES failure_findings (id) ON DELETE CASCADE,
  base_version          integer NOT NULL,
  proposed_config       jsonb NOT NULL,
  change_summary        text NOT NULL,
  field_changes         jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale             text NOT NULL,
  expected_improvement  text NOT NULL,
  potential_risks       text NOT NULL,
  status                varchar(32) NOT NULL DEFAULT 'pending_review',
  rejection_reason      text,
  applied_agent_version integer,
  remote_sync_status    varchar(32) NOT NULL DEFAULT 'not_applied',
  remote_sync_error     text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fix_proposals_status_valid CHECK (
    status IN ('pending_review', 'approved', 'rejected', 'applied_locally', 'synced_remotely', 'sync_failed', 'superseded')
  ),
  CONSTRAINT fix_proposals_remote_sync_valid CHECK (
    remote_sync_status IN ('not_applied', 'pending', 'synced', 'failed')
  )
);

CREATE INDEX fix_proposals_agent_idx ON fix_proposals (target_agent_id, created_at DESC);
CREATE INDEX fix_proposals_run_idx ON fix_proposals (source_run_id);
CREATE INDEX fix_proposals_finding_idx ON fix_proposals (source_finding_id);
CREATE INDEX fix_proposals_status_idx ON fix_proposals (status);

CREATE TABLE retest_comparisons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id              text,
  fix_proposal_id       uuid NOT NULL REFERENCES fix_proposals (id) ON DELETE CASCADE,
  original_run_id       uuid NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  retest_run_id         uuid NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  retest_batch_id       uuid NOT NULL REFERENCES simulation_batches (id) ON DELETE CASCADE,
  tested_agent_version  integer NOT NULL,
  outcome_changed       boolean NOT NULL,
  failure_resolved      boolean NOT NULL,
  comparison_summary    text NOT NULL,
  original_metrics      jsonb NOT NULL DEFAULT '{}'::jsonb,
  retest_metrics        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX retest_comparisons_proposal_idx ON retest_comparisons (fix_proposal_id);
CREATE INDEX retest_comparisons_original_run_idx ON retest_comparisons (original_run_id);
CREATE INDEX retest_comparisons_retest_run_idx ON retest_comparisons (retest_run_id);

ALTER TABLE agent_versions DROP CONSTRAINT IF EXISTS agent_versions_source_valid;
ALTER TABLE agent_versions ADD CONSTRAINT agent_versions_source_valid CHECK (
  source IN ('created', 'manual_edit', 'refinement', 'fix_proposal', 'rollback')
);

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_event_type_valid;
ALTER TABLE activity_events ADD CONSTRAINT activity_event_type_valid CHECK (
  event_type IN (
    'project.created', 'project.updated', 'project.archived', 'project.restored',
    'agent.created', 'agent.updated', 'agent.synced', 'agent.archived', 'agent.remote_deleted',
    'persona.created', 'persona.updated', 'persona.duplicated', 'persona.archived',
    'scenario.created', 'scenario.updated', 'scenario.duplicated', 'scenario.archived',
    'collection.created', 'collection.updated', 'collection.deleted',
    'simulation.started', 'simulation.completed', 'simulation.failed',
    'fix_proposal.created', 'fix_proposal.approved', 'fix_proposal.rejected', 'fix_proposal.applied', 'fix_proposal.retested'
  )
);
