import type { Pool } from "pg";
import { getPool, withTransaction } from "../db/pool";
import { loadConfig } from "../config/env";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import { recordActivity } from "../activity/repository";
import { ElevenLabsClient } from "../integrations/elevenlabs/client";
import { isElevenLabsError } from "../integrations/elevenlabs/errors";
import { findProject } from "../projects/repository";
import { findAgent } from "../agents/repository";
import { findPersona, findScenario } from "../personas/repository";
import { evaluatePersonaReadiness, evaluateScenarioReadiness } from "../personas/readiness";
import { fieldErrorsOf } from "../agents/config-schema";
import {
  preflightCheckInputSchema,
  startSimulationInputSchema,
  type PreflightCheckInput,
  type PreflightCheckResult,
  type PreflightItemWarning,
  type SimulationBatchRecord,
  type SimulationRunRecord,
  type StartSimulationInput,
} from "./schema";
import {
  computeSimulationConfigHash,
  mapToElevenLabsTestInput,
} from "./mapping";
import {
  aggregateBatchOutcomes,
  classifyRemoteRun,
} from "./classifier";
import * as repo from "./repository";

export type SimulationRemote = Pick<
  ElevenLabsClient,
  "createSimulationTest" | "runTests" | "getTestInvocation"
>;

export interface SimulationContext {
  store?: Pool;
  ownerId?: string | null;
  remote?: SimulationRemote;
}

const poolOf = (c?: SimulationContext) => c?.store ?? getPool();
const ownerOf = (c?: SimulationContext) => c?.ownerId ?? null;

function defaultRemote(): SimulationRemote {
  const e = loadConfig().elevenlabs;
  return new ElevenLabsClient({ apiKey: e.apiKey, baseUrl: e.baseUrl, timeoutMs: 30000 });
}

const remoteOf = (c?: SimulationContext): SimulationRemote => c?.remote ?? defaultRemote();

/**
 * Runs preflight validation on an agent and selected scenarios.
 * Returns actionable warnings, compatibility checks, and tool safety notices.
 */
export async function runPreflightCheck(
  rawInput: unknown,
  ctx?: SimulationContext,
): Promise<PreflightCheckResult> {
  const parsed = preflightCheckInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid preflight check input.", fieldErrorsOf(parsed.error));
  }
  const input: PreflightCheckInput = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const project = await findProject(pool, ownerId, input.projectId);
  if (!project) throw new NotFoundError("Project not found.");

  const agent = await findAgent(pool, ownerId, input.targetAgentId);
  if (!agent) throw new NotFoundError("Target voice agent not found.");

  const summaryBlockers: string[] = [];
  const summaryWarnings: string[] = [];

  if (!agent.remoteAgentId) {
    summaryBlockers.push("Target voice agent has not been synchronized with ElevenLabs (missing remote agent ID).");
  } else if (agent.remoteAgentId.startsWith("agent_remote_")) {
    summaryBlockers.push(
      `Voice agent "${agent.name}" has a local fixture ID (${agent.remoteAgentId}) and has not been created on ElevenLabs. Please select an agent synchronized with ElevenLabs or create an agent via the Agent Builder.`,
    );
  }

  const scenarioWarnings: PreflightItemWarning[] = [];
  let readyCount = 0;

  for (const scId of input.scenarioIds) {
    const scenario = await findScenario(pool, ownerId, scId);
    if (!scenario) {
      summaryBlockers.push(`Scenario ${scId} does not exist.`);
      continue;
    }

    if (scenario.projectId !== input.projectId) {
      summaryBlockers.push(`Scenario "${scenario.name}" does not belong to the active project.`);
      continue;
    }

    if (scenario.status === "archived") {
      summaryBlockers.push(`Scenario "${scenario.name}" is archived and cannot be executed.`);
      continue;
    }

    const persona = await findPersona(pool, ownerId, scenario.personaId);
    if (!persona) {
      summaryBlockers.push(`Virtual customer for scenario "${scenario.name}" not found.`);
      continue;
    }

    if (persona.status === "archived") {
      summaryBlockers.push(`Virtual customer "${persona.name}" is archived.`);
      continue;
    }

    const personaReadiness = evaluatePersonaReadiness(persona.name, persona.config, persona.status);
    const scenarioReadiness = evaluateScenarioReadiness(
      scenario.name,
      scenario.config,
      scenario.status,
      agent.config,
    );

    const blockers: string[] = [];
    const warnings: string[] = [...scenarioReadiness.warnings];

    if (!personaReadiness.isReady) {
      warnings.push(`Customer "${persona.name}" needs configuration: ${personaReadiness.missing.join(", ")}`);
    }
    if (!scenarioReadiness.isReady) {
      blockers.push(`Scenario criteria incomplete: ${scenarioReadiness.missing.join(", ")}`);
    }

    const isReady = blockers.length === 0 && personaReadiness.isReady;
    if (isReady) readyCount++;

    scenarioWarnings.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      personaName: persona.name,
      isReady,
      warnings,
      blockers,
    });
  }

  // Tool safety notice: inspect if agent capabilities could cause external side effects
  const agentDeclaredCaps = (agent.config.capabilities || []).map((c) => c.name);
  const potentialSideEffectCaps = agentDeclaredCaps.filter((cap) =>
    /book|pay|email|message|sms|cancel|order|delete|transfer/i.test(cap),
  );

  const toolSafetyNotice = {
    hasTools: potentialSideEffectCaps.length > 0,
    toolNames: potentialSideEffectCaps,
    consequentialRiskWarning:
      potentialSideEffectCaps.length > 0
        ? `Agent declares tools capable of external modifications (${potentialSideEffectCaps.join(", ")}). Verify mock/isolated test configuration before executing.`
        : null,
  };

  const canExecute = summaryBlockers.length === 0 && scenarioWarnings.every((s) => s.blockers.length === 0);

  return {
    canExecute,
    targetAgent: {
      id: agent.id,
      name: agent.name,
      remoteAgentId: agent.remoteAgentId,
      primaryLanguage: agent.primaryLanguage,
      declaredCapabilities: agentDeclaredCaps,
    },
    totalScenarios: input.scenarioIds.length,
    readyScenarios: readyCount,
    scenarios: scenarioWarnings,
    toolSafetyNotice,
    summaryBlockers,
    summaryWarnings,
  };
}

