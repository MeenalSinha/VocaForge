import { z } from "zod";
import { recordActivity } from "../activity/repository";
import { loadConfig } from "../config/env";
import { getPool, mapDbError, withTransaction, type Db, type TxRunner } from "../db/pool";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { ElevenLabsClient } from "../integrations/elevenlabs/client";
import { ElevenLabsError, isElevenLabsError } from "../integrations/elevenlabs/errors";
import { logger } from "../logger";
import { findProject } from "../projects/repository";
import { uuidSchema } from "../projects/schema";
import { agentConfigSchema, fieldErrorsOf } from "./config-schema";
import { diffConfig, sameConfig, summarize } from "./diff";
import { buildRemotePayload } from "./prompt";
import * as repo from "./repository";
import type { Agent, AgentOperation, AgentVersion } from "./repository";

type Remote = Pick<ElevenLabsClient, "createAgentFromPayload" | "getAgent" | "updateAgent" | "deleteAgent" | "getSignedUrl">;
export interface Store extends TxRunner { query: Db["query"] }
export interface AgentContext { store?: Store; ownerId?: string | null; remote?: Remote }

const ctx = (c?: AgentContext) => ({
  store: (c?.store ?? getPool()) as Store,
  ownerId: c?.ownerId ?? null,
  remote: c?.remote ?? defaultRemote(),
});

function defaultRemote(): Remote {
  const e = loadConfig().elevenlabs;
  return new ElevenLabsClient({ apiKey: e.apiKey, baseUrl: e.baseUrl, timeoutMs: 30000 });
}
const remoteOpts = () => { const e = loadConfig().elevenlabs; return { agentLlm: e.agentLlm, agentTtsModel: e.agentTtsModel }; };

const STATUS: Record<ElevenLabsError["kind"], number> = {
  missing_credentials: 503, auth_invalid: 502, permission_denied: 502, rate_limited: 429, network: 504, timeout: 504,
  validation: 422, unsupported: 502, malformed_response: 502, upstream: 502,
};
/** Convert an integration error into a safe application error. */
export function fromRemote(err: unknown, fallback = "The ElevenLabs request failed."): AppError {
  if (isElevenLabsError(err)) {
    const detail = err.details && err.kind !== "missing_credentials" ? ` ElevenLabs said: ${err.details}` : "";
    return new AppError(`elevenlabs_${err.kind}`, STATUS[err.kind], `${err.message}${detail}`);
  }
  logger.error("unexpected remote error", { message: (err as Error)?.message });
  return new AppError("elevenlabs_error", 502, fallback);
}

/** Failed = ElevenLabs definitely did not create anything. Unknown = the request may have been processed. */
export const outcomeOf = (err: unknown): "failed" | "unknown" =>
  isElevenLabsError(err) && ["missing_credentials", "auth_invalid", "permission_denied", "rate_limited", "validation", "unsupported"].includes(err.kind) ? "failed" : "unknown";

const idSchema = (id: string) => { if (!uuidSchema.safeParse(id).success) throw new NotFoundError("Agent not found."); return id; };

async function load(id: string, c: ReturnType<typeof ctx>): Promise<Agent> {
  idSchema(id);
  try {
    const a = await repo.findAgent(c.store, c.ownerId, id);
    if (!a) throw new NotFoundError("Agent not found.");
    return a;
  } catch (err) { return mapDbError(err); }
}

// ---------- creation ----------
const createInput = z.object({
  projectId: uuidSchema,
  config: agentConfigSchema,
  idempotencyKey: z.string().trim().min(8).max(80),
  creationPrompt: z.string().trim().max(20000).optional(),
  useCase: z.string().trim().max(40).optional(),
});

export interface CreateResult { agent: Agent; replayed: boolean }

async function persistCreated(op: AgentOperation, c: ReturnType<typeof ctx>): Promise<Agent> {
  if (!op.remoteAgentId) throw new AppError("invalid_operation", 500, "The operation has no remote agent id.");
  const remoteId = op.remoteAgentId;
  const agentId = await withTransaction(c.store, async (db) => {
    const id = await repo.insertAgent(db, c.ownerId, { projectId: op.projectId, config: op.config, useCase: op.useCase, creationPrompt: op.creationPrompt, remoteAgentId: remoteId });
    await repo.insertVersion(db, { agentId: id, version: 1, config: op.config, summary: "Created and sent to ElevenLabs", source: "created", syncStatus: "synced" });
    await repo.setOperation(db, op.id, { status: "completed", agentId: id });
    await recordActivity(db, c.ownerId, { projectId: op.projectId, type: "agent.created", summary: `Created agent "${op.config.identity.name}"` });
    return id;
  });
  return load(agentId, c);
}

