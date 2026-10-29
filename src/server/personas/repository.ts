import type { Db } from "../db/pool";
import type {
  CreatePersonaInput,
  CreateScenarioInput,
  PersonaCategory,
  PersonaConfig,
  PersonaRecord,
  PersonaStatus,
  ScenarioConfig,
  ScenarioPriority,
  ScenarioRecord,
  ScenarioStatus,
  UpdatePersonaInput,
  UpdateScenarioInput,
} from "./schema";

type Row = Record<string, unknown>;

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
const json = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;

function ownerClause(ownerId: string | null, params: unknown[], col = "owner_id"): string {
  if (ownerId === null) return `${col} IS NULL`;
  params.push(ownerId);
  return `${col} = $${params.length}`;
}

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const PERSONA_COLS =
  "id, project_id, owner_id, name, description, category, template_id, status, version, config, created_at, updated_at";

function toPersona(r: Row): PersonaRecord {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    ownerId: (r.owner_id as string) ?? null,
    name: r.name as string,
    description: (r.description as string) ?? "",
    category: r.category as PersonaCategory,
    templateId: (r.template_id as string) ?? null,
    status: r.status as PersonaStatus,
    version: Number(r.version),
    config: json<PersonaConfig>(r.config),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const SCENARIO_COLS =
  "id, project_id, owner_id, persona_id, target_agent_id, name, description, status, priority, config, created_at, updated_at";

function toScenario(r: Row): ScenarioRecord {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    ownerId: (r.owner_id as string) ?? null,
    personaId: r.persona_id as string,
    targetAgentId: (r.target_agent_id as string) ?? null,
    name: r.name as string,
    description: (r.description as string) ?? "",
    status: r.status as ScenarioStatus,
    priority: r.priority as ScenarioPriority,
    config: json<ScenarioConfig>(r.config),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function insertPersona(
  db: Db,
  ownerId: string | null,
  input: CreatePersonaInput,
  initialStatus: PersonaStatus = "draft",
): Promise<PersonaRecord> {
  const res = await db.query<Row>(
    `INSERT INTO personas (project_id, owner_id, name, description, category, template_id, status, version, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
     RETURNING ${PERSONA_COLS}`,
    [
      input.projectId,
      ownerId,
      input.name,
      input.description || null,
      input.category,
      input.templateId || null,
      initialStatus,
      JSON.stringify(input.config),
    ],
  );
  return toPersona(res.rows[0]!);
}

export async function findPersona(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<PersonaRecord | null> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `SELECT ${PERSONA_COLS} FROM personas WHERE id = $1 AND ${owner}`,
    params,
  );
  return res.rows[0] ? toPersona(res.rows[0]) : null;
}

export async function updatePersona(
  db: Db,
  ownerId: string | null,
  id: string,
  input: UpdatePersonaInput,
): Promise<PersonaRecord | null> {
  const current = await findPersona(db, ownerId, id);
  if (!current) return null;

  const sets: string[] = ["updated_at = now()", "version = version + 1"];
  const params: unknown[] = [id];

  if (input.name !== undefined) {
    params.push(input.name);
    sets.push(`name = $${params.length}`);
  }
  if (input.description !== undefined) {
    params.push(input.description || null);
    sets.push(`description = $${params.length}`);
  }
  if (input.category !== undefined) {
    params.push(input.category);
    sets.push(`category = $${params.length}`);
  }
  if (input.status !== undefined) {
    params.push(input.status);
    sets.push(`status = $${params.length}`);
  }
  if (input.config !== undefined) {
    params.push(JSON.stringify(input.config));
    sets.push(`config = $${params.length}`);
  }

  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `UPDATE personas SET ${sets.join(", ")} WHERE id = $1 AND ${owner} RETURNING ${PERSONA_COLS}`,
    params,
  );
  return res.rows[0] ? toPersona(res.rows[0]) : null;
}