/**
 * Prepares and launches a real simulation test execution batch.
 */
export async function startSimulationBatch(
  rawInput: unknown,
  ctx?: SimulationContext,
): Promise<{ batch: SimulationBatchRecord; runs: SimulationRunRecord[] }> {
  const parsed = startSimulationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError("Invalid simulation start request.", fieldErrorsOf(parsed.error));
  }
  const input: StartSimulationInput = parsed.data;
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const remote = remoteOf(ctx);

  // 1. Run Preflight Validation
  const preflight = await runPreflightCheck(
    {
      projectId: input.projectId,
      targetAgentId: input.targetAgentId,
      scenarioIds: input.scenarioIds,
    },
    ctx,
  );

  if (!preflight.canExecute) {
    const firstBlocker =
      preflight.summaryBlockers[0] ||
      preflight.scenarios.find((s) => s.blockers.length > 0)?.blockers[0] ||
      "Preflight check failed.";
    throw new ConflictError(firstBlocker);
  }

  const agent = await findAgent(pool, ownerId, input.targetAgentId);
  if (!agent) throw new NotFoundError("Target agent not found.");

  // 2. Load and validate all scenario and persona records
  const items: Array<{
    scenario: NonNullable<Awaited<ReturnType<typeof findScenario>>>;
    persona: NonNullable<Awaited<ReturnType<typeof findPersona>>>;
  }> = [];

  for (const scId of input.scenarioIds) {
    const sc = await findScenario(pool, ownerId, scId);
    if (!sc) throw new NotFoundError(`Scenario ${scId} not found.`);
    const pe = await findPersona(pool, ownerId, sc.personaId);
    if (!pe) throw new NotFoundError(`Persona for scenario "${sc.name}" not found.`);
    items.push({ scenario: sc, persona: pe });
  }

  // 3. Resolve or create remote test definitions via ElevenLabs API
  const preparedTests: Array<{
    scenario: (typeof items)[0]["scenario"];
    persona: (typeof items)[0]["persona"];
    remoteTestId: string;
  }> = [];

  for (const item of items) {
    const hash = computeSimulationConfigHash(item.persona, item.scenario);
    let def = await repo.findRemoteTestDefinition(pool, item.scenario.id, item.persona.id, hash);

    if (!def) {
      try {
        const testPayload = mapToElevenLabsTestInput(item.persona, item.scenario);
        const remoteRes = await remote.createSimulationTest(testPayload);
        def = await repo.insertRemoteTestDefinition(pool, {
          projectId: input.projectId,
          scenarioId: item.scenario.id,
          personaId: item.persona.id,
          configHash: hash,
          remoteTestId: remoteRes.testId,
        });
      } catch (err: unknown) {
        logger.error("Failed to provision remote test definition", { error: (err as Error).message });
        if (isElevenLabsError(err)) {
          throw new AppError(`elevenlabs_${err.kind}`, 502, `Failed to create ElevenLabs simulation test: ${err.message}`);
        }
        throw new AppError("simulation_prep_failed", 502, "Could not provision simulation test on ElevenLabs.");
      }
    }

    preparedTests.push({
      scenario: item.scenario,
      persona: item.persona,
      remoteTestId: def.remoteTestId,
    });
  }

  // 4. Create local batch and child runs in PostgreSQL transaction
  const batchName = input.name || `Simulation Run: ${agent.name} (${preparedTests.length} scenario${preparedTests.length > 1 ? "s" : ""})`;

  const { batch, createdRuns } = await withTransaction(pool, async (client) => {
    const b = await repo.insertBatch(client, ownerId, {
      projectId: input.projectId,
      targetAgentId: agent.id,
      remoteAgentId: agent.remoteAgentId,
      name: batchName,
      totalScenarios: preparedTests.length,
      executionOptions: {
        repeatCount: input.repeatCount,
        concurrency: input.concurrency,
      },
    });

    const runs: SimulationRunRecord[] = [];
    for (const pt of preparedTests) {
      const r = await repo.insertRun(client, ownerId, {
        batchId: b.id,
        projectId: input.projectId,
        targetAgentId: agent.id,
        scenarioId: pt.scenario.id,
        personaId: pt.persona.id,
        scenarioName: pt.scenario.name,
        personaName: pt.persona.name,
        scenarioSnapshot: pt.scenario.config,
        personaSnapshot: pt.persona.config,
        remoteTestId: pt.remoteTestId,
      });
      runs.push(r);
    }

    await recordActivity(client, ownerId, {
      projectId: input.projectId,
      type: "simulation.started",
      summary: `Started simulation batch "${b.name}" with ${runs.length} scenario(s)`,
    });

    return { batch: b, createdRuns: runs };
  });

  // 5. Submit the test run to ElevenLabs
  try {
    const testIds = preparedTests.map((pt) => pt.remoteTestId);
    const invocation = await remote.runTests(agent.remoteAgentId, testIds);

    // Update batch and runs with remote_invocation_id
    await repo.updateBatch(pool, ownerId, batch.id, {
      status: "running",
      remoteInvocationId: invocation.id,
      startedAt: new Date(),
    });

    for (const r of createdRuns) {
      await repo.updateRun(pool, ownerId, r.id, {
        status: "running",
        remoteInvocationId: invocation.id,
        startedAt: new Date(),
      });
    }

    const updatedBatch = (await repo.findBatch(pool, ownerId, batch.id)) || batch;
    const updatedRuns = await repo.listRunsForBatch(pool, ownerId, batch.id);

    return { batch: updatedBatch, runs: updatedRuns };
  } catch (err: unknown) {
    logger.error("Failed to run tests on ElevenLabs", { error: (err as Error).message });
    const errMessage = (err as Error).message || "Failed to trigger ElevenLabs test invocation.";

    await repo.updateBatch(pool, ownerId, batch.id, {
      status: "infrastructure_error",
      errorMessage: errMessage,
      completedAt: new Date(),
    });

    for (const r of createdRuns) {
      await repo.updateRun(pool, ownerId, r.id, {
        status: "infrastructure_error",
        errorMessage: errMessage,
        completedAt: new Date(),
      });
    }

    if (isElevenLabsError(err)) {
      if (err.status === 404 || err.details?.includes("not found") || err.details?.includes("not_found")) {
        throw new AppError(
          "elevenlabs_not_found",
          404,
          `Voice agent "${agent.name}" (remote ID: ${agent.remoteAgentId}) was not found in your ElevenLabs account. Please select a synchronized agent or re-create it in ElevenLabs before running simulations.`,
        );
      }
      throw new AppError(`elevenlabs_${err.kind}`, 502, `ElevenLabs test execution rejected: ${err.message}`);
    }
    throw new AppError("simulation_execution_failed", 502, errMessage);
  }
}

