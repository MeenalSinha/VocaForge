import { ok, readJson, route } from "@/server/http/respond";
import { setupDemoWorkspace } from "@/server/demo/setup";
import { getPool } from "@/server/db/pool";
import { selectProjects } from "@/server/projects/repository";
import { selectAgents } from "@/server/agents/repository";
import { listPersonas, listScenarios } from "@/server/personas/repository";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const pool = getPool();
  const projectName = "Apex Care & Support Services";
  const { items } = await selectProjects(pool, null, { q: projectName, status: "all", limit: 5, offset: 0 });
  const project = items.find((p) => p.name === projectName);

  if (!project) {
    return ok({ initialized: false, message: "Demo workspace has not been initialized." });
  }

  const agents = await selectAgents(pool, null, { projectId: project.id });
  const personas = await listPersonas(pool, null, { projectId: project.id });
  const scenarios = await listScenarios(pool, null, { projectId: project.id });

  return ok({
    initialized: true,
    projectId: project.id,
    projectName: project.name,
    agentsCount: agents.length,
    personasCount: personas.length,
    scenariosCount: scenarios.length,
    agents: agents.map((a) => ({ id: a.id, name: a.name, remoteAgentId: a.remoteAgentId })),
    personas: personas.map((p) => ({ id: p.id, name: p.name })),
    scenarios: scenarios.map((s) => ({ id: s.id, name: s.name, priority: s.priority })),
  });
});

export const POST = route(async (req: Request) => {
  let executeSimulation = false;
  try {
    const body = (await readJson(req)) as { executeSimulation?: boolean };
    executeSimulation = Boolean(body?.executeSimulation);
  } catch {
    // Body optional for demo setup
  }

  const result = await setupDemoWorkspace({ executeSimulation });
  return ok(result, 201);
});

