import type { Db } from "../db/pool";
import type { CreateProjectInput, ListProjectsQuery, Project, UpdateProjectInput } from "./schema";

/** Pure data access. All queries are scoped by owner (NULL = single shared workspace). */
interface Row {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, name, description, status, created_at, updated_at";
const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

function toProject(r: Row): Project {
  return { id: r.id, name: r.name, description: r.description, status: r.status, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) };
}

function ownerClause(ownerId: string | null, params: unknown[]): string {
  if (ownerId === null) return "owner_id IS NULL";
  params.push(ownerId);
  return `owner_id = $${params.length}`;
}

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function insertProject(db: Db, ownerId: string | null, input: CreateProjectInput): Promise<Project> {
  const res = await db.query<Row>(
    `INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [input.name, input.description, ownerId],
  );
  return toProject(res.rows[0]!);
}

export async function findProject(db: Db, ownerId: string | null, id: string): Promise<Project | null> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(`SELECT ${COLUMNS} FROM projects WHERE id = $1 AND ${owner}`, params);
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

export async function selectProjects(
  db: Db,
  ownerId: string | null,
  q: ListProjectsQuery,
): Promise<{ items: Project[]; total: number }> {
  const params: unknown[] = [];
  const where: string[] = [ownerClause(ownerId, params)];
  if (q.status !== "all") {
    params.push(q.status);
    where.push(`status = $${params.length}`);
  }
  if (q.q) {
    params.push(`%${escapeLike(q.q.toLowerCase())}%`);
    where.push(`(lower(name) LIKE $${params.length} OR lower(coalesce(description, '')) LIKE $${params.length})`);
  }
  const clause = where.join(" AND ");
  const count = await db.query<{ n: string }>(`SELECT count(*) AS n FROM projects WHERE ${clause}`, params);
  const listParams = [...params, q.limit, q.offset];
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} FROM projects WHERE ${clause} ORDER BY updated_at DESC, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  );
  return { items: res.rows.map(toProject), total: Number(count.rows[0]?.n ?? 0) };
}

export async function patchProject(db: Db, ownerId: string | null, id: string, input: UpdateProjectInput): Promise<Project | null> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (input.name !== undefined) {
    params.push(input.name);
    sets.push(`name = $${params.length}`);
  }
  if (input.description !== undefined) {
    params.push(input.description);
    sets.push(`description = $${params.length}`);
  }
  sets.push("updated_at = now()");
  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $1 AND ${owner} RETURNING ${COLUMNS}`,
    params,
  );
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

export async function updateStatus(db: Db, ownerId: string | null, id: string, status: "active" | "archived"): Promise<Project | null> {
  const params: unknown[] = [id, status];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `UPDATE projects SET status = $2, updated_at = now() WHERE id = $1 AND ${owner} RETURNING ${COLUMNS}`,
    params,
  );
  return res.rows[0] ? toProject(res.rows[0]) : null;
}

export async function countByStatus(db: Db, ownerId: string | null): Promise<{ active: number; archived: number }> {
  const params: unknown[] = [];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<{ status: string; n: string }>(
    `SELECT status, count(*) AS n FROM projects WHERE ${owner} GROUP BY status`,
    params,
  );
  const get = (s: string) => Number(res.rows.find((r) => r.status === s)?.n ?? 0);
  return { active: get("active"), archived: get("archived") };
}
