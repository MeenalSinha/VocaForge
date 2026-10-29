import type { Pool } from "pg";
import { getPool, withTransaction } from "../db/pool";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { recordActivity } from "../activity/repository";
import { findProject } from "../projects/repository";
import { findAgent } from "../agents/repository";
import { fieldErrorsOf } from "../agents/config-schema";
import {
  createPersonaInputSchema,
  createScenarioInputSchema,
  updatePersonaInputSchema,
  updateScenarioInputSchema,
  type PersonaCategory,
  type PersonaRecord,
  type PersonaStatus,
  type ScenarioPriority,
  type ScenarioRecord,
  type ScenarioStatus,
} from "./schema";
import {
  evaluatePersonaReadiness,
  evaluateScenarioReadiness,
  type PersonaReadiness,
  type ScenarioReadiness,
} from "./readiness";
import {
  countPersonas,
  countScenariosForPersona,
  deletePersona as repoDeletePersona,
  deleteScenario as repoDeleteScenario,
  findPersona,
  findScenario,
  insertPersona,
  insertScenario,
  listPersonas as repoListPersonas,
  listScenarios as repoListScenarios,
  updatePersona as repoUpdatePersona,
  updateScenario as repoUpdateScenario,
} from "./repository";

export interface PersonaContext {
  store?: Pool;
  ownerId?: string | null;
}

const poolOf = (ctx?: PersonaContext) => ctx?.store ?? getPool();
const ownerOf = (ctx?: PersonaContext) => ctx?.ownerId ?? null;

// ----------------- Personas -----------------

export async function createPersona(
  rawInput: unknown,
  ctx?: PersonaContext,
): Promise<{ persona: PersonaRecord; readiness: PersonaReadiness }> {
  const parsed = createPersonaInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid virtual customer input.", fieldErrorsOf(parsed.error));
  }
  const input = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const project = await findProject(pool, ownerId, input.projectId);
  if (!project) {
    throw new NotFoundError("Project not found.");
  }

  const readiness = evaluatePersonaReadiness(input.name, input.config, "draft");

  return withTransaction(pool, async (client) => {
    const persona = await insertPersona(client, ownerId, input, readiness.status);
    await recordActivity(client, ownerId, {
      projectId: input.projectId,
      type: "persona.created",
      summary: `Created virtual customer "${persona.name}"`,
    });
    return { persona, readiness };
  });
}

export async function getPersona(
  id: string,
  ctx?: PersonaContext,
): Promise<{ persona: PersonaRecord; readiness: PersonaReadiness; scenarioCount: number }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const persona = await findPersona(pool, ownerId, id);
  if (!persona) {
    throw new NotFoundError("Virtual Customer not found.");
  }

  const readiness = evaluatePersonaReadiness(persona.name, persona.config, persona.status);
  const scenarioCount = await countScenariosForPersona(pool, ownerId, id);

  return { persona, readiness, scenarioCount };
}

export async function updatePersona(
  id: string,
  rawInput: unknown,
  ctx?: PersonaContext,
): Promise<{ persona: PersonaRecord; readiness: PersonaReadiness }> {
  const parsed = updatePersonaInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid update for virtual customer.", fieldErrorsOf(parsed.error));
  }
  const input = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findPersona(pool, ownerId, id);
  if (!existing) {
    throw new NotFoundError("Virtual Customer not found.");
  }

  const updatedName = input.name !== undefined ? input.name : existing.name;
  const updatedConfig = input.config !== undefined ? input.config : existing.config;
  const currentStatus = input.status !== undefined ? input.status : existing.status;

  const readiness = evaluatePersonaReadiness(updatedName, updatedConfig, currentStatus);
  const targetStatus = currentStatus === "archived" ? "archived" : readiness.status;

  const updated = await withTransaction(pool, async (client) => {
    const p = await repoUpdatePersona(client, ownerId, id, {
      ...input,
      status: targetStatus,
    });
    if (!p) throw new NotFoundError("Virtual Customer not found.");
    await recordActivity(client, ownerId, {
      projectId: p.projectId,
      type: "persona.updated",
      summary: `Updated virtual customer "${p.name}"`,
    });
    return p;
  });

  return { persona: updated, readiness };
}

export async function duplicatePersona(
  id: string,
  ctx?: PersonaContext,
): Promise<{ persona: PersonaRecord; readiness: PersonaReadiness }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const source = await findPersona(pool, ownerId, id);
  if (!source) {
    throw new NotFoundError("Virtual Customer not found.");
  }

  const newName = `${source.name} (Copy)`.slice(0, 120);
  const readiness = evaluatePersonaReadiness(newName, source.config, "draft");

  return withTransaction(pool, async (client) => {
    const persona = await insertPersona(
      client,
      ownerId,
      {
        projectId: source.projectId,
        name: newName,
        description: source.description,
        category: source.category,
        templateId: source.templateId,
        config: source.config,
      },
      readiness.status,
    );
    await recordActivity(client, ownerId, {
      projectId: persona.projectId,
      type: "persona.duplicated",
      summary: `Duplicated virtual customer "${source.name}" as "${persona.name}"`,
    });
    return { persona, readiness };
  });
}

