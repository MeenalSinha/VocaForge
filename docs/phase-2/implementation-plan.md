# Phase 2 implementation plan (as executed)

Goal: describe an assistant in plain language, review and edit it, pick a real ElevenLabs voice, create a real agent, save it, talk to it, and refine it.

Order of work and what was built:

1. Audit Phases 0 and 1 and repair (see `phase-0-1-audit.md`).
2. Re-check the ElevenLabs documentation for create, update, get, delete, list voices, text to speech, signed URL, and the React SDK.
3. Data model: migration `0002_agents.sql` with `agents`, `agent_versions`, `agent_operations`.
4. Configuration schema, prompt composer, remote payload mapper, diff (`src/server/agents`).
5. Generation provider interface, Anthropic provider, generation and refinement services (`src/server/generation`).
6. Starters registry.
7. Agent service: creation with idempotency and recovery, versioned saves, sync, refresh, archive, remote delete, live session URL.
8. Voice service with caching and real text-to-speech preview.
9. API routes under `/api/agents` and `/api/voices`.
10. UI: builder, configuration editor, voice picker, refinement panel, library, details, live test.
11. Tests alongside each layer; end-to-end HTTP verification against the real app and database with local mock servers.
12. Documentation and ZIP.

Decisions: no new database layer or framework; one new runtime dependency (`@elevenlabs/react`) for the live session; the generation provider is an interface with one implementation; archive and remote delete are separate actions.

Out of scope: knowledge-base uploads, tool integrations (booking and similar), virtual customers, simulation execution, deployments, telephony. Phase 3 was not started.
