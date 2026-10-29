# Testing report

Date: 2026-10-29. Environment: Node 22, PostgreSQL 16 (local), no ElevenLabs key, no generation key, no browser.

## Automated results (actual)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npx eslint .` | Clean |
| `npm test` | 17 files, 204 tests passed |
| `npm run test:db` (real PostgreSQL 16) | 2 files, 47 tests passed |
| `npx next build` | Passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run phase2:smoke`, `generation:check` without opt-in | Refused to run (exit 2), as designed |
| `npm run elevenlabs:check` without a key | `not_configured` |

## What each layer proves

| Layer | Tests | Proves | Does not prove |
| --- | --- | --- | --- |
| Config schema, prompt, diff, starters | `agent-config.test.ts` | Validation, capability handling, remote payload shape, version diff | ElevenLabs accepts the payload |
| Generation | `generation.test.ts` | Request to the provider is built correctly; invalid output rejected; provider failure never produces a configuration; different outputs give different configs; refinement preserves voice and capability notes | That a real model follows the instructions |
| ElevenLabs client | `elevenlabs-agents-client.test.ts` | Paths, bodies, headers, audio handling, key never leaks | That the live API responds as assumed |
| Agent service | `agents-suite.ts` on pg-mem and real PostgreSQL, with a fake remote | Creation, idempotency, concurrent duplicates, definite and uncertain failure, remote-created-but-not-saved recovery, versioning, concurrency conflict, sync success and failure, refresh, archive, confirmed remote delete, session URL, owner scoping | Real ElevenLabs behaviour |
| UI | `agents.test.tsx`, `live-test.test.tsx` | Prompt submission, review and edit, validation, voice list and errors, preview failure, refinement approve and reject, saved/unsaved/unsent states, delete confirmation, double-click protection, uncertain outcome handling, live session start with a server URL, transcript only from SDK events, microphone and connection errors | A real microphone session |
| End-to-end over HTTP | scripted (below) | The built app, real PostgreSQL, real HTTP clients and routes working together | Real ElevenLabs or model behaviour |

## End-to-end HTTP run against LOCAL MOCK servers
A small HTTPS server written for this check imitated the ElevenLabs and Anthropic endpoints (it is not either service; it validated only that required request fields existed). The production build ran against real PostgreSQL. Observed: two different prompts produced two different configurations; a requested "book appointments" capability came back `unavailable`; voices were listed and filtered; a preview returned audio; creation stored the remote id the mock returned and wrote version 1 as sent; replaying the same key returned the same agent and the mock saw exactly one create call; saving changed config produced version 2 and identical saves did not; a stale base version returned 409; sync marked version 2 sent; refresh reported a match; a refinement returned a before/after diff; a session URL was issued; deleting with the wrong name returned 422; deleting with the right name called DELETE then GET and recorded `remote_deleted`; session after delete returned 409; neither test key appeared in the server log.

## Not executed (BLOCKED)
- Any request to the real ElevenLabs API: voices, preview, create, read, update, delete, signed URL, and the smoke script `npm run phase2:smoke`.
- Any request to the real generation provider (`npm run generation:check`).
- A live voice session in a browser (microphone and SDK). Only the integration boundary is tested.
- Playwright specs `e2e/projects.spec.ts` and `e2e/agents.spec.ts` (no browser binary could be downloaded).
- Rendering at mobile widths.

## Evidence needed to unblock
`ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY` and `GENERATION_MODEL`, a browser with `npx playwright install chromium`, then: `npm run elevenlabs:check`, `ELEVENLABS_SMOKE_OPT_IN=true npm run phase2:smoke`, `GENERATION_SMOKE_OPT_IN=true npm run generation:check -- "<description>"`, and `npm run test:e2e`.
