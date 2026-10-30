import type { Db } from "../db/pool";
import type {
  EvidenceReference,
  FailureConfidence,
  FailureFindingRecord,
  FailureSeverity,
  FieldChange,
  FixProposalRecord,
  ProposalStatus,
  RemoteSyncStatus,
  RetestComparisonRecord,
} from "./schema";
import type { FailureCategory } from "./categories";
import type { AgentConfig } from "../agents/config-schema";

interface FindingRow {
  id: string;
  run_id: string;
  batch_id: string;
  project_id: string;
  owner_id: string | null;
  target_agent_id: string;
  tested_version: number;
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence_references: EvidenceReference[];
  expected_behavior: string;
  observed_behavior: string;
  discrepancy_explanation: string;
  confidence: string;
  is_actionable: boolean;
  suggested_action: string;
  analysis_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface ProposalRow {
  id: string;
  project_id: string;
  owner_id: string | null;
  target_agent_id: string;
  source_run_id: string;
  source_finding_id: string;
  base_version: number;
  proposed_config: AgentConfig;
  change_summary: string;
  field_changes: FieldChange[];
  rationale: string;
  expected_improvement: string;
  potential_risks: string;
  status: string;
  rejection_reason: string | null;
  applied_agent_version: number | null;
  remote_sync_status: string;
  remote_sync_error: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ComparisonRow {
  id: string;
  project_id: string;
  owner_id: string | null;
  fix_proposal_id: string;
  original_run_id: string;
  retest_run_id: string;
  retest_batch_id: string;
  tested_agent_version: number;
  outcome_changed: boolean;
  failure_resolved: boolean;
  comparison_summary: string;
  original_metrics: Record<string, unknown>;
  retest_metrics: Record<string, unknown>;
  created_at: Date;
}

function toFinding(r: FindingRow): FailureFindingRecord {
  return {
    id: r.id,
    runId: r.run_id,
    batchId: r.batch_id,
    projectId: r.project_id,
    ownerId: r.owner_id,
    targetAgentId: r.target_agent_id,
    testedVersion: Number(r.tested_version),
    category: r.category as FailureCategory,
    severity: r.severity as FailureSeverity,
    title: r.title,
    description: r.description,
    evidenceReferences: r.evidence_references || [],
    expectedBehavior: r.expected_behavior,
    observedBehavior: r.observed_behavior,
    discrepancyExplanation: r.discrepancy_explanation,
    confidence: r.confidence as FailureConfidence,
    isActionable: Boolean(r.is_actionable),
    suggestedAction: r.suggested_action,
    analysisMetadata: r.analysis_metadata || {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toProposal(r: ProposalRow): FixProposalRecord {
  return {
    id: r.id,
    projectId: r.project_id,
    ownerId: r.owner_id,
    targetAgentId: r.target_agent_id,
    sourceRunId: r.source_run_id,
    sourceFindingId: r.source_finding_id,
    baseVersion: Number(r.base_version),
    proposedConfig: r.proposed_config,
    changeSummary: r.change_summary,
    fieldChanges: r.field_changes || [],
    rationale: r.rationale,
    expectedImprovement: r.expected_improvement,
    potentialRisks: r.potential_risks,
    status: r.status as ProposalStatus,
    rejectionReason: r.rejection_reason,
    appliedAgentVersion: r.applied_agent_version != null ? Number(r.applied_agent_version) : null,
    remoteSyncStatus: r.remote_sync_status as RemoteSyncStatus,
    remoteSyncError: r.remote_sync_error,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toComparison(r: ComparisonRow): RetestComparisonRecord {
  return {
    id: r.id,
    projectId: r.project_id,
    ownerId: r.owner_id,
    fixProposalId: r.fix_proposal_id,
    originalRunId: r.original_run_id,
    retestRunId: r.retest_run_id,
    retestBatchId: r.retest_batch_id,
    testedAgentVersion: Number(r.tested_agent_version),
    outcomeChanged: Boolean(r.outcome_changed),
    failureResolved: Boolean(r.failure_resolved),
    comparisonSummary: r.comparison_summary,
    originalMetrics: r.original_metrics || {},
    retestMetrics: r.retest_metrics || {},
    createdAt: r.created_at.toISOString(),
  };
}

// ==========================================
// Failure Findings Queries
// ==========================================

export async function insertFinding(
  db: Db,
  ownerId: string | null,
  f: Omit<FailureFindingRecord, "id" | "ownerId" | "createdAt" | "updatedAt">,
): Promise<FailureFindingRecord> {
  const res = await db.query<FindingRow>(
    `INSERT INTO failure_findings (
       run_id, batch_id, project_id, owner_id, target_agent_id, tested_version,
       category, severity, title, description, evidence_references,
       expected_behavior, observed_behavior, discrepancy_explanation,
       confidence, is_actionable, suggested_action, analysis_metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18::jsonb
     ) RETURNING *`,
    [
      f.runId,
      f.batchId,
      f.projectId,
      ownerId,
      f.targetAgentId,
      f.testedVersion,
      f.category,
      f.severity,
      f.title,
      f.description,
      JSON.stringify(f.evidenceReferences),
      f.expectedBehavior,
      f.observedBehavior,
      f.discrepancyExplanation,
      f.confidence,
      f.isActionable,
      f.suggestedAction,
      JSON.stringify(f.analysisMetadata),
    ],
  );
  return toFinding(res.rows[0]!);
}

export async function findFindingsByRunId(
  db: Db,
  ownerId: string | null,
  runId: string,
): Promise<FailureFindingRecord[]> {
  const params: unknown[] = [runId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<FindingRow>(
    `SELECT * FROM failure_findings WHERE run_id = $1 AND ${ownerClause} ORDER BY created_at ASC`,
    params,
  );
  return res.rows.map(toFinding);
}

export async function findFindingsByAgentId(
  db: Db,
  ownerId: string | null,
  agentId: string,
): Promise<FailureFindingRecord[]> {
  const params: unknown[] = [agentId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<FindingRow>(
    `SELECT * FROM failure_findings WHERE target_agent_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toFinding);
}

export async function findFindingsByProjectId(
  db: Db,
  ownerId: string | null,
  projectId: string,
): Promise<FailureFindingRecord[]> {
  const params: unknown[] = [projectId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<FindingRow>(
    `SELECT * FROM failure_findings WHERE project_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toFinding);
}

export interface UnanalyzedRunItem {
  id: string;
  scenarioName: string;
  personaName: string;
  targetAgentId: string;
  status: string;
  evaluationResult: string | null;
  evaluationRationale: string | null;
  createdAt: string;
}

export async function findUnanalyzedFailedRunsByProjectId(
  db: Db,
  ownerId: string | null,
  projectId: string,
): Promise<UnanalyzedRunItem[]> {
  const params: unknown[] = [projectId];
  let ownerClause = "sr.owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `sr.owner_id = $${params.length}`;
  }
  const res = await db.query<{
    id: string;
    scenario_name: string;
    persona_name: string;
    target_agent_id: string;
    status: string;
    evaluation_result: string | null;
    evaluation_rationale: string | null;
    created_at: Date;
  }>(
    `SELECT sr.id, sr.scenario_name, sr.persona_name, sr.target_agent_id, sr.status, sr.evaluation_result, sr.evaluation_rationale, sr.created_at
     FROM simulation_runs sr
     WHERE sr.project_id = $1 AND ${ownerClause}
       AND (sr.status = 'failed_evaluation' OR sr.evaluation_result = 'failed')
       AND NOT EXISTS (SELECT 1 FROM failure_findings ff WHERE ff.run_id = sr.id)
     ORDER BY sr.created_at DESC`,
    params,
  );
  return res.rows.map((r) => ({
    id: r.id,
    scenarioName: r.scenario_name,
    personaName: r.persona_name,
    targetAgentId: r.target_agent_id,
    status: r.status,
    evaluationResult: r.evaluation_result,
    evaluationRationale: r.evaluation_rationale,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function findFindingById(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<FailureFindingRecord | null> {
  const params: unknown[] = [id];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<FindingRow>(
    `SELECT * FROM failure_findings WHERE id = $1 AND ${ownerClause}`,
    params,
  );
  return res.rows[0] ? toFinding(res.rows[0]) : null;
}

export async function deleteFindingsByRunId(
  db: Db,
  ownerId: string | null,
  runId: string,
): Promise<void> {
  const params: unknown[] = [runId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  await db.query(`DELETE FROM failure_findings WHERE run_id = $1 AND ${ownerClause}`, params);
}

// ==========================================
// Fix Proposals Queries
// ==========================================

export async function insertFixProposal(
  db: Db,
  ownerId: string | null,
  p: Omit<
    FixProposalRecord,
    "id" | "ownerId" | "rejectionReason" | "appliedAgentVersion" | "remoteSyncError" | "createdAt" | "updatedAt"
  >,
): Promise<FixProposalRecord> {
  const res = await db.query<ProposalRow>(
    `INSERT INTO fix_proposals (
       project_id, owner_id, target_agent_id, source_run_id, source_finding_id,
       base_version, proposed_config, change_summary, field_changes,
       rationale, expected_improvement, potential_risks, status, remote_sync_status
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14
     ) RETURNING *`,
    [
      p.projectId,
      ownerId,
      p.targetAgentId,
      p.sourceRunId,
      p.sourceFindingId,
      p.baseVersion,
      JSON.stringify(p.proposedConfig),
      p.changeSummary,
      JSON.stringify(p.fieldChanges),
      p.rationale,
      p.expectedImprovement,
      p.potentialRisks,
      p.status,
      p.remoteSyncStatus,
    ],
  );
  return toProposal(res.rows[0]!);
}

export async function findFixProposalById(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<FixProposalRecord | null> {
  const params: unknown[] = [id];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ProposalRow>(
    `SELECT * FROM fix_proposals WHERE id = $1 AND ${ownerClause}`,
    params,
  );
  return res.rows[0] ? toProposal(res.rows[0]) : null;
}

export async function findFixProposalsByFindingId(
  db: Db,
  ownerId: string | null,
  findingId: string,
): Promise<FixProposalRecord[]> {
  const params: unknown[] = [findingId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ProposalRow>(
    `SELECT * FROM fix_proposals WHERE source_finding_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toProposal);
}

export async function findFixProposalsByRunId(
  db: Db,
  ownerId: string | null,
  runId: string,
): Promise<FixProposalRecord[]> {
  const params: unknown[] = [runId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ProposalRow>(
    `SELECT * FROM fix_proposals WHERE source_run_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toProposal);
}

export async function findFixProposalsByProjectId(
  db: Db,
  ownerId: string | null,
  projectId: string,
): Promise<FixProposalRecord[]> {
  const params: unknown[] = [projectId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ProposalRow>(
    `SELECT * FROM fix_proposals WHERE project_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toProposal);
}

export async function updateFixProposalStatus(
  db: Db,
  ownerId: string | null,
  id: string,
  updates: {
    status: ProposalStatus;
    rejectionReason?: string | null;
    appliedAgentVersion?: number | null;
    remoteSyncStatus?: RemoteSyncStatus;
    remoteSyncError?: string | null;
  },
): Promise<FixProposalRecord> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [id];

  params.push(updates.status);
  sets.push(`status = $${params.length}`);

  if (updates.rejectionReason !== undefined) {
    params.push(updates.rejectionReason);
    sets.push(`rejection_reason = $${params.length}`);
  }
  if (updates.appliedAgentVersion !== undefined) {
    params.push(updates.appliedAgentVersion);
    sets.push(`applied_agent_version = $${params.length}`);
  }
  if (updates.remoteSyncStatus !== undefined) {
    params.push(updates.remoteSyncStatus);
    sets.push(`remote_sync_status = $${params.length}`);
  }
  if (updates.remoteSyncError !== undefined) {
    params.push(updates.remoteSyncError);
    sets.push(`remote_sync_error = $${params.length}`);
  }

  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }

  const res = await db.query<ProposalRow>(
    `UPDATE fix_proposals SET ${sets.join(", ")} WHERE id = $1 AND ${ownerClause} RETURNING *`,
    params,
  );
  return toProposal(res.rows[0]!);
}

// ==========================================
// Retest Comparisons Queries
// ==========================================

export async function insertRetestComparison(
  db: Db,
  ownerId: string | null,
  c: Omit<RetestComparisonRecord, "id" | "ownerId" | "createdAt">,
): Promise<RetestComparisonRecord> {
  const res = await db.query<ComparisonRow>(
    `INSERT INTO retest_comparisons (
       project_id, owner_id, fix_proposal_id, original_run_id, retest_run_id, retest_batch_id,
       tested_agent_version, outcome_changed, failure_resolved, comparison_summary,
       original_metrics, retest_metrics
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb
     ) RETURNING *`,
    [
      c.projectId,
      ownerId,
      c.fixProposalId,
      c.originalRunId,
      c.retestRunId,
      c.retestBatchId,
      c.testedAgentVersion,
      c.outcomeChanged,
      c.failureResolved,
      c.comparisonSummary,
      JSON.stringify(c.originalMetrics),
      JSON.stringify(c.retestMetrics),
    ],
  );
  return toComparison(res.rows[0]!);
}

export async function findComparisonByProposalId(
  db: Db,
  ownerId: string | null,
  proposalId: string,
): Promise<RetestComparisonRecord | null> {
  const params: unknown[] = [proposalId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ComparisonRow>(
    `SELECT * FROM retest_comparisons WHERE fix_proposal_id = $1 AND ${ownerClause} ORDER BY created_at DESC LIMIT 1`,
    params,
  );
  return res.rows[0] ? toComparison(res.rows[0]) : null;
}

export async function findComparisonByRunId(
  db: Db,
  ownerId: string | null,
  runId: string,
): Promise<RetestComparisonRecord | null> {
  const params: unknown[] = [runId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ComparisonRow>(
    `SELECT * FROM retest_comparisons WHERE (original_run_id = $1 OR retest_run_id = $1) AND ${ownerClause} ORDER BY created_at DESC LIMIT 1`,
    params,
  );
  return res.rows[0] ? toComparison(res.rows[0]) : null;
}

export async function findComparisonsByProjectId(
  db: Db,
  ownerId: string | null,
  projectId: string,
): Promise<RetestComparisonRecord[]> {
  const params: unknown[] = [projectId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }
  const res = await db.query<ComparisonRow>(
    `SELECT * FROM retest_comparisons WHERE project_id = $1 AND ${ownerClause} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(toComparison);
}