export async function archivePersona(
  id: string,
  ctx?: PersonaContext,
): Promise<PersonaRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findPersona(pool, ownerId, id);
  if (!existing) {
    throw new NotFoundError("Virtual Customer not found.");
  }

  return withTransaction(pool, async (client) => {
    const updated = await repoUpdatePersona(client, ownerId, id, { status: "archived" });
    if (!updated) throw new NotFoundError("Virtual Customer not found.");
    await recordActivity(client, ownerId, {
      projectId: updated.projectId,
      type: "persona.archived",
      summary: `Archived virtual customer "${updated.name}"`,
    });
    return updated;
  });
}

export async function deletePersona(
  id: string,
  ctx?: PersonaContext,
): Promise<{ deleted: boolean }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findPersona(pool, ownerId, id);
  if (!existing) {
    throw new NotFoundError("Virtual Customer not found.");
  }

  const scenarioCount = await countScenariosForPersona(pool, ownerId, id);
  if (scenarioCount > 0) {
    throw new ConflictError(
      `Cannot delete virtual customer "${existing.name}" because ${scenarioCount} test scenario(s) refer to it. Archive the customer or delete its scenarios first.`,
    );
  }

  const deleted = await repoDeletePersona(pool, ownerId, id);
  return { deleted };
}

export async function listPersonas(
  filter: {
    projectId?: string;
    category?: PersonaCategory;
    status?: PersonaStatus;
    search?: string;
    includeArchived?: boolean;
  } = {},
  ctx?: PersonaContext,
): Promise<PersonaRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repoListPersonas(pool, ownerId, filter);
}

export async function getPersonaStats(
  projectId?: string,
  ctx?: PersonaContext,
): Promise<{ total: number; ready: number; draft: number; needsConfig: number; archived: number }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return countPersonas(pool, ownerId, projectId);
}

// ----------------- Scenarios -----------------

export async function createScenario(
  rawInput: unknown,
  ctx?: PersonaContext,
): Promise<{ scenario: ScenarioRecord; readiness: ScenarioReadiness }> {
  const parsed = createScenarioInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid test scenario input.", fieldErrorsOf(parsed.error));
  }
  const input = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const project = await findProject(pool, ownerId, input.projectId);
  if (!project) throw new NotFoundError("Project not found.");

  const persona = await findPersona(pool, ownerId, input.personaId);
  if (!persona) throw new NotFoundError("Virtual Customer not found.");
  if (persona.projectId !== input.projectId) {
    throw new ValidationError("The selected persona does not belong to this project.", {
      personaId: ["Persona belongs to a different project."],
    });
  }

  let targetAgentConfig = null;
  if (input.targetAgentId) {
    const agent = await findAgent(pool, ownerId, input.targetAgentId);
    if (!agent) throw new NotFoundError("Target Agent not found.");
    if (agent.projectId !== input.projectId) {
      throw new ValidationError("The selected agent does not belong to this project.", {
        targetAgentId: ["Agent belongs to a different project."],
      });
    }
    targetAgentConfig = agent.config;
  }

  const readiness = evaluateScenarioReadiness(
    input.name,
    input.config,
    "draft",
    targetAgentConfig,
  );

  return withTransaction(pool, async (client) => {
    const scenario = await insertScenario(client, ownerId, input, readiness.status);
    await recordActivity(client, ownerId, {
      projectId: input.projectId,
      type: "scenario.created",
      summary: `Created test scenario "${scenario.name}"`,
    });
    return { scenario, readiness };
  });
}

export async function getScenario(
  id: string,
  ctx?: PersonaContext,
): Promise<{
  scenario: ScenarioRecord;
  readiness: ScenarioReadiness;
  persona: PersonaRecord | null;
}> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const scenario = await findScenario(pool, ownerId, id);
  if (!scenario) throw new NotFoundError("Test Scenario not found.");

  const persona = await findPersona(pool, ownerId, scenario.personaId);

  let targetAgentConfig = null;
  if (scenario.targetAgentId) {
    const agent = await findAgent(pool, ownerId, scenario.targetAgentId);
    if (agent) targetAgentConfig = agent.config;
  }

  const readiness = evaluateScenarioReadiness(
    scenario.name,
    scenario.config,
    scenario.status,
    targetAgentConfig,
  );

  return { scenario, readiness, persona };
}

