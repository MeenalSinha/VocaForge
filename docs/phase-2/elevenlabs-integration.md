# ElevenLabs and generation integration

Documentation consulted on 2026-10-29. No call to the live APIs was made during this phase (no credentials, no network route). See `testing-report.md` for exactly what was executed.

## Endpoints used

| Purpose | Call |
| --- | --- |
| Auth check (Phase 0) | `GET /v1/convai/agents?page_size=1` |
| Create agent | `POST /v1/convai/agents/create` |
| Read agent | `GET /v1/convai/agents/{id}` |
| Update agent | `PATCH /v1/convai/agents/{id}` (partial `conversation_config`) |
| Delete agent | `DELETE /v1/convai/agents/{id}` |
| List voices | `GET /v2/voices` (`search`, `page_size`, `next_page_token`) |
| Preview voice | `POST /v1/text-to-speech/{voice_id}` (audio) |
| Live session | `GET /v1/convai/conversation/get-signed-url?agent_id=...` |
| Browser SDK | `@elevenlabs/react`: `ConversationProvider`, `useConversation`, `startSession({ signedUrl, connectionType: "websocket" })` |

All requests are server-side with the `xi-api-key` header. The browser only receives a short-lived signed URL.

## Remote resource handling (creation)
1. An `agent_operations` row is written first with the client's idempotency key (`pending`).
2. ElevenLabs is called once. Definite failures (missing credentials, 401, 403, 429, 4xx validation, unsupported) mark the operation `failed`: nothing was created and a new key may be used.
3. Uncertain outcomes (network error, timeout, 5xx, malformed response) mark it `unknown`. The request is never retried automatically and the same key is refused. The Agents page lists it under "Needs attention" with instructions to check ElevenLabs, then dismiss.
4. On success the returned id is stored on the operation (`remote_created`), then the agent row, version 1 and activity are written in one transaction and the operation becomes `completed`.
5. If the local write fails, the operation stays `remote_created` with the real remote id and a sanitized config snapshot. The user sees the id and a "Save to VocaForge" action reconciles it without calling ElevenLabs again. Replaying the same key does the same.
6. Agents rows exist only after a real remote id was returned; `remote_agent_id` is NOT NULL.

Concurrent duplicate submissions are serialised by a unique index on the idempotency key.

## Deletion
"Archive" is local and never touches ElevenLabs. "Delete from ElevenLabs" requires typing the agent name, sends DELETE, then reads the agent back and only records `remote_deleted` if ElevenLabs reports it as not found. If it still exists, the app says deletion is unconfirmed.

## Generation provider
`src/server/generation` defines `GenerationProvider`. The Anthropic implementation calls the Messages API with a forced tool call whose input schema is generated from the Zod draft schema, then the result is validated again by the server. Settings: `GENERATION_PROVIDER`, `ANTHROPIC_API_KEY`, `GENERATION_MODEL` (required, no default in code), `GENERATION_BASE_URL`, `GENERATION_TIMEOUT_MS`, `PROMPT_MAX_CHARS`. Failures (not configured, 401, 429, timeout, network, upstream, malformed, schema-invalid) are reported as errors. No configuration is ever returned unless the provider produced it and it passed validation. To add another provider, implement `generate()` and select it in `getProvider()`.

## Known uncertainties to confirm on the first real run
1. Field names in the `/v2/voices` response (`verified_languages`, `labels`, `preview_url`) are parsed loosely; unexpected shapes simply yield fewer details. The language filter only uses details the API returned.
2. Non-English agents may require a multilingual TTS model; set `ELEVENLABS_AGENT_TTS_MODEL` if creation is rejected.
3. PATCH is assumed to merge the provided `conversation_config` subset. `refresh` reads the agent back and reports any difference, so a different behaviour would be visible.
4. Deletion confirmation treats HTTP 404, 405 and 410 from the follow-up GET as "gone".
5. Message events from the SDK are read as `{ message, role }` (with `source` as a fallback).
6. Microphone permission and connection errors in the live session come from the SDK's `onError`; their wording was not observed.
