import type { Db } from "../db/pool";
import type {
  BatchStatus,
  EvaluationResult,
  RemoteTestDefinitionRecord,
  RunStatus,
  SimulationBatchRecord,
  SimulationMetrics,
  SimulationRunRecord,
  TranscriptMessage,
} from "./schema";
import type { PersonaConfig, ScenarioConfig } from "../personas/schema";

interface BatchRow {
  id: string;
  project_id: string;
  owner_id: string | null;
  target_agent_id: string;
  remote_agent_id: string;
  name: string;
  status: string;
  total_scenarios: number;
  completed_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  errored_scenarios: number;
  remote_invocation_id: string | null;
  execution_options: Record<string, unknown>;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RunRow {
  id: string;
  batch_id: string;
  project_id: string;
  owner_id: string | null;
  target_agent_id: string;
  scenario_id: string | null;
  persona_id: string | null;
  scenario_name: string;
  persona_name: string;
  scenario_snapshot: ScenarioConfig;
  persona_snapshot: PersonaConfig;
  remote_test_id: string | null;
  remote_test_run_id: string | null;
  remote_invocation_id: string | null;
  status: string;
  evaluation_result: string | null;
  evaluation_rationale: string | null;
  transcript: TranscriptMessage[];
  raw_result: Record<string, unknown> | null;
  metrics: SimulationMetrics;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toBatch = (r: BatchRow): SimulationBatchRecord => ({
  id: r.id,
  projectId: r.project_id,
  ownerId: r.owner_id,
  targetAgentId: r.target_agent_id,
  remoteAgentId: r.remote_agent_id,
  name: r.name,
  status: r.status as BatchStatus,
  totalScenarios: Number(r.total_scenarios),
  completedScenarios: Number(r.completed_scenarios),
  passedScenarios: Number(r.passed_scenarios),
  failedScenarios: Number(r.failed_scenarios),
  erroredScenarios: Number(r.errored_scenarios),
  remoteInvocationId: r.remote_invocation_id,
  executionOptions: r.execution_options || {},
  errorMessage: r.error_message,
  startedAt: r.started_at ? r.started_at.toISOString() : null,
  completedAt: r.completed_at ? r.completed_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

const toRun = (r: RunRow): SimulationRunRecord => ({
  id: r.id,
  batchId: r.batch_id,
  projectId: r.project_id,
  ownerId: r.owner_id,
  targetAgentId: r.target_agent_id,
  scenarioId: r.scenario_id,
  personaId: r.persona_id,
  scenarioName: r.scenario_name,
  personaName: r.persona_name,
  scenarioSnapshot: r.scenario_snapshot,
  personaSnapshot: r.persona_snapshot,
  remoteTestId: r.remote_test_id,
  remoteTestRunId: r.remote_test_run_id,
  remoteInvocationId: r.remote_invocation_id,
  status: r.status as RunStatus,
  evaluationResult: r.evaluation_result as EvaluationResult | null,
  evaluationRationale: r.evaluation_rationale,
  transcript: r.transcript || [],
  rawResult: r.raw_result,
  metrics: r.metrics || {},
  errorMessage: r.error_message,
  startedAt: r.started_at ? r.started_at.toISOString() : null,
  completedAt: r.completed_at ? r.completed_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

function ownerClause(ownerId: string | null, params: unknown[]): string {
  if (ownerId === null) return "owner_id IS NULL";
  params.push(ownerId);
  return `owner_id = $${params.length}`;
}

export async function insertBatch(
  db: Db,
  ownerId: string | null,
  data: {
    projectId: string;
    targetAgentId: string;
    remoteAgentId: string;
    name: string;
    totalScenarios: number;
    executionOptions?: Record<string, unknown>;
  },
): Promise<SimulationBatchRecord> {
  const params: unknown[] = [
    data.projectId,
    ownerId,
    data.targetAgentId,
    data.remoteAgentId,
    data.name,
    data.totalScenarios,
    JSON.stringify(data.executionOptions || {}),
  ];

  const res = await db.query<BatchRow>(
    `INSERT INTO simulation_batches (
      project_id, owner_id, target_agent_id, remote_agent_id, name,
      total_scenarios, execution_options, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
    RETURNING *`,
    params,
  );

  const row = res.rows[0];
  if (!row) throw new Error("Failed to insert simulation batch.");
  return toBatch(row);
}

export async function findBatch(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<SimulationBatchRecord | null> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<BatchRow>(
    `SELECT * FROM simulation_batches WHERE id = $1 AND ${owner}`,
    params,
  );
  const row = res.rows[0];
  return row ? toBatch(row) : null;
}

export async function listBatches(
  db: Db,
  ownerId: string | null,
  filter: {
    projectId?: string;
    targetAgentId?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<SimulationBatchRecord[]> {
  const params: unknown[] = [];
  const where: string[] = [ownerClause(ownerId, params)];

  if (filter.projectId) {
    params.push(filter.projectId);
    where.push(`project_id = $${params.length}`);
  }
  if (filter.targetAgentId) {
    params.push(filter.targetAgentId);
    where.push(`target_agent_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }

  const limit = filter.limit || 50;
  params.push(limit);

  const res = await db.query<BatchRow>(
    `SELECT * FROM simulation_batches
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return res.rows.map(toBatch);
}

export async function updateBatch(
  db: Db,
  ownerId: string | null,
  id: string,
  patch: {
    status?: BatchStatus;
    completedScenarios?: number;
    passedScenarios?: number;
    failedScenarios?: number;
    erroredScenarios?: number;
    remoteInvocationId?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<SimulationBatchRecord | null> {
  const params: unknown[] = [id];
  const sets: string[] = ["updated_at = now()"];

  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.completedScenarios !== undefined) {
    params.push(patch.completedScenarios);
    sets.push(`completed_scenarios = $${params.length}`);
  }
  if (patch.passedScenarios !== undefined) {
    params.push(patch.passedScenarios);
    sets.push(`passed_scenarios = $${params.length}`);
  }
  if (patch.failedScenarios !== undefined) {
    params.push(patch.failedScenarios);
    sets.push(`failed_scenarios = $${params.length}`);
  }
  if (patch.erroredScenarios !== undefined) {
    params.push(patch.erroredScenarios);
    sets.push(`errored_scenarios = $${params.length}`);
  }
  if (patch.remoteInvocationId !== undefined) {
    params.push(patch.remoteInvocationId);
    sets.push(`remote_invocation_id = $${params.length}`);
  }
  if (patch.errorMessage !== undefined) {
    params.push(patch.errorMessage);
    sets.push(`error_message = $${params.length}`);
  }
  if (patch.startedAt !== undefined) {
    params.push(patch.startedAt);
    sets.push(`started_at = $${params.length}`);
  }
  if (patch.completedAt !== undefined) {
    params.push(patch.completedAt);
    sets.push(`completed_at = $${params.length}`);
  }

  const owner = ownerClause(ownerId, params);
  const res = await db.query<BatchRow>(
    `UPDATE simulation_batches
     SET ${sets.join(", ")}
     WHERE id = $1 AND ${owner}
     RETURNING *`,
    params,
  );

  const row = res.rows[0];
  return row ? toBatch(row) : null;
}

export async function insertRun(
  db: Db,
  ownerId: string | null,
  data: {
    batchId: string;
    projectId: string;
    targetAgentId: string;
    scenarioId: string;
    personaId: string;
    scenarioName: string;
    personaName: string;
    scenarioSnapshot: ScenarioConfig;
    personaSnapshot: PersonaConfig;
    remoteTestId?: string | null;
  },
): Promise<SimulationRunRecord> {
  const params: unknown[] = [
    data.batchId,
    data.projectId,
    ownerId,
    data.targetAgentId,
    data.scenarioId,
    data.personaId,
    data.scenarioName,
    data.personaName,
    JSON.stringify(data.scenarioSnapshot),
    JSON.stringify(data.personaSnapshot),
    data.remoteTestId ?? null,
  ];

  const res = await db.query<RunRow>(
    `INSERT INTO simulation_runs (
      batch_id, project_id, owner_id, target_agent_id,
      scenario_id, persona_id, scenario_name, persona_name,
      scenario_snapshot, persona_snapshot, remote_test_id,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
    RETURNING *`,
    params,
  );

  const row = res.rows[0];
  if (!row) throw new Error("Failed to insert simulation run.");
  return toRun(row);
}

export async function findRun(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<SimulationRunRecord | null> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<RunRow>(
    `SELECT * FROM simulation_runs WHERE id = $1 AND ${owner}`,
    params,
  );
  const row = res.rows[0];
  return row ? toRun(row) : null;
}

export async function listRunsForBatch(
  db: Db,
  ownerId: string | null,
  batchId: string,
): Promise<SimulationRunRecord[]> {
  const params: unknown[] = [batchId];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<RunRow>(
    `SELECT * FROM simulation_runs
     WHERE batch_id = $1 AND ${owner}
     ORDER BY created_at ASC`,
    params,
  );
  return res.rows.map(toRun);
}

export async function updateRun(
  db: Db,
  ownerId: string | null,
  id: string,
  patch: {
    status?: RunStatus;
    evaluationResult?: EvaluationResult | null;
    evaluationRationale?: string | null;
    transcript?: TranscriptMessage[];
    rawResult?: Record<string, unknown> | null;
    metrics?: SimulationMetrics;
    errorMessage?: string | null;
    remoteTestId?: string | null;
    remoteTestRunId?: string | null;
    remoteInvocationId?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<SimulationRunRecord | null> {
  const params: unknown[] = [id];
  const sets: string[] = ["updated_at = now()"];

  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.evaluationResult !== undefined) {
    params.push(patch.evaluationResult);
    sets.push(`evaluation_result = $${params.length}`);
  }
  if (patch.evaluationRationale !== undefined) {
    params.push(patch.evaluationRationale);
    sets.push(`evaluation_rationale = $${params.length}`);
  }
  if (patch.transcript !== undefined) {
    params.push(JSON.stringify(patch.transcript));
    sets.push(`transcript = $${params.length}`);
  }
  if (patch.rawResult !== undefined) {
    params.push(JSON.stringify(patch.rawResult));
    sets.push(`raw_result = $${params.length}`);
  }
  if (patch.metrics !== undefined) {
    params.push(JSON.stringify(patch.metrics));
    sets.push(`metrics = $${params.length}`);
  }
  if (patch.errorMessage !== undefined) {
    params.push(patch.errorMessage);
    sets.push(`error_message = $${params.length}`);
  }
  if (patch.remoteTestId !== undefined) {
    params.push(patch.remoteTestId);
    sets.push(`remote_test_id = $${params.length}`);
  }
  if (patch.remoteTestRunId !== undefined) {
    params.push(patch.remoteTestRunId);
    sets.push(`remote_test_run_id = $${params.length}`);
  }
  if (patch.remoteInvocationId !== undefined) {
    params.push(patch.remoteInvocationId);
    sets.push(`remote_invocation_id = $${params.length}`);
  }
  if (patch.startedAt !== undefined) {
    params.push(patch.startedAt);
    sets.push(`started_at = $${params.length}`);
  }
  if (patch.completedAt !== undefined) {
    params.push(patch.completedAt);
    sets.push(`completed_at = $${params.length}`);
  }

  const owner = ownerClause(ownerId, params);
  const res = await db.query<RunRow>(
    `UPDATE simulation_runs
     SET ${sets.join(", ")}
     WHERE id = $1 AND ${owner}
     RETURNING *`,
    params,
  );

  const row = res.rows[0];
  return row ? toRun(row) : null;
}

export async function findRemoteTestDefinition(
  db: Db,
  scenarioId: string,
  personaId: string,
  configHash: string,
): Promise<RemoteTestDefinitionRecord | null> {
  const res = await db.query<{
    id: string;
    project_id: string;
    scenario_id: string;
    persona_id: string;
    config_hash: string;
    remote_test_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT * FROM remote_test_definitions
     WHERE scenario_id = $1 AND persona_id = $2 AND config_hash = $3`,
    [scenarioId, personaId, configHash],
  );

  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    scenarioId: row.scenario_id,
    personaId: row.persona_id,
    configHash: row.config_hash,
    remoteTestId: row.remote_test_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function insertRemoteTestDefinition(
  db: Db,
  data: {
    projectId: string;
    scenarioId: string;
    personaId: string;
    configHash: string;
    remoteTestId: string;
  },
): Promise<RemoteTestDefinitionRecord> {
  const res = await db.query<{
    id: string;
    project_id: string;
    scenario_id: string;
    persona_id: string;
    config_hash: string;
    remote_test_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO remote_test_definitions (
      project_id, scenario_id, persona_id, config_hash, remote_test_id
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (scenario_id, persona_id, config_hash)
    DO UPDATE SET remote_test_id = EXCLUDED.remote_test_id, updated_at = now()
    RETURNING *`,
    [data.projectId, data.scenarioId, data.personaId, data.configHash, data.remoteTestId],
  );

  const row = res.rows[0];
  if (!row) throw new Error("Failed to insert remote test definition.");
  return {
    id: row.id,
    projectId: row.project_id,
    scenarioId: row.scenario_id,
    personaId: row.persona_id,
    configHash: row.config_hash,
    remoteTestId: row.remote_test_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