export async function updateScenario(
  id: string,
  rawInput: unknown,
  ctx?: PersonaContext,
): Promise<{ scenario: ScenarioRecord; readiness: ScenarioReadiness }> {
  const parsed = updateScenarioInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid update for test scenario.", fieldErrorsOf(parsed.error));
  }
  const input = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findScenario(pool, ownerId, id);
  if (!existing) throw new NotFoundError("Test Scenario not found.");

  if (input.personaId && input.personaId !== existing.personaId) {
    const persona = await findPersona(pool, ownerId, input.personaId);
    if (!persona) throw new NotFoundError("Virtual Customer not found.");
    if (persona.projectId !== existing.projectId) {
      throw new ValidationError("The selected persona does not belong to this project.", {
        personaId: ["Persona belongs to a different project."],
      });
    }
  }

  let targetAgentConfig = null;
  const targetAgentId =
    input.targetAgentId !== undefined ? input.targetAgentId : existing.targetAgentId;
  if (targetAgentId) {
    const agent = await findAgent(pool, ownerId, targetAgentId);
    if (!agent) throw new NotFoundError("Target Agent not found.");
    if (agent.projectId !== existing.projectId) {
      throw new ValidationError("The selected agent does not belong to this project.", {
        targetAgentId: ["Agent belongs to a different project."],
      });
    }
    targetAgentConfig = agent.config;
  }

  const updatedName = input.name !== undefined ? input.name : existing.name;
  const updatedConfig = input.config !== undefined ? input.config : existing.config;
  const currentStatus = input.status !== undefined ? input.status : existing.status;

  const readiness = evaluateScenarioReadiness(
    updatedName,
    updatedConfig,
    currentStatus,
    targetAgentConfig,
  );
  const targetStatus = currentStatus === "archived" ? "archived" : readiness.status;

  const updated = await withTransaction(pool, async (client) => {
    const s = await repoUpdateScenario(client, ownerId, id, {
      ...input,
      status: targetStatus,
    });
    if (!s) throw new NotFoundError("Test Scenario not found.");
    await recordActivity(client, ownerId, {
      projectId: s.projectId,
      type: "scenario.updated",
      summary: `Updated test scenario "${s.name}"`,
    });
    return s;
  });

  return { scenario: updated, readiness };
}

export async function duplicateScenario(
  id: string,
  ctx?: PersonaContext,
): Promise<{ scenario: ScenarioRecord; readiness: ScenarioReadiness }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const source = await findScenario(pool, ownerId, id);
  if (!source) throw new NotFoundError("Test Scenario not found.");

  const newName = `${source.name} (Copy)`.slice(0, 140);
  const readiness = evaluateScenarioReadiness(newName, source.config, "draft");

  return withTransaction(pool, async (client) => {
    const scenario = await insertScenario(
      client,
      ownerId,
      {
        projectId: source.projectId,
        personaId: source.personaId,
        targetAgentId: source.targetAgentId,
        name: newName,
        description: source.description,
        priority: source.priority,
        config: source.config,
      },
      readiness.status,
    );
    await recordActivity(client, ownerId, {
      projectId: scenario.projectId,
      type: "scenario.duplicated",
      summary: `Duplicated test scenario "${source.name}" as "${scenario.name}"`,
    });
    return { scenario, readiness };
  });
}

export async function archiveScenario(
  id: string,
  ctx?: PersonaContext,
): Promise<ScenarioRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findScenario(pool, ownerId, id);
  if (!existing) throw new NotFoundError("Test Scenario not found.");

  return withTransaction(pool, async (client) => {
    const updated = await repoUpdateScenario(client, ownerId, id, { status: "archived" });
    if (!updated) throw new NotFoundError("Test Scenario not found.");
    await recordActivity(client, ownerId, {
      projectId: updated.projectId,
      type: "scenario.archived",
      summary: `Archived test scenario "${updated.name}"`,
    });
    return updated;
  });
}

export async function deleteScenario(
  id: string,
  ctx?: PersonaContext,
): Promise<{ deleted: boolean }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const existing = await findScenario(pool, ownerId, id);
  if (!existing) throw new NotFoundError("Test Scenario not found.");

  const deleted = await repoDeleteScenario(pool, ownerId, id);
  return { deleted };
}

export async function listScenarios(
  filter: {
    projectId?: string;
    personaId?: string;
    targetAgentId?: string;
    status?: ScenarioStatus;
    priority?: ScenarioPriority;
    search?: string;
    includeArchived?: boolean;
  } = {},
  ctx?: PersonaContext,
): Promise<ScenarioRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repoListScenarios(pool, ownerId, filter);
}