export async function createAgent(input: unknown, context?: AgentContext): Promise<CreateResult> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", fieldErrorsOf(parsed.error));
  const data = parsed.data;
  const c = ctx(context);

  try {
    const project = await repo_project(c, data.projectId);
    if (!project) throw new NotFoundError("Project not found.");
    if (project.status !== "active") throw new ConflictError("Agents can only be created in an active project.");

    const existing = await repo.findOperationByKey(c.store, c.ownerId, data.idempotencyKey);
    if (existing) return replay(existing, c);

    let op: AgentOperation;
    try {
      op = await repo.insertOperation(c.store, c.ownerId, { projectId: data.projectId, key: data.idempotencyKey, config: data.config, creationPrompt: data.creationPrompt ?? null, useCase: data.useCase ?? null });
    } catch (err) {
      mapDbError(err); // unique violation -> Conflict: a concurrent request owns this key
      throw err;
    }

    let remoteId: string;
    try {
      const res = await c.remote.createAgentFromPayload(buildRemotePayload(data.config, remoteOpts()));
      remoteId = res.agentId;
    } catch (err) {
      const outcome = outcomeOf(err);
      const mapped = fromRemote(err);
      await repo.setOperation(c.store, op.id, { status: outcome, errorCode: mapped.code, errorMessage: mapped.message }).catch(() => undefined);
      logger.warn("agent creation failed", { outcome, code: mapped.code, operationId: op.id });
      if (outcome === "unknown") {
        throw new AppError("creation_outcome_unknown", 502, `${mapped.message} The request may or may not have created an agent in ElevenLabs. VocaForge did not retry. Check your ElevenLabs agent list before trying again.`);
      }
      throw mapped;
    }

    try {
      await repo.setOperation(c.store, op.id, { status: "remote_created", remoteAgentId: remoteId });
    } catch {
      logger.error("remote agent created but operation could not be recorded", { remoteAgentId: remoteId, operationId: op.id });
      throw new AppError("persistence_failed_after_remote_create", 500, `The agent was created in ElevenLabs (id ${remoteId}) but VocaForge could not record it. Do not create it again.`);
    }
    try {
      return { agent: await persistCreated({ ...op, remoteAgentId: remoteId }, c), replayed: false };
    } catch {
      logger.error("remote agent created but local save failed", { remoteAgentId: remoteId, operationId: op.id });
      throw new AppError("persistence_failed_after_remote_create", 500, `The agent was created in ElevenLabs (id ${remoteId}) but the local save failed. It is listed under "Needs attention" on the Agents page where you can reconcile it. Do not create it again.`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    return mapDbError(err);
  }
}

async function repo_project(c: ReturnType<typeof ctx>, id: string) { return findProject(c.store, c.ownerId, id); }

async function replay(op: AgentOperation, c: ReturnType<typeof ctx>): Promise<CreateResult> {
  if (op.status === "completed" && op.agentId) return { agent: await load(op.agentId, c), replayed: true };
  if (op.status === "remote_created") return { agent: await persistCreated(op, c), replayed: true };
  if (op.status === "pending") throw new ConflictError("This creation request is already in progress. Wait for it to finish.");
  if (op.status === "unknown") throw new ConflictError("An earlier attempt with this request may have created an agent. Check the Agents page under \"Needs attention\" before trying again.");
  throw new ConflictError(op.errorMessage ?? "The earlier attempt with this request failed. Submit again to start a new attempt.");
}

export async function reconcileOperation(id: string, context?: AgentContext): Promise<Agent> {
  const c = ctx(context);
  idSchema(id);
  try {
    const op = await repo.findOperation(c.store, c.ownerId, id);
    if (!op) throw new NotFoundError("Operation not found.");
    if (op.status !== "remote_created") throw new ConflictError("Only operations where ElevenLabs returned an agent id can be reconciled.");
    return await persistCreated(op, c);
  } catch (err) { if (err instanceof AppError) throw err; return mapDbError(err); }
}

export async function dismissOperation(id: string, context?: AgentContext): Promise<void> {
  const c = ctx(context);
  idSchema(id);
  try {
    const op = await repo.findOperation(c.store, c.ownerId, id);
    if (!op) throw new NotFoundError("Operation not found.");
    if (op.status === "remote_created" || op.status === "completed") throw new ConflictError("This operation holds a real remote agent and cannot be dismissed. Reconcile it instead.");
    await repo.setOperation(c.store, id, { status: "dismissed", errorCode: op.errorCode, errorMessage: op.errorMessage });
  } catch (err) { if (err instanceof AppError) throw err; mapDbError(err); }
}

export const listOpenOperations = async (context?: AgentContext) => { const c = ctx(context); try { return await repo.selectOpenOperations(c.store, c.ownerId); } catch (e) { return mapDbError(e); } };

// ---------- reads ----------
export async function listAgents(f: { projectId?: string; status?: string }, context?: AgentContext): Promise<Agent[]> {
  const c = ctx(context);
  if (f.projectId && !uuidSchema.safeParse(f.projectId).success) throw new ValidationError("Invalid project id.", { projectId: ["Invalid id."] });
  try { return await repo.selectAgents(c.store, c.ownerId, f); } catch (e) { return mapDbError(e); }
}

export async function getAgentDetail(id: string, context?: AgentContext): Promise<{ agent: Agent; versions: AgentVersion[] }> {
  const c = ctx(context);
  const agent = await load(id, c);
  try { return { agent, versions: await repo.selectVersions(c.store, agent.id) }; } catch (e) { return mapDbError(e); }
}

// ---------- editing and versions ----------
const saveInput = z.object({
  config: agentConfigSchema,
  baseVersion: z.number().int().min(1),
  source: z.enum(["manual_edit", "refinement"]).default("manual_edit"),
  summary: z.string().trim().max(300).optional(),
});

export async function saveAgentConfig(id: string, input: unknown, context?: AgentContext): Promise<{ agent: Agent; changed: boolean }> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", fieldErrorsOf(parsed.error));
  const c = ctx(context);
  const current = await load(id, c);
  if (current.status === "archived" || current.status === "remote_deleted") throw new ConflictError("This agent is archived and cannot be edited.");
  if (sameConfig(current.config, parsed.data.config)) return { agent: current, changed: false };

  const changes = diffConfig(current.config, parsed.data.config);
  const summary = parsed.data.summary || summarize(changes);
  return withTransaction(c.store, async (db) => {
    const ok = await repo.bumpConfig(db, c.ownerId, current.id, parsed.data.baseVersion, parsed.data.config);
    if (!ok) throw new ConflictError("This agent was changed elsewhere since you opened it. Reload to see the latest version.");
    await repo.insertVersion(db, { agentId: current.id, version: parsed.data.baseVersion + 1, config: parsed.data.config, summary, source: parsed.data.source });
    await recordActivity(db, c.ownerId, { projectId: current.projectId, type: "agent.updated", summary: `Saved version ${parsed.data.baseVersion + 1} of "${parsed.data.config.identity.name}"` });
    const agent = await repo.findAgent(db, c.ownerId, current.id);
    return { agent: agent!, changed: true };
  });
}

