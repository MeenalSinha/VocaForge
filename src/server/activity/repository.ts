import type { Db } from "../db/pool";

export type ActivityType =
  | "project.created" | "project.updated" | "project.archived" | "project.restored"
  | "agent.created" | "agent.updated" | "agent.synced" | "agent.archived" | "agent.remote_deleted";

export interface ActivityEvent {
  id: string;
  projectId: string | null;
  type: ActivityType;
  summary: string;
  createdAt: string;
}

export async function recordActivity(
  db: Db,
  ownerId: string | null,
  e: { projectId: string | null; type: ActivityType; summary: string },
): Promise<void> {
  await db.query("INSERT INTO activity_events (project_id, owner_id, event_type, summary) VALUES ($1, $2, $3, $4)", [
    e.projectId,
    ownerId,
    e.type,
    e.summary,
  ]);
}

export async function listRecentActivity(db: Db, ownerId: string | null, limit = 8): Promise<ActivityEvent[]> {
  const params: unknown[] = [];
  let owner = "owner_id IS NULL";
  if (ownerId !== null) {
    params.push(ownerId);
    owner = "owner_id = $1";
  }
  params.push(limit);
  const res = await db.query<{ id: string; project_id: string | null; event_type: ActivityType; summary: string; created_at: Date | string }>(
    `SELECT id, project_id, event_type, summary, created_at FROM activity_events WHERE ${owner} ORDER BY created_at DESC, id LIMIT $${params.length}`,
    params,
  );
  return res.rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    type: r.event_type,
    summary: r.summary,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
  }));
}
