import type { Pool } from "pg";
import { getPool } from "../db/pool";
import { recordActivity } from "../activity/repository";
import { findAgent } from "../agents/repository";
import { saveAgentConfig, syncAgent, type AgentContext } from "../agents/service";
import {
  findRun,
} from "../simulations/repository";
import {
  startSimulationBatch,
  type SimulationRemote,
} from "../simulations/service";
import * as repo from "./repository";
import { analyzeSimulationRun } from "./analyzer";
import { generateRemediationFix } from "./fix-generator";
import { evaluateOutcomeProof, type OutcomeProofResult } from "./outcome-proof";
export { evaluateOutcomeProof, type OutcomeProofResult } from "./outcome-proof";
import type { GenerationProvider } from "../generation/provider";
import { getProvider } from "../generation/service";
import type {
  FailureFindingRecord,
  FixProposalRecord,
  ProposalStatus,
  RemoteSyncStatus,
  RetestComparisonRecord,
} from "./schema";
import { ConflictError, NotFoundError } from "../errors";
import { logger } from "../logger";

export interface AnalysisContext {
  store?: Pool;
  ownerId?: string | null;
  generationProvider?: GenerationProvider;
  simulationRemote?: SimulationRemote;
  agentRemote?: NonNullable<AgentContext["remote"]>;
}

const poolOf = (c?: AnalysisContext) => c?.store ?? getPool();
const ownerOf = (c?: AnalysisContext) => c?.ownerId ?? null;

/**
 * Initiates failure analysis on a completed simulation run.
 */
export async function analyzeRun(
  runId: string,
  options?: { forceRegenerate?: boolean },
  ctx?: AnalysisContext,
): Promise<FailureFindingRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const provider = ctx?.generationProvider ?? getProvider();

  const run = await findRun(pool, ownerId, runId);
  if (!run) throw new NotFoundError("Simulation run not found.");

  // Check for existing findings unless force regeneration requested
  const existing = await repo.findFindingsByRunId(pool, ownerId, runId);
  if (existing.length > 0 && !options?.forceRegenerate) {
    return existing;
  }

  const agent = await findAgent(pool, ownerId, run.targetAgentId);
  if (!agent) throw new NotFoundError("Target agent not found.");

  // Run the analysis engine
  const findingDraft = await analyzeSimulationRun(run, agent, provider);

  if (options?.forceRegenerate && existing.length > 0) {
    await repo.deleteFindingsByRunId(pool, ownerId, runId);
  }

  const finding = await repo.insertFinding(pool, ownerId, findingDraft);

  await recordActivity(pool, ownerId, {
    projectId: run.projectId,
    type: "agent.updated",
    summary: `Analyzed failure for scenario "${run.scenarioName}": ${finding.title}`,
  });

  return [finding];
}

/**
 * Retrieves existing failure findings for a simulation run.
 */
export async function getFindingsForRun(
  runId: string,
  ctx?: AnalysisContext,
): Promise<FailureFindingRecord[]> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repo.findFindingsByRunId(pool, ownerId, runId);
}

/**
 * Generates an AI-assisted fix proposal for a specific failure finding.
 */
export async function createFixProposal(
  findingId: string,
  ctx?: AnalysisContext,
): Promise<FixProposalRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const provider = ctx?.generationProvider ?? getProvider();

  const finding = await repo.findFindingById(pool, ownerId, findingId);
  if (!finding) throw new NotFoundError("Failure finding not found.");

  // Check if a pending proposal for this finding already exists
  const existing = await repo.findFixProposalsByFindingId(pool, ownerId, findingId);
  const pending = existing.find((p) => p.status === "pending_review" || p.status === "approved");
  if (pending) {
    return pending;
  }

  const run = await findRun(pool, ownerId, finding.runId);
  if (!run) throw new NotFoundError("Source simulation run not found.");

  const agent = await findAgent(pool, ownerId, finding.targetAgentId);
  if (!agent) throw new NotFoundError("Target voice agent not found.");

  const proposalDraft = await generateRemediationFix(finding, run, agent, provider);

  const proposal = await repo.insertFixProposal(pool, ownerId, proposalDraft);

  await recordActivity(pool, ownerId, {
    projectId: proposal.projectId,
    type: "fix_proposal.created",
    summary: `Generated AI fix proposal for "${agent.name}": ${proposal.changeSummary}`,
  });

  return proposal;
}

/**
 * Retrieves a fix proposal by ID.
 */
export async function getFixProposal(
  proposalId: string,
  ctx?: AnalysisContext,
): Promise<FixProposalRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");
  return proposal;
}

/**
 * Approves a fix proposal.
 */