/**
 * Polls ElevenLabs for updates on an in-progress simulation batch.
 */
export async function pollSimulationBatch(
  batchId: string,
  ctx?: SimulationContext,
): Promise<{ batch: SimulationBatchRecord; runs: SimulationRunRecord[]; isSettled: boolean }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const remote = remoteOf(ctx);

  const batch = await repo.findBatch(pool, ownerId, batchId);
  if (!batch) throw new NotFoundError("Simulation batch not found.");

  const currentRuns = await repo.listRunsForBatch(pool, ownerId, batchId);

  // If already settled, return current state
  const isAlreadySettled = ["completed", "completed_with_failures", "failed", "infrastructure_error", "timed_out", "cancelled"].includes(batch.status);
  if (isAlreadySettled || !batch.remoteInvocationId) {
    return { batch, runs: currentRuns, isSettled: isAlreadySettled };
  }

  try {
    const invocation = await remote.getTestInvocation(batch.remoteInvocationId);

    // Map and update each run
    for (const localRun of currentRuns) {
      // Find matching test run from invocation
      const match = invocation.test_runs.find(
        (tr) =>
          (tr.test_id && tr.test_id === localRun.remoteTestId) ||
          (tr.test_name && tr.test_name.includes(localRun.scenarioName)),
      );

      if (match) {
        const classified = classifyRemoteRun(match);
        await repo.updateRun(pool, ownerId, localRun.id, {
          status: classified.status,
          evaluationResult: classified.evaluationResult,
          evaluationRationale: classified.evaluationRationale,
          transcript: classified.transcript,
          metrics: classified.metrics,
          errorMessage: classified.errorMessage,
          remoteTestRunId: match.test_run_id || null,
          completedAt: classified.status !== "running" && classified.status !== "pending" ? new Date() : null,
        });
      }
    }

    // Refresh runs and recalculate batch aggregates
    const updatedRuns = await repo.listRunsForBatch(pool, ownerId, batchId);
    const agg = aggregateBatchOutcomes(updatedRuns);

    const isNowSettled = agg.batchStatus !== "running" && agg.batchStatus !== "queued";

    await repo.updateBatch(pool, ownerId, batchId, {
      status: agg.batchStatus,
      completedScenarios: agg.completed,
      passedScenarios: agg.passed,
      failedScenarios: agg.failed,
      erroredScenarios: agg.errored,
      completedAt: isNowSettled ? new Date() : null,
    });

    if (isNowSettled && batch.status === "running") {
      await recordActivity(pool, ownerId, {
        projectId: batch.projectId,
        type: agg.passed === agg.total ? "simulation.completed" : "simulation.failed",
        summary: `Simulation batch "${batch.name}" finished: ${agg.passed}/${agg.total} scenarios passed`,
      });
    }

    const updatedBatch = (await repo.findBatch(pool, ownerId, batchId)) || batch;
    return { batch: updatedBatch, runs: updatedRuns, isSettled: isNowSettled };
  } catch (err: unknown) {
    logger.warn("Simulation polling attempt encountered error", { error: (err as Error).message });
    return { batch, runs: currentRuns, isSettled: false };
  }
}

