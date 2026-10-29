import type { Db } from "../db/pool";
import type { AgentConfig } from "./config-schema";

export type AgentStatus = "active" | "remote_missing" | "remote_deleted" | "archived";
export type OperationStatus = "pending" | "remote_created" | "completed" | "failed" | "unknown" | "dismissed";

export interface Agent {
  id: string; projectId: string; projectName?: string; name: string; description: string | null; useCase: string | null;
  creationPrompt: string | null; config: AgentConfig; configVersion: number; syncedVersion: number | null; voiceId: string | null;
  primaryLanguage: string; remoteAgentId: string; status: AgentStatus; remoteCheckedAt: string | null; remoteStatusNote: string | null;
  createdAt: string; updatedAt: string;
}
export interface AgentVersion {
  id: string; version: number; config: AgentConfig; summary: string; source: "created" | "manual_edit" | "refinement" | "fix_proposal" | "rollback";
  syncStatus: "not_synced" | "synced" | "failed"; syncedAt: string | null; syncError: string | null; createdAt: string;
}
export interface AgentOperation {
  id: string; projectId: string; idempotencyKey: string; status: OperationStatus; config: AgentConfig; creationPrompt: string | null;
  useCase: string | null; remoteAgentId: string | null; agentId: string | null; errorCode: string | null; errorMessage: string | null; createdAt: string; updatedAt: string;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const json = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

const AGENT_COLS = "a.id, a.project_id, p.name AS project_name, a.name, a.description, a.use_case, a.creation_prompt, a.config, a.config_version, a.synced_version, a.voice_id, a.primary_language, a.remote_agent_id, a.status, a.remote_checked_at, a.remote_status_note, a.created_at, a.updated_at";
const AGENT_FROM = "FROM agents a JOIN projects p ON p.id = a.project_id";

function toAgent(r: Row): Agent {
  return {
    id: r.id as string, projectId: r.project_id as string, projectName: r.project_name as string, name: r.name as string,
    description: (r.description as string) ?? null, useCase: (r.use_case as string) ?? null, creationPrompt: (r.creation_prompt as string) ?? null,
    config: json(r.config) as AgentConfig, configVersion: Number(r.config_version), syncedVersion: r.synced_version == null ? null : Number(r.synced_version),
    voiceId: (r.voice_id as string) ?? null, primaryLanguage: r.primary_language as string, remoteAgentId: r.remote_agent_id as string,
    status: r.status as AgentStatus, remoteCheckedAt: iso(r.remote_checked_at), remoteStatusNote: (r.remote_status_note as string) ?? null,
    createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
  };
}
function toVersion(r: Row): AgentVersion {
  return { id: r.id as string, version: Number(r.version), config: json(r.config) as AgentConfig, summary: r.summary as string, source: r.source as AgentVersion["source"], syncStatus: r.sync_status as AgentVersion["syncStatus"], syncedAt: iso(r.synced_at), syncError: (r.sync_error as string) ?? null, createdAt: iso(r.created_at)! };
}
function toOp(r: Row): AgentOperation {
  return { id: r.id as string, projectId: r.project_id as string, idempotencyKey: r.idempotency_key as string, status: r.status as OperationStatus, config: json(r.config) as AgentConfig, creationPrompt: (r.creation_prompt as string) ?? null, useCase: (r.use_case as string) ?? null, remoteAgentId: (r.remote_agent_id as string) ?? null, agentId: (r.agent_id as string) ?? null, errorCode: (r.error_code as string) ?? null, errorMessage: (r.error_message as string) ?? null, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! };
}

const owner = (ownerId: string | null, params: unknown[], col = "a.owner_id") => {
  if (ownerId === null) return `${col} IS NULL`;
  params.push(ownerId);
  return `${col} = $${params.length}`;
};

export async function insertAgent(db: Db, ownerId: string | null, a: { projectId: string; config: AgentConfig; useCase: string | null; creationPrompt: string | null; remoteAgentId: string }): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO agents (project_id, owner_id, name, description, use_case, creation_prompt, config, voice_id, primary_language, remote_agent_id, synced_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,1) RETURNING id`,
    [a.projectId, ownerId, a.config.identity.name, a.config.identity.description || null, a.useCase, a.creationPrompt, JSON.stringify(a.config), a.config.voice.voiceId ?? null, a.config.language.primary, a.remoteAgentId],
  );
  return res.rows[0]!.id;
}

export async function insertVersion(db: Db, v: { agentId: string; version: number; config: AgentConfig; summary: string; source: AgentVersion["source"]; syncStatus?: AgentVersion["syncStatus"] }) {
  await db.query(
    `INSERT INTO agent_versions (agent_id, version, config, summary, source, sync_status, synced_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)`,
    [v.agentId, v.version, JSON.stringify(v.config), v.summary, v.source, v.syncStatus ?? "not_synced", v.syncStatus === "synced" ? new Date() : null],
  );
}

export async function findAgent(db: Db, ownerId: string | null, id: string): Promise<Agent | null> {
  const params: unknown[] = [id];
  const res = await db.query(`SELECT ${AGENT_COLS} ${AGENT_FROM} WHERE a.id = $1 AND ${owner(ownerId, params)}`, params);
  return res.rows[0] ? toAgent(res.rows[0] as Row) : null;
}

export async function selectAgents(db: Db, ownerId: string | null, f: { projectId?: string; status?: string }): Promise<Agent[]> {
  const params: unknown[] = [];
  const where = [owner(ownerId, params)];
  if (f.projectId) { params.push(f.projectId); where.push(`a.project_id = $${params.length}`); }
  if (f.status === "archived") where.push("a.status IN ('archived', 'remote_deleted')");
  else if (f.status !== "all") where.push("a.status IN ('active', 'remote_missing')");
  const res = await db.query(`SELECT ${AGENT_COLS} ${AGENT_FROM} WHERE ${where.join(" AND ")} ORDER BY a.updated_at DESC, a.id`, params);
  return res.rows.map((r) => toAgent(r as Row));
}

export async function selectVersions(db: Db, agentId: string): Promise<AgentVersion[]> {
  const res = await db.query("SELECT id, version, config, summary, source, sync_status, synced_at, sync_error, created_at FROM agent_versions WHERE agent_id = $1 ORDER BY version DESC", [agentId]);
  return res.rows.map((r) => toVersion(r as Row));
}

/** Optimistic update: succeeds only if the stored version still equals baseVersion. */
export async function bumpConfig(db: Db, ownerId: string | null, id: string, baseVersion: number, config: AgentConfig): Promise<boolean> {
  const params: unknown[] = [id, baseVersion, config.identity.name, config.identity.description || null, JSON.stringify(config), config.voice.voiceId ?? null, config.language.primary];
  const res = await db.query(
    `UPDATE agents SET name=$3, description=$4, config=$5::jsonb, voice_id=$6, primary_language=$7, config_version = config_version + 1, updated_at = now()
     WHERE id = $1 AND config_version = $2 AND ${owner(ownerId, params, "owner_id")}`,
    params,
  );
  return (res.rowCount ?? 0) === 1;
}

export async function markSynced(db: Db, id: string, version: number) {
  await db.query("UPDATE agents SET synced_version = $2, status = 'active', remote_status_note = NULL, updated_at = now() WHERE id = $1", [id, version]);
  await db.query("UPDATE agent_versions SET sync_status = 'synced', synced_at = now(), sync_error = NULL WHERE agent_id = $1 AND version = $2", [id, version]);
}
export async function markSyncFailed(db: Db, id: string, version: number, error: string) {
  await db.query("UPDATE agent_versions SET sync_status = 'failed', sync_error = $3 WHERE agent_id = $1 AND version = $2", [id, version, error.slice(0, 500)]);
}
export async function setAgentStatus(db: Db, id: string, status: AgentStatus, note: string | null) {
  await db.query("UPDATE agents SET status = $2, remote_status_note = $3, updated_at = now() WHERE id = $1", [id, status, note]);
}
export async function setRemoteChecked(db: Db, id: string, status: AgentStatus, note: string | null) {
  await db.query("UPDATE agents SET status = $2, remote_status_note = $3, remote_checked_at = now(), updated_at = now() WHERE id = $1", [id, status, note]);
}

export async function insertOperation(db: Db, ownerId: string | null, o: { projectId: string; key: string; config: AgentConfig; creationPrompt: string | null; useCase: string | null }): Promise<AgentOperation> {
  const res = await db.query(
    `INSERT INTO agent_operations (project_id, owner_id, idempotency_key, status, config, creation_prompt, use_case) VALUES ($1,$2,$3,'pending',$4::jsonb,$5,$6) RETURNING *`,
    [o.projectId, ownerId, o.key, JSON.stringify(o.config), o.creationPrompt, o.useCase],
  );
  return toOp(res.rows[0] as Row);
}
export async function findOperationByKey(db: Db, ownerId: string | null, key: string): Promise<AgentOperation | null> {
  const params: unknown[] = [key];
  const res = await db.query(`SELECT * FROM agent_operations a WHERE a.idempotency_key = $1 AND ${owner(ownerId, params)}`, params);
  return res.rows[0] ? toOp(res.rows[0] as Row) : null;
}
export async function findOperation(db: Db, ownerId: string | null, id: string): Promise<AgentOperation | null> {
  const params: unknown[] = [id];
  const res = await db.query(`SELECT * FROM agent_operations a WHERE a.id = $1 AND ${owner(ownerId, params)}`, params);
  return res.rows[0] ? toOp(res.rows[0] as Row) : null;
}
export async function setOperation(db: Db, id: string, p: { status: OperationStatus; remoteAgentId?: string; agentId?: string; errorCode?: string | null; errorMessage?: string | null }) {
  await db.query(
    `UPDATE agent_operations SET status=$2, remote_agent_id = COALESCE($3, remote_agent_id), agent_id = COALESCE($4, agent_id), error_code=$5, error_message=$6, updated_at = now() WHERE id=$1`,
    [id, p.status, p.remoteAgentId ?? null, p.agentId ?? null, p.errorCode ?? null, p.errorMessage?.slice(0, 500) ?? null],
  );
}
export async function selectOpenOperations(db: Db, ownerId: string | null): Promise<AgentOperation[]> {
  const params: unknown[] = [];
  const res = await db.query(`SELECT * FROM agent_operations a WHERE ${owner(ownerId, params)} AND a.status IN ('pending','remote_created','unknown') ORDER BY a.created_at DESC`, params);
  return res.rows.map((r) => toOp(r as Row));
}
