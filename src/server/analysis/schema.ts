import { z } from "zod";
import { FAILURE_CATEGORIES, type FailureCategory } from "./categories";
import { agentConfigSchema, type AgentConfig } from "../agents/config-schema";

export const FAILURE_SEVERITIES = ["critical", "major", "minor", "info"] as const;
export type FailureSeverity = (typeof FAILURE_SEVERITIES)[number];

export const FAILURE_CONFIDENCES = ["proven", "hypothesis", "inconclusive"] as const;
export type FailureConfidence = (typeof FAILURE_CONFIDENCES)[number];

export const PROPOSAL_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "applied_locally",
  "synced_remotely",
  "sync_failed",
  "superseded",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const REMOTE_SYNC_STATUSES = ["not_applied", "pending", "synced", "failed"] as const;
export type RemoteSyncStatus = (typeof REMOTE_SYNC_STATUSES)[number];

export const evidenceReferenceSchema = z.object({
  messageIndex: z.number().int().min(0).optional(),
  role: z.enum(["user", "agent", "system"]).optional(),
  excerpt: z.string().trim().min(1).max(1000),
  timeInCallSecs: z.number().optional(),
  note: z.string().trim().max(500).optional(),
});
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export interface FailureFindingRecord {
  id: string;
  runId: string;
  batchId: string;
  projectId: string;
  ownerId: string | null;
  targetAgentId: string;
  testedVersion: number;
  category: FailureCategory;
  severity: FailureSeverity;
  title: string;
  description: string;
  evidenceReferences: EvidenceReference[];
  expectedBehavior: string;
  observedBehavior: string;
  discrepancyExplanation: string;
  confidence: FailureConfidence;
  isActionable: boolean;
  suggestedAction: string;
  analysisMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FieldChange {
  path: string;
  label: string;
  before: string;
  after: string;
  explanation?: string;
}

export interface FixProposalRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  targetAgentId: string;
  sourceRunId: string;
  sourceFindingId: string;
  baseVersion: number;
  proposedConfig: AgentConfig;
  changeSummary: string;
  fieldChanges: FieldChange[];
  rationale: string;
  expectedImprovement: string;
  potentialRisks: string;
  status: ProposalStatus;
  rejectionReason: string | null;
  appliedAgentVersion: number | null;
  remoteSyncStatus: RemoteSyncStatus;
  remoteSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetestComparisonRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  fixProposalId: string;
  originalRunId: string;
  retestRunId: string;
  retestBatchId: string;
  testedAgentVersion: number;
  outcomeChanged: boolean;
  failureResolved: boolean;
  comparisonSummary: string;
  originalMetrics: Record<string, unknown>;
  retestMetrics: Record<string, unknown>;
  createdAt: string;
}

// Schemas for structured model generation
export const structuredFindingOutputSchema = z.object({
  category: z.enum(FAILURE_CATEGORIES),
  severity: z.enum(FAILURE_SEVERITIES),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(2000),
  evidenceReferences: z.array(evidenceReferenceSchema).default([]),
  expectedBehavior: z.string().trim().min(5).max(1000),
  observedBehavior: z.string().trim().min(5).max(1000),
  discrepancyExplanation: z.string().trim().min(10).max(1500),
  confidence: z.enum(FAILURE_CONFIDENCES).default("proven"),
  isActionable: z.boolean().default(true),
  suggestedAction: z.string().trim().min(5).max(1000),
});
export type StructuredFindingOutput = z.infer<typeof structuredFindingOutputSchema>;

export const structuredFixProposalOutputSchema = z.object({
  proposedConfig: agentConfigSchema,
  changeSummary: z.string().trim().min(10).max(500),
  rationale: z.string().trim().min(10).max(2000),
  expectedImprovement: z.string().trim().min(10).max(1000),
  potentialRisks: z.string().trim().min(5).max(1000),
});
export type StructuredFixProposalOutput = z.infer<typeof structuredFixProposalOutputSchema>;

// API Input Schemas
export const analyzeRunInputSchema = z.object({
  forceRegenerate: z.boolean().optional().default(false),
});
export type AnalyzeRunInput = z.infer<typeof analyzeRunInputSchema>;

export const rejectProposalInputSchema = z.object({
  reason: z.string().trim().max(1000).optional().default(""),
});
export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;

export const applyProposalInputSchema = z.object({
  reconcileStale: z.boolean().optional().default(false),
});
export type ApplyProposalInput = z.infer<typeof applyProposalInputSchema>;

export const retestProposalInputSchema = z.object({
  additionalScenarioIds: z.array(z.string().uuid()).max(10).optional().default([]),
});
export type RetestProposalInput = z.infer<typeof retestProposalInputSchema>;

