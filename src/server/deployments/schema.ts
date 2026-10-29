import { z } from "zod";

export const DEPLOYMENT_ENVIRONMENTS = ["production", "staging", "development"] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export const DEPLOYMENT_STATUSES = [
  "draft",
  "verifying",
  "ready_for_release",
  "publishing",
  "deployed",
  "failed",
  "rolled_back",
  "archived",
] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export interface ReadinessCheckItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  isBlocker: boolean;
}

export interface ReleaseReadinessSnapshot {
  isReady: boolean;
  score: number; // 0 to 100 percentage of criteria met
  testedRunsCount: number;
  passedRunsCount: number;
  passRatePercentage: number;
  hasCriticalFindings: boolean;
  unresolvedFindingsCount: number;
  isSyncedRemotely: boolean;
  checks: ReadinessCheckItem[];
  blockers: string[];
  warnings: string[];
  evaluatedAt: string;
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  agentId: string;
  agentName?: string;
  agentVersion: number;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  remoteAgentId: string | null;
  readinessSnapshot: ReleaseReadinessSnapshot;
  notes: string | null;
  previousDeploymentId: string | null;
  deployedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input schemas
export const createDeploymentInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  agentId: z.string().uuid("Invalid agent ID."),
  agentVersion: z.number().int().min(1, "Version must be positive."),
  environment: z.enum(DEPLOYMENT_ENVIRONMENTS).default("production"),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateDeploymentInput = z.infer<typeof createDeploymentInputSchema>;

export const promoteDeploymentInputSchema = z.object({
  forceDeploy: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional(),
});
export type PromoteDeploymentInput = z.infer<typeof promoteDeploymentInputSchema>;

export const rollbackInputSchema = z.object({
  targetVersion: z.number().int().min(1, "Target configuration version must be at least 1."),
  reason: z.string().trim().max(1000).optional().default("Manual rollback"),
  environment: z.enum(DEPLOYMENT_ENVIRONMENTS).default("production"),
});
export type RollbackInput = z.infer<typeof rollbackInputSchema>;
