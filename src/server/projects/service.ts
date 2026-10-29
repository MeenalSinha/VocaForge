import { listRecentActivity, recordActivity, type ActivityEvent } from "../activity/repository";
import { getPool, mapDbError, withTransaction, type Db, type TxRunner } from "../db/pool";
import { NotFoundError, ValidationError } from "../errors";
import {
  countByStatus,
  findProject,
  insertProject,
  patchProject,
  selectProjects,
  updateStatus,
} from "./repository";
import {
  createProjectSchema,
  fieldErrorsFrom,
  listProjectsSchema,
  updateProjectSchema,
  uuidSchema,
  type Project,
} from "./schema";

/** Application service. `store` is injectable so tests can supply an isolated database. */
export interface Store extends TxRunner {
  query: Db["query"];
}

export interface ServiceContext {
  store?: Store;
  /** NULL in Phase 1 (single shared workspace). Set once authentication exists. */
  ownerId?: string | null;
}

const ctx = (c?: ServiceContext) => ({ store: (c?.store ?? getPool()) as Store, ownerId: c?.ownerId ?? null });

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import("zod").ZodError } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError("Please correct the highlighted fields.", fieldErrorsFrom(r.error));
  return r.data;
}

function requireId(id: string): string {
  if (!uuidSchema.safeParse(id).success) throw new NotFoundError("Project not found.");
  return id;
}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return mapDbError(err);
  }
}

export async function createProject(input: unknown, c?: ServiceContext): Promise<Project> {
  const data = parse(createProjectSchema, input);
  const { store, ownerId } = ctx(c);
  return withTransaction(store, async (db) => {
    const project = await insertProject(db, ownerId, data);
    await recordActivity(db, ownerId, { projectId: project.id, type: "project.created", summary: `Created project "${project.name}"` });
    return project;
  });
}

export async function getProject(id: string, c?: ServiceContext): Promise<Project> {
  const { store, ownerId } = ctx(c);
  const project = await guarded(() => findProject(store, ownerId, requireId(id)));
  if (!project) throw new NotFoundError("Project not found.");
  return project;
}

export async function listProjects(query: unknown, c?: ServiceContext) {
  const q = parse(listProjectsSchema, query ?? {});
  const { store, ownerId } = ctx(c);
  return guarded(() => selectProjects(store, ownerId, q));
}

export async function updateProject(id: string, input: unknown, c?: ServiceContext): Promise<Project> {
  const data = parse(updateProjectSchema, input);
  const { store, ownerId } = ctx(c);
  requireId(id);
  return withTransaction(store, async (db) => {
    const project = await patchProject(db, ownerId, id, data);
    if (!project) throw new NotFoundError("Project not found.");
    await recordActivity(db, ownerId, { projectId: project.id, type: "project.updated", summary: `Updated project "${project.name}"` });
    return project;
  });
}

async function setStatus(id: string, status: "active" | "archived", c?: ServiceContext): Promise<Project> {
  const { store, ownerId } = ctx(c);
  requireId(id);
  return withTransaction(store, async (db) => {
    const project = await updateStatus(db, ownerId, id, status);
    if (!project) throw new NotFoundError("Project not found.");
    await recordActivity(db, ownerId, {
      projectId: project.id,
      type: status === "archived" ? "project.archived" : "project.restored",
      summary: `${status === "archived" ? "Archived" : "Restored"} project "${project.name}"`,
    });
    return project;
  });
}

export const archiveProject = (id: string, c?: ServiceContext) => setStatus(id, "archived", c);
export const restoreProject = (id: string, c?: ServiceContext) => setStatus(id, "active", c);

export interface DashboardData {
  counts: { active: number; archived: number };
  agents: number;
  activity: ActivityEvent[];
}

export async function getDashboardData(c?: ServiceContext): Promise<DashboardData> {
  const { store, ownerId } = ctx(c);
  return guarded(async () => ({
    counts: await countByStatus(store, ownerId),
    agents: Number((await store.query<{ n: string }>(`SELECT count(*) AS n FROM agents WHERE status IN ('active', 'remote_missing') AND ${ownerId === null ? "owner_id IS NULL" : "owner_id = $1"}`, ownerId === null ? [] : [ownerId])).rows[0]?.n ?? 0),
    activity: await listRecentActivity(store, ownerId, 8),
  }));
}