// ---------- remote synchronisation ----------
export async function syncAgent(id: string, context?: AgentContext): Promise<Agent> {
  const c = ctx(context);
  const agent = await load(id, c);
  if (agent.status === "archived" || agent.status === "remote_deleted") throw new ConflictError("This agent is archived.");
  const submitted = agent.configVersion;
  try {
    await c.remote.updateAgent(agent.remoteAgentId, buildRemotePayload(agent.config, remoteOpts()));
  } catch (err) {
    const mapped = fromRemote(err);
    try {
      await repo.markSyncFailed(c.store, agent.id, submitted, mapped.message);
      if (isElevenLabsError(err) && err.kind === "unsupported") await repo.setAgentStatus(c.store, agent.id, "remote_missing", "ElevenLabs could not find this agent.");
    } catch { logger.error("could not record sync failure", { agentId: agent.id }); }
    throw mapped;
  }
  try {
    await withTransaction(c.store, async (db) => {
      await repo.markSynced(db, agent.id, submitted);
      await recordActivity(db, c.ownerId, { projectId: agent.projectId, type: "agent.synced", summary: `Sent version ${submitted} of "${agent.name}" to ElevenLabs` });
    });
  } catch {
    throw new AppError("sync_recorded_failed", 500, "ElevenLabs accepted the update but VocaForge could not record it. Run a status refresh to confirm.");
  }
  return load(agent.id, c);
}

export interface RemoteStatus { found: boolean; matchesLocal: boolean | null; differences: string[] }