export async function listPersonas(
  db: Db,
  ownerId: string | null,
  filter: {
    projectId?: string;
    category?: string;
    status?: string;
    search?: string;
    includeArchived?: boolean;
  } = {},
): Promise<PersonaRecord[]> {
  const params: unknown[] = [];
  const where: string[] = [ownerClause(ownerId, params)];

  if (filter.projectId) {
    params.push(filter.projectId);
    where.push(`project_id = $${params.length}`);
  }
  if (filter.category) {
    params.push(filter.category);
    where.push(`category = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  } else if (!filter.includeArchived) {
    where.push(`status != 'archived'`);
  }
  if (filter.search && filter.search.trim()) {
    params.push(`%${escapeLike(filter.search.trim().toLowerCase())}%`);
    where.push(`(lower(name) LIKE $${params.length} OR lower(description) LIKE $${params.length})`);
  }

  const res = await db.query<Row>(
    `SELECT ${PERSONA_COLS} FROM personas WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`,
    params,
  );
  return res.rows.map(toPersona);
}

export async function deletePersona(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<boolean> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query(`DELETE FROM personas WHERE id = $1 AND ${owner}`, params);
  return (res.rowCount ?? 0) > 0;
}

export async function countPersonas(
  db: Db,
  ownerId: string | null,
  projectId?: string,
): Promise<{ total: number; ready: number; draft: number; needsConfig: number; archived: number }> {
  const params: unknown[] = [];
  const where: string[] = [ownerClause(ownerId, params)];
  if (projectId) {
    params.push(projectId);
    where.push(`project_id = $${params.length}`);
  }

  const res = await db.query<{ status: string; n: string }>(
    `SELECT status, count(*) AS n FROM personas WHERE ${where.join(" AND ")} GROUP BY status`,
    params,
  );

  let total = 0;
  let ready = 0;
  let draft = 0;
  let needsConfig = 0;
  let archived = 0;

  for (const r of res.rows) {
    const n = Number(r.n);
    if (r.status === "archived") archived += n;
    else {
      total += n;
      if (r.status === "ready_for_testing") ready += n;
      else if (r.status === "draft") draft += n;
      else if (r.status === "needs_configuration") needsConfig += n;
    }
  }

  return { total, ready, draft, needsConfig, archived };
}

// Scenarios

export async function insertScenario(
  db: Db,
  ownerId: string | null,
  input: CreateScenarioInput,
  initialStatus: ScenarioStatus = "draft",
): Promise<ScenarioRecord> {
  const res = await db.query<Row>(
    `INSERT INTO scenarios (project_id, owner_id, persona_id, target_agent_id, name, description, status, priority, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SCENARIO_COLS}`,
    [
      input.projectId,
      ownerId,
      input.personaId,
      input.targetAgentId || null,
      input.name,
      input.description || null,
      initialStatus,
      input.priority,
      JSON.stringify(input.config),
    ],
  );
  return toScenario(res.rows[0]!);
}

export async function findScenario(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<ScenarioRecord | null> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `SELECT ${SCENARIO_COLS} FROM scenarios WHERE id = $1 AND ${owner}`,
    params,
  );
  return res.rows[0] ? toScenario(res.rows[0]) : null;
}

export async function updateScenario(
  db: Db,
  ownerId: string | null,
  id: string,
  input: UpdateScenarioInput,
): Promise<ScenarioRecord | null> {
  const current = await findScenario(db, ownerId, id);
  if (!current) return null;

  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [id];

  if (input.name !== undefined) {
    params.push(input.name);
    sets.push(`name = $${params.length}`);
  }
  if (input.description !== undefined) {
    params.push(input.description || null);
    sets.push(`description = $${params.length}`);
  }
  if (input.personaId !== undefined) {
    params.push(input.personaId);
    sets.push(`persona_id = $${params.length}`);
  }
  if (input.targetAgentId !== undefined) {
    params.push(input.targetAgentId || null);
    sets.push(`target_agent_id = $${params.length}`);
  }
  if (input.status !== undefined) {
    params.push(input.status);
    sets.push(`status = $${params.length}`);
  }
  if (input.priority !== undefined) {
    params.push(input.priority);
    sets.push(`priority = $${params.length}`);
  }
  if (input.config !== undefined) {
    params.push(JSON.stringify(input.config));
    sets.push(`config = $${params.length}`);
  }

  const owner = ownerClause(ownerId, params);
  const res = await db.query<Row>(
    `UPDATE scenarios SET ${sets.join(", ")} WHERE id = $1 AND ${owner} RETURNING ${SCENARIO_COLS}`,
    params,
  );
  return res.rows[0] ? toScenario(res.rows[0]) : null;
}

export async function listScenarios(
  db: Db,
  ownerId: string | null,
  filter: {
    projectId?: string;
    personaId?: string;
    targetAgentId?: string;
    status?: string;
    priority?: string;
    search?: string;
    includeArchived?: boolean;
  } = {},
): Promise<ScenarioRecord[]> {
  const params: unknown[] = [];
  const where: string[] = [ownerClause(ownerId, params)];

  if (filter.projectId) {
    params.push(filter.projectId);
    where.push(`project_id = $${params.length}`);
  }
  if (filter.personaId) {
    params.push(filter.personaId);
    where.push(`persona_id = $${params.length}`);
  }
  if (filter.targetAgentId) {
    params.push(filter.targetAgentId);
    where.push(`target_agent_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  } else if (!filter.includeArchived) {
    where.push(`status != 'archived'`);
  }
  if (filter.priority) {
    params.push(filter.priority);
    where.push(`priority = $${params.length}`);
  }
  if (filter.search && filter.search.trim()) {
    params.push(`%${escapeLike(filter.search.trim().toLowerCase())}%`);
    where.push(`(lower(name) LIKE $${params.length} OR lower(description) LIKE $${params.length})`);
  }

  const res = await db.query<Row>(
    `SELECT ${SCENARIO_COLS} FROM scenarios WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`,
    params,
  );
  return res.rows.map(toScenario);
}

export async function deleteScenario(
  db: Db,
  ownerId: string | null,
  id: string,
): Promise<boolean> {
  const params: unknown[] = [id];
  const owner = ownerClause(ownerId, params);
  const res = await db.query(`DELETE FROM scenarios WHERE id = $1 AND ${owner}`, params);
  return (res.rowCount ?? 0) > 0;
}

export async function countScenariosForPersona(
  db: Db,
  ownerId: string | null,
  personaId: string,
): Promise<number> {
  const params: unknown[] = [personaId];
  const owner = ownerClause(ownerId, params);
  const res = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM scenarios WHERE persona_id = $1 AND ${owner}`,
    params,
  );
  return Number(res.rows[0]?.n || 0);
}

