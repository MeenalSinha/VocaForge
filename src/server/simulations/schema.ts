import { z } from "zod";
import type { PersonaConfig, ScenarioConfig } from "../personas/schema";

export const BATCH_STATUSES = [
  "queued",
  "preparing",
  "running",
  "completed",
  "completed_with_failures",
  "failed",
  "infrastructure_error",
  "timed_out",
  "cancelled",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const RUN_STATUSES = [
  "pending",
  "running",
  "passed",
  "failed_evaluation",
  "infrastructure_error",
  "timed_out",
  "inconclusive",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const EVALUATION_RESULTS = ["passed", "failed", "inconclusive", "error"] as const;
export type EvaluationResult = (typeof EVALUATION_RESULTS)[number];

export const transcriptMessageSchema = z.object({
  role: z.enum(["user", "agent", "system"]),
  message: z.string().default(""),
  timeInCallSecs: z.number().optional(),
  toolCalls: z.array(z.unknown()).optional(),
});
export type TranscriptMessage = z.infer<typeof transcriptMessageSchema>;

export interface SimulationMetrics {
  latencyMs?: number;
  turnsCount?: number;
  creditUsage?: number;
  durationSecs?: number;
}

export interface SimulationBatchRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  targetAgentId: string;
  remoteAgentId: string;
  name: string;
  status: BatchStatus;
  totalScenarios: number;
  completedScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  erroredScenarios: number;
  remoteInvocationId: string | null;
  executionOptions: {
    repeatCount?: number;
    concurrency?: number;
    [key: string]: unknown;
  };
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationRunRecord {
  id: string;
  batchId: string;
  projectId: string;
  ownerId: string | null;
  targetAgentId: string;
  scenarioId: string | null;
  personaId: string | null;
  scenarioName: string;
  personaName: string;
  scenarioSnapshot: ScenarioConfig;
  personaSnapshot: PersonaConfig;
  remoteTestId: string | null;
  remoteTestRunId: string | null;
  remoteInvocationId: string | null;
  status: RunStatus;
  evaluationResult: EvaluationResult | null;
  evaluationRationale: string | null;
  transcript: TranscriptMessage[];
  rawResult: Record<string, unknown> | null;
  metrics: SimulationMetrics;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteTestDefinitionRecord {
  id: string;
  projectId: string;
  scenarioId: string;
  personaId: string;
  configHash: string;
  remoteTestId: string;
  createdAt: string;
  updatedAt: string;
}

export const startSimulationInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  targetAgentId: z.string().uuid("Invalid agent ID."),
  scenarioIds: z.array(z.string().uuid()).min(1, "Select at least one scenario to execute.").max(20),
  name: z.string().trim().max(160).optional(),
  repeatCount: z.number().int().min(1).max(5).default(1),
  concurrency: z.number().int().min(1).max(5).default(1),
});
export type StartSimulationInput = z.infer<typeof startSimulationInputSchema>;

export const preflightCheckInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  targetAgentId: z.string().uuid("Invalid agent ID."),
  scenarioIds: z.array(z.string().uuid()).min(1, "Select at least one scenario to check.").max(20),
});
export type PreflightCheckInput = z.infer<typeof preflightCheckInputSchema>;

export interface PreflightItemWarning {
  scenarioId: string;
  scenarioName: string;
  personaName: string;
  isReady: boolean;
  warnings: string[];
  blockers: string[];
}

export interface PreflightCheckResult {
  canExecute: boolean;
  targetAgent: {
    id: string;
    name: string;
    remoteAgentId: string;
    primaryLanguage: string;
    declaredCapabilities: string[];
  };
  totalScenarios: number;
  readyScenarios: number;
  scenarios: PreflightItemWarning[];
  toolSafetyNotice: {
    hasTools: boolean;
    toolNames: string[];
    consequentialRiskWarning: string | null;
  };
  summaryBlockers: string[];
  summaryWarnings: string[];
}
