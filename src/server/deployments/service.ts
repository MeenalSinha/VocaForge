import type { Pool } from "pg";
import { getPool } from "../db/pool";
import { recordActivity } from "../activity/repository";
import { findAgent, selectVersions } from "../agents/repository";
import { saveAgentConfig, syncAgent, type AgentContext } from "../agents/service";
import { agentConfigSchema } from "../agents/config-schema";
import { findFindingsByAgentId } from "../analysis/repository";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import { evaluateReleaseReadiness } from "./readiness";
import * as repo from "./repository";
import type {
  CreateDeploymentInput,
  DeploymentEnvironment,
  DeploymentRecord,
  ReleaseReadinessSnapshot,
} from "./schema";
import type { SimulationRunRecord } from "../simulations/schema";

export interface DeploymentContext {
  store?: Pool;
  ownerId?: string | null;
  agentRemote?: NonNullable<AgentContext["remote"]>;
}

const poolOf = (c?: DeploymentContext) => c?.store ?? getPool();
const ownerOf = (c?: DeploymentContext) => c?.ownerId ?? null;

/**
 * Helper to query simulation runs executed against a specific agent.
 */
async function getRunsForAgent(
  db: Pool,
  ownerId: string | null,
  agentId: string,
): Promise<SimulationRunRecord[]> {
  const params: unknown[] = [agentId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = "owner_id = $2";
  }

  const res = await db.query(
    `SELECT * FROM simulation_runs
     WHERE target_agent_id = $1 AND ${ownerClause}
     ORDER BY created_at DESC`,
    params,
  );

  return res.rows.map((r) => ({
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
    status: r.status,
    evaluationResult: r.evaluation_result,
    evaluationRationale: r.evaluation_rationale,
    transcript: r.transcript || [],
    rawResult: r.raw_result,
    metrics: r.metrics || {},
    errorMessage: r.error_message,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

/**
 * Evaluates the full release readiness checklist for an agent.
 */
export async function checkAgentReleaseReadiness(
  agentId: string,
  ctx?: DeploymentContext,
): Promise<{
  agent: Awaited<ReturnType<typeof findAgent>>;
  readiness: ReleaseReadinessSnapshot;
  activeDeployment: DeploymentRecord | null;
  runs: SimulationRunRecord[];
}> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const agent = await findAgent(pool, ownerId, agentId);
  if (!agent) throw new NotFoundError("Voice agent not found.");

  const [versions, runs, findings, activeDeployment] = await Promise.all([
    selectVersions(pool, agent.id),
    getRunsForAgent(pool, ownerId, agent.id),
    findFindingsByAgentId(pool, ownerId, agent.id),
    repo.findActiveDeployment(pool, ownerId, agent.id, "production"),
  ]);

  const activeVersionRecord = versions.find((v: { version: number }) => v.version === agent.configVersion) || null;
  const readiness = evaluateReleaseReadiness(agent, activeVersionRecord, runs, findings);

  return {
    agent,
    readiness,
    activeDeployment,
    runs,
  };
}

/**
 * Creates a new release deployment candidate.
 */
export async function createDeployment(
  input: CreateDeploymentInput,
  ctx?: DeploymentContext,
): Promise<DeploymentRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const agent = await findAgent(pool, ownerId, input.agentId);
  if (!agent) throw new NotFoundError("Voice agent not found.");

  const [versions, runs, findings, previousActive] = await Promise.all([
    selectVersions(pool, agent.id),
    getRunsForAgent(pool, ownerId, agent.id),
    findFindingsByAgentId(pool, ownerId, agent.id),
    repo.findActiveDeployment(pool, ownerId, agent.id, input.environment),
  ]);

  const targetVersionRecord = versions.find((v: { version: number }) => v.version === input.agentVersion);
  if (!targetVersionRecord) {
    throw new ValidationError(`Configuration version ${input.agentVersion} does not exist for this agent.`);
  }

  const readiness = evaluateReleaseReadiness(agent, targetVersionRecord, runs, findings);
  const initialStatus = readiness.isReady ? "ready_for_release" : "draft";

  const deployment = await repo.insertDeployment(pool, ownerId, {
    projectId: input.projectId,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    environment: input.environment,
    status: initialStatus,
    remoteAgentId: agent.remoteAgentId,
    readinessSnapshot: readiness,
    notes: input.notes,
    previousDeploymentId: previousActive?.id ?? null,
  });

  await recordActivity(pool, ownerId, {
    projectId: input.projectId,
    type: "deployment.created",
    summary: `Created ${input.environment} deployment candidate for "${agent.name}" (v${input.agentVersion})`,
  });

  return deployment;
}

/**
 * Promotes and deploys a release candidate.
 */
export async function promoteDeployment(
  deploymentId: string,
  options?: { forceDeploy?: boolean; notes?: string },
  ctx?: DeploymentContext,
): Promise<DeploymentRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const deployment = await repo.findDeploymentById(pool, ownerId, deploymentId);
  if (!deployment) throw new NotFoundError("Deployment record not found.");

  if (deployment.status === "deployed") {
    return deployment;
  }

  const agent = await findAgent(pool, ownerId, deployment.agentId);
  if (!agent) throw new NotFoundError("Target voice agent not found.");

  // Check readiness unless forceDeploy is explicitly provided
  if (!deployment.readinessSnapshot.isReady && !options?.forceDeploy) {
    const firstBlocker = deployment.readinessSnapshot.blockers[0] || "Release criteria not satisfied.";
    throw new ConflictError(`Deployment blocked: ${firstBlocker}`);
  }

  // 1. Mark status as publishing
  await repo.updateDeploymentStatus(pool, ownerId, deployment.id, {
    status: "publishing",
    notes: options?.notes,
  });

  const agentCtx: AgentContext = {
    store: pool,
    ownerId,
    remote: ctx?.agentRemote,
  };

  // 2. Synchronize remote agent if not synced
  if (agent.remoteAgentId && agent.syncedVersion !== deployment.agentVersion) {
    try {
      await syncAgent(agent.id, agentCtx);
    } catch (err: unknown) {
      logger.error("Failed to synchronize agent during deployment promotion", {
        agentId: agent.id,
        error: (err as Error).message,
      });
      await repo.updateDeploymentStatus(pool, ownerId, deployment.id, {
        status: "failed",
        notes: `Remote synchronization failure: ${(err as Error).message}`,
      });
      await recordActivity(pool, ownerId, {
        projectId: deployment.projectId,
        type: "deployment.failed",
        summary: `Deployment promotion failed for "${agent.name}": ${(err as Error).message}`,
      });
      throw new ConflictError(`ElevenLabs synchronization failed: ${(err as Error).message}`);
    }
  }

  // 3. Mark as deployed & set deployedAt
  const deployed = await repo.updateDeploymentStatus(pool, ownerId, deployment.id, {
    status: "deployed",
    deployedAt: new Date(),
  });

  // 4. Archive previous active deployments in this environment
  await repo.archivePreviousActiveDeployments(
    pool,
    ownerId,
    deployment.agentId,
    deployment.environment,
    deployment.id,
  );

  await recordActivity(pool, ownerId, {
    projectId: deployment.projectId,
    type: "deployment.completed",
    summary: `Promoted "${agent.name}" (v${deployment.agentVersion}) to ${deployment.environment}`,
  });

  return deployed;
}

/**
 * Restores a previous configuration version safely (Rollback).
 */
export async function rollbackAgent(
  agentId: string,
  targetVersion: number,
  options?: { environment?: DeploymentEnvironment; reason?: string },
  ctx?: DeploymentContext,
): Promise<{
  agent: Awaited<ReturnType<typeof findAgent>>;
  newVersion: number;
  deployment: DeploymentRecord;
}> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const environment = options?.environment || "production";
  const reason = options?.reason || `Manual rollback to configuration version ${targetVersion}`;

  const agent = await findAgent(pool, ownerId, agentId);
  if (!agent) throw new NotFoundError("Voice agent not found.");
  if (agent.status === "archived" || agent.status === "remote_deleted") {
    throw new ConflictError("Archived agents cannot be rolled back.");
  }

  // Verify target version exists in historical versions
  const versions = await selectVersions(pool, agent.id);
  const targetVersionRecord = versions.find((v) => v.version === targetVersion);
  if (!targetVersionRecord) {
    throw new NotFoundError(`Version ${targetVersion} does not exist in agent configuration history.`);
  }

  // Verify target config validity
  const parseResult = agentConfigSchema.safeParse(targetVersionRecord.config);
  if (!parseResult.success) {
    throw new ValidationError("Historical configuration contains schema errors and cannot be safely restored.");
  }

  const agentCtx: AgentContext = {
    store: pool,
    ownerId,
    remote: ctx?.agentRemote,
  };

  // 1. Restore configuration as a new version with source 'rollback'
  const saveResult = await saveAgentConfig(
    agent.id,
    {
      config: targetVersionRecord.config,
      baseVersion: agent.configVersion,
      source: "rollback",
      summary: reason,
    },
    agentCtx,
  );

  const newVersion = saveResult.agent.configVersion;

  // 2. Synchronize with ElevenLabs if remote agent ID exists
  if (agent.remoteAgentId) {
    try {
      await syncAgent(agent.id, agentCtx);
    } catch (err: unknown) {
      logger.warn("Remote sync during rollback failed, marked as not synced", {
        agentId: agent.id,
        error: (err as Error).message,
      });
    }
  }

  // 3. Find active deployment to link previousDeploymentId
  const previousActive = await repo.findActiveDeployment(pool, ownerId, agent.id, environment);

  // 4. Create deployment record with status 'rolled_back'
  const runs = await getRunsForAgent(pool, ownerId, agent.id);
  const findings = await findFindingsByAgentId(pool, ownerId, agent.id);
  const readiness = evaluateReleaseReadiness(saveResult.agent, null, runs, findings);

  const deployment = await repo.insertDeployment(pool, ownerId, {
    projectId: agent.projectId,
    agentId: agent.id,
    agentVersion: newVersion,
    environment,
    status: "rolled_back",
    remoteAgentId: agent.remoteAgentId,
    readinessSnapshot: readiness,
    notes: `Rolled back from v${agent.configVersion} to historical v${targetVersion}. ${reason}`,
    previousDeploymentId: previousActive?.id ?? null,
    deployedAt: new Date(),
  });

  await recordActivity(pool, ownerId, {
    projectId: agent.projectId,
    type: "agent.rollback",
    summary: `Rolled back "${agent.name}" configuration to v${targetVersion} (restored as v${newVersion})`,
  });

  return {
    agent: saveResult.agent,
    newVersion,
    deployment,
  };
}

/**
 * Lists deployments for a project.
 */
export async function listDeployments(
  projectId: string,
  environment?: DeploymentEnvironment,
  ctx?: DeploymentContext,
): Promise<DeploymentRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repo.findDeploymentsByProjectId(pool, ownerId, projectId, environment);
}

/**
 * Gets a deployment record by ID.
 */
export async function getDeployment(
  id: string,
  ctx?: DeploymentContext,
): Promise<DeploymentRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const deployment = await repo.findDeploymentById(pool, ownerId, id);
  if (!deployment) throw new NotFoundError("Deployment record not found.");
  return deployment;
}