/**
 * Retrieves a simulation batch with all its child run records.
 */
export async function getSimulationBatch(
  batchId: string,
  ctx?: SimulationContext,
): Promise<{ batch: SimulationBatchRecord; runs: SimulationRunRecord[] }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const batch = await repo.findBatch(pool, ownerId, batchId);
  if (!batch) throw new NotFoundError("Simulation batch not found.");

  const runs = await repo.listRunsForBatch(pool, ownerId, batchId);
  return { batch, runs };
}

/**
 * Lists historical simulation batches for a project.
 */
export async function listSimulationBatches(
  filter: { projectId?: string; targetAgentId?: string; status?: string; limit?: number },
  ctx?: SimulationContext,
): Promise<SimulationBatchRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repo.listBatches(pool, ownerId, filter);
}

/**
 * Retrieves an individual simulation run with detailed results.
 */
export async function getSimulationRun(
  runId: string,
  ctx?: SimulationContext,
): Promise<SimulationRunRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const run = await repo.findRun(pool, ownerId, runId);
  if (!run) throw new NotFoundError("Simulation run not found.");
  return run;
}

/**
 * Reruns a previously executed scenario as an intentional, fresh execution batch.
 * Preserves the historical run record and snapshot completely.
 */
export async function rerunSimulationRun(
  runId: string,
  ctx?: SimulationContext,
): Promise<{ batch: SimulationBatchRecord; runs: SimulationRunRecord[] }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const run = await repo.findRun(pool, ownerId, runId);
  if (!run) throw new NotFoundError("Simulation run not found.");
  if (!run.scenarioId) throw new ConflictError("Original scenario reference has been deleted.");

  return startSimulationBatch(
    {
      projectId: run.projectId,
      targetAgentId: run.targetAgentId,
      scenarioIds: [run.scenarioId],
      name: `Rerun: ${run.scenarioName} [${run.personaName}]`,
      repeatCount: 1,
    },
    ctx,
  );
}