export async function approveFixProposal(
  proposalId: string,
  ctx?: AnalysisContext,
): Promise<FixProposalRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");
  if (proposal.status !== "pending_review") {
    throw new ConflictError(`Proposal cannot be approved from current status "${proposal.status}".`);
  }

  const updated = await repo.updateFixProposalStatus(pool, ownerId, proposalId, {
    status: "approved",
  });

  await recordActivity(pool, ownerId, {
    projectId: proposal.projectId,
    type: "fix_proposal.approved",
    summary: `Approved fix proposal: ${proposal.changeSummary}`,
  });

  return updated;
}

/**
 * Rejects a fix proposal with an optional explanation.
 */
export async function rejectFixProposal(
  proposalId: string,
  rejectionReason: string = "",
  ctx?: AnalysisContext,
): Promise<FixProposalRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");

  const updated = await repo.updateFixProposalStatus(pool, ownerId, proposalId, {
    status: "rejected",
    rejectionReason: rejectionReason || "Rejected by user.",
  });

  await recordActivity(pool, ownerId, {
    projectId: proposal.projectId,
    type: "fix_proposal.rejected",
    summary: `Rejected fix proposal: ${proposal.changeSummary}`,
  });

  return updated;
}

/**
 * Applies an approved fix proposal to the agent, creating a new version and syncing with ElevenLabs.
 */
export async function applyFixProposal(
  proposalId: string,
  options?: { reconcileStale?: boolean },
  ctx?: AnalysisContext,
): Promise<{ proposal: FixProposalRecord; newVersion: number }> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");

  if (proposal.status !== "approved" && proposal.status !== "pending_review") {
    throw new ConflictError(`Proposal cannot be applied from status "${proposal.status}".`);
  }

  const agent = await findAgent(pool, ownerId, proposal.targetAgentId);
  if (!agent) throw new NotFoundError("Target voice agent not found.");

  // Concurrency and stale change detection
  if (agent.configVersion !== proposal.baseVersion && !options?.reconcileStale) {
    throw new ConflictError(
      `Agent has been modified (current v${agent.configVersion}) since this fix proposal was created (base v${proposal.baseVersion}). Please review and reconcile before applying.`,
    );
  }

  const agentCtx: AgentContext = {
    store: pool,
    ownerId,
    remote: ctx?.agentRemote,
  };

  // 1. Save new configuration version locally
  const saveResult = await saveAgentConfig(
    agent.id,
    {
      config: proposal.proposedConfig,
      baseVersion: agent.configVersion,
      source: "fix_proposal",
      summary: proposal.changeSummary,
    },
    agentCtx,
  );

  const newVersion = saveResult.agent.configVersion;
  let remoteSyncStatus: RemoteSyncStatus = "not_applied";
  let remoteSyncError: string | null = null;
  let finalProposalStatus: ProposalStatus = "applied_locally";

  // 2. Synchronize with ElevenLabs if agent has a remote agent ID
  if (saveResult.agent.remoteAgentId) {
    try {
      await syncAgent(agent.id, agentCtx);
      remoteSyncStatus = "synced";
      finalProposalStatus = "synced_remotely";
    } catch (err: unknown) {
      logger.error("Failed to sync approved proposal to ElevenLabs", { error: (err as Error).message });
      remoteSyncStatus = "failed";
      remoteSyncError = (err as Error).message || "Remote synchronization failed.";
      finalProposalStatus = "sync_failed";
    }
  }

  // 3. Update proposal record
  const updatedProposal = await repo.updateFixProposalStatus(pool, ownerId, proposal.id, {
    status: finalProposalStatus,
    appliedAgentVersion: newVersion,
    remoteSyncStatus,
    remoteSyncError,
  });

  await recordActivity(pool, ownerId, {
    projectId: proposal.projectId,
    type: "fix_proposal.applied",
    summary: `Applied fix proposal to "${agent.name}" as version ${newVersion} (${remoteSyncStatus})`,
  });

  return { proposal: updatedProposal, newVersion };
}

/**
 * Triggers a targeted retest of an applied fix proposal, running the original scenario and comparing results.
 */
export async function retestFixProposal(
  proposalId: string,
  additionalScenarioIds: string[] = [],
  ctx?: AnalysisContext,
): Promise<{
  retestBatchId: string;
  originalRun: ReturnType<typeof findRun> extends Promise<infer T> ? T : never;
  proposal: FixProposalRecord;
}> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");

  if (
    proposal.status !== "applied_locally" &&
    proposal.status !== "synced_remotely" &&
    proposal.status !== "sync_failed"
  ) {
    throw new ConflictError(
      `Cannot retest proposal with status "${proposal.status}". Apply the fix first.`,
    );
  }

  const originalRun = await findRun(pool, ownerId, proposal.sourceRunId);
  if (!originalRun) throw new NotFoundError("Original simulation run not found.");
  if (!originalRun.scenarioId) {
    throw new ConflictError("Original scenario has been deleted and cannot be retested.");
  }

  // Combine original scenario with any chosen regression scenarios
  const scenarioIdsToTest = Array.from(
    new Set([originalRun.scenarioId, ...additionalScenarioIds]),
  );

  const simCtx = {
    store: pool,
    ownerId,
    remote: ctx?.simulationRemote,
  };

  const { batch } = await startSimulationBatch(
    {
      projectId: proposal.projectId,
      targetAgentId: proposal.targetAgentId,
      scenarioIds: scenarioIdsToTest,
      name: `Retest: ${proposal.changeSummary.slice(0, 50)}`,
      repeatCount: 1,
    },
    simCtx,
  );

  return {
    retestBatchId: batch.id,
    originalRun,
    proposal,
  };
}

