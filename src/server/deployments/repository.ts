import type { Db } from "../db/pool";
import type {
  DeploymentEnvironment,
  DeploymentRecord,
  DeploymentStatus,
  ReleaseReadinessSnapshot,
} from "./schema";

interface DeploymentRow {
  id: string;
  project_id: string;
  owner_id: string | null;
  agent_id: string;
  agent_name?: string;
  agent_version: number;
  environment: string;
  status: string;
  remote_agent_id: string | null;
  readiness_snapshot: ReleaseReadinessSnapshot;
  notes: string | null;
  previous_deployment_id: string | null;
  deployed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toDeployment(row: DeploymentRow): DeploymentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentVersion: row.agent_version,
    environment: row.environment as DeploymentEnvironment,
    status: row.status as DeploymentStatus,
    remoteAgentId: row.remote_agent_id,
    readinessSnapshot: row.readiness_snapshot,
    notes: row.notes,
    previousDeploymentId: row.previous_deployment_id,
    deployedAt: row.deployed_at ? row.deployed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function insertDeployment(
  db: Db,
  ownerId: string | null,
  data: {
    projectId: string;
    agentId: string;
    agentVersion: number;
    environment: DeploymentEnvironment;
    status: DeploymentStatus;
    remoteAgentId: string | null;
    readinessSnapshot: ReleaseReadinessSnapshot;
    notes?: string | null;
    previousDeploymentId?: string | null;
    deployedAt?: Date | null;
  },
): Promise<DeploymentRecord> {
  const res = await db.query<DeploymentRow>(
    `INSERT INTO agent_deployments (
      project_id, owner_id, agent_id, agent_version, environment, status,
      remote_agent_id, readiness_snapshot, notes, previous_deployment_id, deployed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      data.projectId,
      ownerId,
      data.agentId,
      data.agentVersion,
      data.environment,
      data.status,
      data.remoteAgentId,
      JSON.stringify(data.readinessSnapshot),
      data.notes ?? null,
      data.previousDeploymentId ?? null,
      data.deployedAt ?? null,
    ],
  );

  return toDeployment(res.rows[0]!);
}

export async function findDeploymentById(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<DeploymentRecord | null> {
  const params: unknown[] = [id];
  let ownerClause = "d.owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = "d.owner_id = $2";
  }

  const res = await db.query<DeploymentRow>(
    `SELECT d.*, a.name AS agent_name
     FROM agent_deployments d
     LEFT JOIN agents a ON a.id = d.agent_id
     WHERE d.id = $1 AND ${ownerClause}`,
    params,
  );

  if (res.rows.length === 0) return null;
  return toDeployment(res.rows[0]!);
}

export async function findDeploymentsByProjectId(
  db: Db,
  ownerId: string | null,
  projectId: string,
  environment?: DeploymentEnvironment,
): Promise<DeploymentRecord[]> {
  const params: unknown[] = [projectId];
  let ownerClause = "d.owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `d.owner_id = $${params.length}`;
  }

  let envClause = "";
  if (environment) {
    params.push(environment);
    envClause = `AND d.environment = $${params.length}`;
  }

  const res = await db.query<DeploymentRow>(
    `SELECT d.*, a.name AS agent_name
     FROM agent_deployments d
     LEFT JOIN agents a ON a.id = d.agent_id
     WHERE d.project_id = $1 AND ${ownerClause} ${envClause}
     ORDER BY d.created_at DESC`,
    params,
  );

  return res.rows.map(toDeployment);
}

export async function findDeploymentsByAgentId(
  db: Db,
  ownerId: string | null,
  agentId: string,
): Promise<DeploymentRecord[]> {
  const params: unknown[] = [agentId];
  let ownerClause = "d.owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = "d.owner_id = $2";
  }

  const res = await db.query<DeploymentRow>(
    `SELECT d.*, a.name AS agent_name
     FROM agent_deployments d
     LEFT JOIN agents a ON a.id = d.agent_id
     WHERE d.agent_id = $1 AND ${ownerClause}
     ORDER BY d.created_at DESC`,
    params,
  );

  return res.rows.map(toDeployment);
}

export async function findActiveDeployment(
  db: Db,
  ownerId: string | null,
  agentId: string,
  environment: DeploymentEnvironment = "production",
): Promise<DeploymentRecord | null> {
  const params: unknown[] = [agentId, environment];
  let ownerClause = "d.owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = "d.owner_id = $3";
  }

  const res = await db.query<DeploymentRow>(
    `SELECT d.*, a.name AS agent_name
     FROM agent_deployments d
     LEFT JOIN agents a ON a.id = d.agent_id
     WHERE d.agent_id = $1 AND d.environment = $2 AND d.status = 'deployed' AND ${ownerClause}
     ORDER BY d.deployed_at DESC, d.created_at DESC
     LIMIT 1`,
    params,
  );

  if (res.rows.length === 0) return null;
  return toDeployment(res.rows[0]!);
}

export async function updateDeploymentStatus(
  db: Db,
  ownerId: string | null,
  id: string,
  patch: {
    status: DeploymentStatus;
    deployedAt?: Date | null;
    notes?: string | null;
    readinessSnapshot?: ReleaseReadinessSnapshot;
  },
): Promise<DeploymentRecord> {
  const params: unknown[] = [id, patch.status];
  const sets: string[] = ["status = $2", "updated_at = now()"];

  if (patch.deployedAt !== undefined) {
    params.push(patch.deployedAt);
    sets.push(`deployed_at = $${params.length}`);
  }

  if (patch.notes !== undefined) {
    params.push(patch.notes);
    sets.push(`notes = $${params.length}`);
  }

  if (patch.readinessSnapshot !== undefined) {
    params.push(JSON.stringify(patch.readinessSnapshot));
    sets.push(`readiness_snapshot = $${params.length}`);
  }

  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $${params.length}`;
  }

  const res = await db.query<DeploymentRow>(
    `UPDATE agent_deployments
     SET ${sets.join(", ")}
     WHERE id = $1 AND ${ownerClause}
     RETURNING *`,
    params,
  );

  if (res.rows.length === 0) {
    throw new Error("Deployment not found or unauthorized.");
  }

  return toDeployment(res.rows[0]!);
}

export async function archivePreviousActiveDeployments(
  db: Db,
  ownerId: string | null,
  agentId: string,
  environment: DeploymentEnvironment,
  excludeDeploymentId: string,
): Promise<void> {
  const params: unknown[] = [agentId, environment, excludeDeploymentId];
  let ownerClause = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    ownerClause = `owner_id = $4`;
  }

  await db.query(
    `UPDATE agent_deployments
     SET status = 'archived', updated_at = now()
     WHERE agent_id = $1 AND environment = $2 AND status = 'deployed' AND id != $3 AND ${ownerClause}`,
    params,
  );
}
