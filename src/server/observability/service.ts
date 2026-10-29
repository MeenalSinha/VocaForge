import type { Pool } from "pg";
import { getPool } from "../db/pool";
import type { FailureCategory } from "../analysis/categories";
import { FAILURE_CATEGORIES } from "../analysis/categories";

export interface ObservabilityContext {
  store?: Pool;
  ownerId?: string | null;
}

const poolOf = (c?: ObservabilityContext) => c?.store ?? getPool();
const ownerOf = (c?: ObservabilityContext) => c?.ownerId ?? null;

export interface ObservabilityMetrics {
  totalRuns: number;
  completedEvaluations: number;
  passedEvaluations: number;
  failedEvaluations: number;
  infrastructureErrors: number;
  inconclusiveRuns: number;
  passingRatePercentage: number | null;
  totalFindings: number;
  unresolvedFindings: number;
  totalProposals: number;
  approvedProposals: number;
  appliedProposals: number;
  retestsCount: number;
  resolvedRetestsCount: number;
  retestResolutionRatePercentage: number | null;
  deployedAgentsCount: number;
  categoryDistribution: Record<FailureCategory, number>;
}

export async function getObservabilityMetrics(
  projectId: string,
  ctx?: ObservabilityContext,
): Promise<ObservabilityMetrics> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const ownerParam = ownerId !== null ? "AND owner_id = $2" : "AND owner_id IS NULL";
  const params: unknown[] = [projectId];
  if (ownerId !== null) params.push(ownerId);

  // 1. Simulation Run Counts
  const runsQuery = await pool.query<{
    status: string;
    count: string;
  }>(
    `SELECT status, COUNT(*)::text as count
     FROM simulation_runs
     WHERE project_id = $1 ${ownerParam}
     GROUP BY status`,
    params,
  );

  let totalRuns = 0;
  let passedEvaluations = 0;
  let failedEvaluations = 0;
  let infrastructureErrors = 0;
  let inconclusiveRuns = 0;

  for (const row of runsQuery.rows) {
    const c = parseInt(row.count, 10) || 0;
    totalRuns += c;
    if (row.status === "passed") passedEvaluations += c;
    if (row.status === "failed_evaluation") failedEvaluations += c;
    if (row.status === "infrastructure_error") infrastructureErrors += c;
    if (row.status === "inconclusive") inconclusiveRuns += c;
  }

  const completedEvaluations = passedEvaluations + failedEvaluations + inconclusiveRuns;
  const passingRatePercentage =
    completedEvaluations > 0
      ? Math.round((passedEvaluations / completedEvaluations) * 100)
      : null;

  // 2. Findings counts and distribution
  const findingsQuery = await pool.query<{
    category: string;
    count: string;
  }>(
    `SELECT category, COUNT(*)::text as count
     FROM failure_findings
     WHERE project_id = $1 ${ownerParam}
     GROUP BY category`,
    params,
  );

  let totalFindings = 0;
  const categoryDistribution: Record<FailureCategory, number> = {} as Record<FailureCategory, number>;
  for (const cat of FAILURE_CATEGORIES) {
    categoryDistribution[cat] = 0;
  }

  for (const row of findingsQuery.rows) {
    const c = parseInt(row.count, 10) || 0;
    totalFindings += c;
    if (row.category in categoryDistribution) {
      categoryDistribution[row.category as FailureCategory] = c;
    }
  }

  // 3. Fix Proposals counts
  const proposalsQuery = await pool.query<{
    status: string;
    count: string;
  }>(
    `SELECT status, COUNT(*)::text as count
     FROM fix_proposals
     WHERE project_id = $1 ${ownerParam}
     GROUP BY status`,
    params,
  );

  let totalProposals = 0;
  let approvedProposals = 0;
  let appliedProposals = 0;

  for (const row of proposalsQuery.rows) {
    const c = parseInt(row.count, 10) || 0;
    totalProposals += c;
    if (row.status === "approved") approvedProposals += c;
    if (row.status === "applied_locally" || row.status === "synced_remotely") {
      appliedProposals += c;
    }
  }

  // 4. Retest Comparison counts
  const comparisonsQuery = await pool.query<{
    failure_resolved: boolean;
    count: string;
  }>(
    `SELECT failure_resolved, COUNT(*)::text as count
     FROM retest_comparisons
     WHERE project_id = $1 ${ownerParam}
     GROUP BY failure_resolved`,
    params,
  );

  let retestsCount = 0;
  let resolvedRetestsCount = 0;

  for (const row of comparisonsQuery.rows) {
    const c = parseInt(row.count, 10) || 0;
    retestsCount += c;
    if (row.failure_resolved) resolvedRetestsCount += c;
  }

  const retestResolutionRatePercentage =
    retestsCount > 0
      ? Math.round((resolvedRetestsCount / retestsCount) * 100)
      : null;

  // Unresolved findings count = findings that don't have a resolved comparison
  const unresolvedFindings = Math.max(0, totalFindings - resolvedRetestsCount);

  // 5. Currently Deployed Agents Count
  const deployedAgentsQuery = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT agent_id)::text as count
     FROM agent_deployments
     WHERE project_id = $1 AND status = 'deployed' ${ownerParam}`,
    params,
  );
  const deployedAgentsCount = parseInt(deployedAgentsQuery.rows[0]?.count || "0", 10);

  return {
    totalRuns,
    completedEvaluations,
    passedEvaluations,
    failedEvaluations,
    infrastructureErrors,
    inconclusiveRuns,
    passingRatePercentage,
    totalFindings,
    unresolvedFindings,
    totalProposals,
    approvedProposals,
    appliedProposals,
    retestsCount,
    resolvedRetestsCount,
    retestResolutionRatePercentage,
    deployedAgentsCount,
    categoryDistribution,
  };
}

export interface ExecutionHistoryFilters {
  agentId?: string;
  status?: string;
  scenarioId?: string;
  personaId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getExecutionHistory(
  projectId: string,
  filters: ExecutionHistoryFilters = {},
  ctx?: ObservabilityContext,
) {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const params: unknown[] = [projectId];
  const conditions: string[] = ["r.project_id = $1"];

  if (ownerId !== null) {
    params.push(ownerId);
    conditions.push(`r.owner_id = $${params.length}`);
  } else {
    conditions.push("r.owner_id IS NULL");
  }

  if (filters.agentId) {
    params.push(filters.agentId);
    conditions.push(`r.target_agent_id = $${params.length}`);
  }

  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (filters.scenarioId) {
    params.push(filters.scenarioId);
    conditions.push(`r.scenario_id = $${params.length}`);
  }

  if (filters.personaId) {
    params.push(filters.personaId);
    conditions.push(`r.persona_id = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(r.scenario_name ILIKE $${params.length} OR r.persona_name ILIKE $${params.length})`);
  }

  const limit = Math.min(filters.limit || 50, 100);
  const offset = filters.offset || 0;

  params.push(limit);
  const limitClause = `LIMIT $${params.length}`;
  params.push(offset);
  const offsetClause = `OFFSET $${params.length}`;

  const query = `
    SELECT
      r.id,
      r.batch_id,
      r.project_id,
      r.target_agent_id,
      r.scenario_id,
      r.persona_id,
      r.scenario_name,
      r.persona_name,
      r.status,
      r.evaluation_result,
      r.evaluation_rationale,
      r.transcript,
      r.metrics,
      r.error_message,
      r.started_at,
      r.completed_at,
      r.created_at,
      a.name AS agent_name,
      c.id AS comparison_id,
      c.failure_resolved AS comparison_resolved
    FROM simulation_runs r
    LEFT JOIN agents a ON a.id = r.target_agent_id
    LEFT JOIN retest_comparisons c ON c.original_run_id = r.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY r.created_at DESC
    ${limitClause} ${offsetClause}
  `;

  const res = await pool.query(query, params);

  const runIds = res.rows.map((row) => row.id);
  const findingsMap = new Map<string, number>();
  const proposalsMap = new Map<string, number>();

  if (runIds.length > 0) {
    const [findingsRes, proposalsRes] = await Promise.all([
      pool.query<{ run_id: string; count: string }>(
        `SELECT run_id, COUNT(*)::text AS count FROM failure_findings WHERE run_id = ANY($1) GROUP BY run_id`,
        [runIds],
      ),
      pool.query<{ source_run_id: string; count: string }>(
        `SELECT source_run_id, COUNT(*)::text AS count FROM fix_proposals WHERE source_run_id = ANY($1) GROUP BY source_run_id`,
        [runIds],
      ),
    ]);

    for (const row of findingsRes.rows) {
      findingsMap.set(row.run_id, parseInt(row.count, 10));
    }
    for (const row of proposalsRes.rows) {
      proposalsMap.set(row.source_run_id, parseInt(row.count, 10));
    }
  }

  return res.rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    projectId: row.project_id,
    targetAgentId: row.target_agent_id,
    agentName: row.agent_name || "Agent",
    scenarioId: row.scenario_id,
    personaId: row.persona_id,
    scenarioName: row.scenario_name,
    personaName: row.persona_name,
    status: row.status,
    evaluationResult: row.evaluation_result,
    evaluationRationale: row.evaluation_rationale,
    transcript: row.transcript || [],
    metrics: row.metrics || {},
    errorMessage: row.error_message,
    findingsCount: findingsMap.get(row.id) ?? 0,
    proposalsCount: proposalsMap.get(row.id) ?? 0,
    comparison: row.comparison_id
      ? {
          id: row.comparison_id,
          failureResolved: Boolean(row.comparison_resolved),
        }
      : null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
