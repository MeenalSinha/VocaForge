import { z } from "zod";

/** Request inputs. Supplied by the caller (smoke config, later the agent builder), never fabricated here. */
export const createAgentInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1),
  firstMessage: z.string().trim().optional(),
  language: z.string().trim().min(2).max(10).default("en"),
  llm: z.string().trim().min(1).optional(),
});
export type CreateAgentInput = z.input<typeof createAgentInputSchema>;

export const createSimulationTestInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scenario: z.string().trim().min(1),
  successConditions: z.array(z.string().trim().min(1)).min(1).max(10),
  maxTurns: z.number().int().min(1).max(50).default(5),
  evaluationModel: z.string().trim().min(1).optional(),
  simulatedUserModel: z.string().trim().min(1).optional(),
});
export type CreateSimulationTestInput = z.input<typeof createSimulationTestInputSchema>;

/** Response shapes. Deliberately loose: we require only the fields we rely on. */
export const agentCreatedSchema = z.object({ agent_id: z.string().min(1) }).passthrough();
export const testCreatedSchema = z.object({ id: z.string().min(1) }).passthrough();
export const objectSchema = z.object({}).passthrough();

export const testRunSchema = z
  .object({
    test_run_id: z.string().optional(),
    test_id: z.string().optional(),
    test_name: z.string().optional(),
    status: z.string().optional(),
    agent_responses: z.array(z.unknown()).nullish(),
    condition_result: z.object({ result: z.string().optional(), rationale: z.unknown().nullish() }).passthrough().nullish(),
  })
  .passthrough();

export const invocationSchema = z
  .object({ id: z.string().min(1), test_runs: z.array(testRunSchema).default([]) })
  .passthrough();

export type TestInvocation = z.infer<typeof invocationSchema>;
export type TestRun = z.infer<typeof testRunSchema>;

export const voiceSchema = z
  .object({
    voice_id: z.string().min(1),
    name: z.string().nullish(),
    category: z.string().nullish(),
    description: z.string().nullish(),
    preview_url: z.string().nullish(),
    labels: z.record(z.string(), z.unknown()).nullish(),
    verified_languages: z.array(z.object({ language: z.string().nullish(), locale: z.string().nullish(), accent: z.string().nullish() }).passthrough()).nullish(),
  })
  .passthrough();
export const voicesPageSchema = z
  .object({ voices: z.array(voiceSchema), has_more: z.boolean().nullish(), next_page_token: z.string().nullish(), total_count: z.number().nullish() })
  .passthrough();
export type RemoteVoice = z.infer<typeof voiceSchema>;
export type VoicesPage = z.infer<typeof voicesPageSchema>;

export const remoteAgentSchema = z
  .object({ agent_id: z.string().min(1), name: z.string().nullish(), conversation_config: z.record(z.string(), z.unknown()).nullish() })
  .passthrough();
export type RemoteAgent = z.infer<typeof remoteAgentSchema>;

export const signedUrlSchema = z.object({ signed_url: z.string().url() }).passthrough();

/** Remote agent configuration this app writes. Mirrors the documented conversation_config subset. */
export interface AgentRemotePayload {
  name: string;
  conversation_config: {
    agent: { language: string; first_message: string; prompt: { prompt: string; llm?: string } };
    tts?: { voice_id: string; model_id?: string; stability?: number; speed?: number; similarity_boost?: number };
  };
}
