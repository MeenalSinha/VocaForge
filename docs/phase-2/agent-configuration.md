# Agent configuration

## One shape everywhere
`agentConfigSchema` (`src/server/agents/config-schema.ts`) is used by the generator, the editor (client side), the API (server side), the database and the ElevenLabs mapper.

| Section | Fields |
| --- | --- |
| identity | name (1-100), description (0-500), role (1-300) |
| behavior | purpose, goals (1-10), welcomeMessage, instructions (up to 6000), tone, responseStyle |
| knowledge | sources (up to 15), mustNotInvent (up to 15) |
| guardrails | prohibitedActions, restrictedInformation, escalationConditions, uncertaintyRules |
| language | primary (code such as `en`), additional (up to 10) |
| voice | voiceId, stability (0-1), speed (0.7-1.2); all optional |
| capabilities | name, description, status (`unavailable` or `needs_information`), note |

## What the generator may and may not set
The model returns a draft (`generatedDraftSchema`) with requested capabilities and open questions. It cannot set a voice or a capability status. The server sets status: every requested capability is `unavailable` (or `needs_information`) because no integration exists yet (`IMPLEMENTED_CAPABILITIES` is empty). The prompt composer then tells the agent plainly that it cannot do those things and must offer a human follow-up, so it does not claim to book appointments.

## Mapping to ElevenLabs (`buildRemotePayload`)
- `identity.name` becomes the agent name.
- `language.primary` becomes `conversation_config.agent.language`.
- `behavior.welcomeMessage` becomes `first_message`.
- Everything else (personality, goals, instructions, knowledge notes, never-invent rules, guardrails, escalation, unsure behaviour, unavailable capabilities, extra languages) is composed into `prompt.prompt`.
- `voice.voiceId`, `stability`, `speed` become `conversation_config.tts` (with `model_id` from `ELEVENLABS_AGENT_TTS_MODEL` when set). `ELEVENLABS_AGENT_LLM` sets `prompt.llm` when set.

## Not enforced technically
Additional languages are described in the prompt only. Guardrails and escalation are instructions to the model, not separate technical controls. Knowledge notes are descriptive; uploading documents is not implemented. The editor shows these limits.

## Versions
Every saved change creates an immutable `agent_versions` row with a summary generated from the field-level diff (or supplied by a refinement), a source (`created`, `manual_edit`, `refinement`) and a sync status (`not_synced`, `synced`, `failed`). Identical configurations never create a version. Saves use optimistic concurrency (`baseVersion`). `agents.synced_version` records which version ElevenLabs last accepted, so saved but unsent changes are always visible.
