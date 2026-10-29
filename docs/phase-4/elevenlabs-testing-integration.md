# ElevenLabs Agent Testing Integration (Phase 4)

## Overview

VocaForge Phase 4 integrates directly with the official **ElevenLabs Conversational AI Agent Testing API**.

Legacy endpoints (such as `/simulate-conversation`) are strictly avoided in favor of modern test provisioning and invocation management.

## Endpoint Mappings

| VocaForge Operation | ElevenLabs API Endpoint | Purpose |
|---------------------|-------------------------|---------|
| `createSimulationTest` | `POST /v1/convai/agent-testing/create` | Provisions a simulation test definition with scenario prompt, success conditions, and turn bounds. |
| `runTests` | `POST /v1/convai/agents/:agent_id/run-tests` | Triggers a test invocation for one or more test IDs against a specific remote voice agent. |
| `getTestInvocation` | `GET /v1/convai/test-invocations/:invocation_id` | Polls the live status, condition evaluation results, rationales, and conversation transcripts of an invocation. |
| `deleteTest` | `DELETE /v1/convai/agent-testing/:test_id` | Deletes a remote test definition (used for cleanup or smoke runs). |

## Data Mapping

### 1. Test Definition Payload (`CreateSimulationTestInput`)
- **Name:** `${scenario.name} [${persona.name}]` (capped at 100 characters).
- **Type:** `"simulation"`.
- **Simulation Scenario Prompt:**
  - Caller Persona background and roleplay instructions.
  - Emotional behavior rules (reaction to confusion, delays, repetition).
  - Knowledge level and information boundaries (explicitly withheld data).
  - Starting context (situation, initial caller opening utterance).
  - Mission objectives and behavioral rules.
- **Success Conditions:**
  - Positive criteria: Primary goals, expected outcomes, critical checkpoints.
  - Negative criteria: Prohibited outcomes, formatted as `The agent must not: <condition>`.
  - Condition count capped strictly between 1 and 10 items.
- **Simulation Max Turns:**
  - Clamped safely between 3 and 50 turns.

### 2. Invocation Polling & Status Normalization
Remote test runs return structured results:
```json
{
  "test_id": "test_abc123",
  "status": "success",
  "condition_result": {
    "result": "success",
    "rationale": "The agent acknowledged the downtime and issued the account credit."
  },
  "agent_responses": [
    { "role": "user", "message": "Hi, I need a credit for yesterday's downtime.", "time_in_call_secs": 1.2 },
    { "role": "agent", "message": "I understand and have applied a $50 credit to your balance.", "time_in_call_secs": 4.1 }
  ]
}
```

VocaForge normalizes `agent_responses` into `TranscriptMessage[]`:
- `role`: Standardized to `"user"`, `"agent"`, or `"system"`.
- `message`: Extracted cleanly.
- `timeInCallSecs`: Preserved for latency and pacing analysis.
- `toolCalls`: Preserved if the agent invoked tools during the simulation.