/** Reads the agent back from ElevenLabs and compares key fields with the local configuration. */
export async function refreshAgent(id: string, context?: AgentContext): Promise<{ agent: Agent; remote: RemoteStatus }> {
  const c = ctx(context);
  const agent = await load(id, c);
  try {
    const remote = await c.remote.getAgent(agent.remoteAgentId);
    const expected = buildRemotePayload(agent.config, remoteOpts()).conversation_config;
    const rc = (remote.conversation_config ?? {}) as { agent?: { first_message?: string; language?: string; prompt?: { prompt?: string } }; tts?: { voice_id?: string } };
    const differences: string[] = [];
    if (rc.agent?.first_message !== expected.agent.first_message) differences.push("welcome message");
    if (rc.agent?.prompt?.prompt !== expected.agent.prompt.prompt) differences.push("instructions");
    if (rc.agent?.language !== expected.agent.language) differences.push("language");
    if (expected.tts && rc.tts?.voice_id !== expected.tts.voice_id) differences.push("voice");
    const note = differences.length ? `Remote differs from the saved configuration: ${differences.join(", ")}.` : "Remote agent exists and matches the saved configuration.";
    await repo.setRemoteChecked(c.store, agent.id, "active", note);
    return { agent: await load(agent.id, c), remote: { found: true, matchesLocal: differences.length === 0, differences } };
  } catch (err) {
    if (isElevenLabsError(err) && err.kind === "unsupported") {
      await repo.setRemoteChecked(c.store, agent.id, "remote_missing", "ElevenLabs could not find this agent. It may have been deleted there.");
      return { agent: await load(agent.id, c), remote: { found: false, matchesLocal: null, differences: [] } };
    }
    throw err instanceof AppError ? err : fromRemote(err);
  }
}

// ---------- lifecycle ----------
export async function archiveAgent(id: string, context?: AgentContext): Promise<Agent> {
  const c = ctx(context);
  const agent = await load(id, c);
  await withTransaction(c.store, async (db) => {
    await repo.setAgentStatus(db, agent.id, "archived", "Archived in VocaForge. The ElevenLabs agent was not deleted.");
    await recordActivity(db, c.ownerId, { projectId: agent.projectId, type: "agent.archived", summary: `Archived agent "${agent.name}"` });
  });
  return load(agent.id, c);
}

/** Deletes the remote agent and only reports success after ElevenLabs confirms it is gone. */
export async function deleteRemoteAgent(id: string, confirmName: string, context?: AgentContext): Promise<Agent> {
  const c = ctx(context);
  const agent = await load(id, c);
  if (confirmName.trim() !== agent.name) throw new ValidationError("Type the agent name exactly to confirm.", { confirmName: ["Does not match the agent name."] });
  try { await c.remote.deleteAgent(agent.remoteAgentId); } catch (err) { throw fromRemote(err); }
  let stillThere = true;
  try { await c.remote.getAgent(agent.remoteAgentId); } catch (err) { stillThere = !(isElevenLabsError(err) && err.kind === "unsupported"); if (stillThere) throw new AppError("deletion_unconfirmed", 502, "The delete request was sent but VocaForge could not confirm the agent is gone. Refresh the status before trying again."); }
  if (stillThere) throw new AppError("deletion_unconfirmed", 502, "ElevenLabs still returns this agent after the delete request. Nothing was marked deleted.");
  await withTransaction(c.store, async (db) => {
    await repo.setAgentStatus(db, agent.id, "remote_deleted", "Deleted from ElevenLabs and confirmed.");
    await recordActivity(db, c.ownerId, { projectId: agent.projectId, type: "agent.remote_deleted", summary: `Deleted agent "${agent.name}" from ElevenLabs` });
  });
  return load(agent.id, c);
}

// ---------- live session ----------
/** Returns a short-lived signed URL. The long-lived API key never leaves the server. */
export async function createLiveSession(id: string, context?: AgentContext): Promise<{ signedUrl: string; agentName: string; remoteAgentId: string }> {
  const c = ctx(context);
  const agent = await load(id, c);
  if (agent.status !== "active") throw new ConflictError(`This agent is ${agent.status.replace("_", " ")} and cannot be tested.`);
  try {
    const signedUrl = await c.remote.getSignedUrl(agent.remoteAgentId);
    logger.info("live session url issued", { agentId: agent.id });
    return { signedUrl, agentName: agent.name, remoteAgentId: agent.remoteAgentId };
  } catch (err) { throw fromRemote(err); }
}