/**
 * Generates and stores a before-and-after comparison between original run and completed retest run.
 */
export async function buildAndStoreComparison(
  proposalId: string,
  originalRunId: string,
  retestRunId: string,
  ctx?: AnalysisContext,
): Promise<RetestComparisonRecord> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const originalRun = await findRun(pool, ownerId, originalRunId);
  if (!originalRun) throw new NotFoundError("Original simulation run not found.");

  const retestRun = await findRun(pool, ownerId, retestRunId);
  if (!retestRun) throw new NotFoundError("Retest simulation run not found.");

  const proposal = await repo.findFixProposalById(pool, ownerId, proposalId);
  if (!proposal) throw new NotFoundError("Fix proposal not found.");

  const outcomeChanged = originalRun.status !== retestRun.status;
  const failureResolved =
    originalRun.status !== "passed" && retestRun.status === "passed";

  let comparisonSummary = "";
  if (failureResolved) {
    comparisonSummary = `Fixed! Retest passed evaluation criteria (from ${originalRun.status} to ${retestRun.status}).`;
  } else if (retestRun.status === originalRun.status) {
    comparisonSummary = `Failure persists: Retest still resulted in ${retestRun.status}.`;
  } else {
    comparisonSummary = `Outcome changed from ${originalRun.status} to ${retestRun.status}.`;
  }

  const comparison = await repo.insertRetestComparison(pool, ownerId, {
    projectId: originalRun.projectId,
    fixProposalId: proposal.id,
    originalRunId: originalRun.id,
    retestRunId: retestRun.id,
    retestBatchId: retestRun.batchId,
    testedAgentVersion: proposal.appliedAgentVersion || 1,
    outcomeChanged,
    failureResolved,
    comparisonSummary,
    originalMetrics: {
      status: originalRun.status,
      evaluationResult: originalRun.evaluationResult,
      turnsCount: originalRun.transcript.length,
      rationale: originalRun.evaluationRationale,
    },
    retestMetrics: {
      status: retestRun.status,
      evaluationResult: retestRun.evaluationResult,
      turnsCount: retestRun.transcript.length,
      rationale: retestRun.evaluationRationale,
    },
  });

  await recordActivity(pool, ownerId, {
    projectId: originalRun.projectId,
    type: "fix_proposal.retested",
    summary: `Verified fix proposal via retest: ${comparisonSummary}`,
  });

  return comparison;
}

/**
 * Retrieves the comparison record for a proposal or run.
 */
export async function getComparisonForRun(
  runId: string,
  ctx?: AnalysisContext,
): Promise<RetestComparisonRecord | null> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);
  return repo.findComparisonByRunId(pool, ownerId, runId);
}

/**
 * Retrieves all failure findings, fix proposals, and retest comparisons for a project.
 */
export async function getRefinementDataForProject(
  projectId: string,
  ctx?: AnalysisContext,
): Promise<{
  findings: FailureFindingRecord[];
  proposals: FixProposalRecord[];
  comparisons: RetestComparisonRecord[];
  unanalyzedRuns: repo.UnanalyzedRunItem[];
}> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const [findings, proposals, comparisons, unanalyzedRuns] = await Promise.all([
    repo.findFindingsByProjectId(pool, ownerId, projectId),
    repo.findFixProposalsByProjectId(pool, ownerId, projectId),
    repo.findComparisonsByProjectId(pool, ownerId, projectId),
    repo.findUnanalyzedFailedRunsByProjectId(pool, ownerId, projectId),
  ]);

  return { findings, proposals, comparisons, unanalyzedRuns };
}

/**
 * Evaluates the 3-layer deterministic Outcome Proof for an individual simulation run.
 */
export async function getOutcomeProofForRun(
  runId: string,
  ctx?: AnalysisContext,
): Promise<OutcomeProofResult | null> {
  const pool = poolOf(ctx);
  const ownerId = ownerOf(ctx);

  const run = await findRun(pool, ownerId, runId);
  if (!run) throw new NotFoundError("Simulation run not found.");

  return evaluateOutcomeProof({
    transcript: run.transcript,
    scenarioSnapshot: run.scenarioSnapshot,
    rawResult: run.rawResult,
  });
}
