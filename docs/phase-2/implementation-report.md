# Phase 2 implementation report

Date: 2026-10-29.

## 1. Audit of Phases 0 and 1
See `phase-0-1-audit.md`. One defect repaired (npm audit findings via an override). All earlier checks still pass.

## 2. What was built
Natural-language agent generation with structured validation; seven data-driven use-case starters; an editable configuration workspace with shared validation; real voice discovery, filtering, selection and text-to-speech preview through server routes; real agent creation with idempotency and distributed-failure recovery; agent library with a "Needs attention" list; agent details with save, versioned history, send to ElevenLabs, remote status refresh, archive and confirmed remote deletion; a live voice test page; plain-language refinement with a reviewable diff.

## 3. Principal files
`src/server/agents/*`, `src/server/generation/*`, `src/server/integrations/elevenlabs/{client,schemas}.ts` (extended), `src/server/db/migrations/0002_agents.sql`, `src/app/api/agents/**`, `src/app/api/voices/**`, `src/app/(app)/agents/**`, `src/components/agents/*`, `scripts/phase2-smoke.ts`, `scripts/generation-check.ts`, `tests/**`, `e2e/agents.spec.ts`, `docs/phase-2/*`.

## 4. Defects found and fixed during the work
1. Double-submit: the builder re-enabled the Create button after a successful response while navigating. Fixed; test made deterministic.
2. Refinement overwrote a capability's note or status because capabilities were regenerated. Fixed by merging existing entries.
3. Postgres rejected a reused parameter with mixed types in a CASE expression (found by the real-database run). Fixed.
4. pg-mem does not support aliased UPDATE targets (the UPDATE was rewritten without an alias, which is also valid on real PostgreSQL).
5. A test double that patched pooled clients leaked into later tests. Fixed by restoring on release.
6. The voice picker crashed on a malformed API response. Hardened.

## 5. Design decisions
Agents rows exist only after ElevenLabs returned an id. A creation ledger records every attempt. Uncertain outcomes are never retried. Capabilities cannot be marked available. Generation is a provider interface; no model name is in code.

## 6. Environment required
`DATABASE_URL`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `GENERATION_MODEL`; optional `ELEVENLABS_AGENT_LLM`, `ELEVENLABS_AGENT_TTS_MODEL`, `ELEVENLABS_PREVIEW_MODEL`, `PROMPT_MAX_CHARS`, `VOCAFORGE_ACCESS_TOKEN`.

## 7. Remaining issues and limitations
- No real ElevenLabs or model call was made; assumptions are listed in `elevenlabs-integration.md`.
- The live voice session, Playwright specs and mobile layouts are unverified.
- Knowledge-base upload and tool integrations are not implemented; capabilities stay unavailable.
- No user accounts; the project is still one shared workspace behind one token.
- Transcripts are not stored (by design; no privacy controls exist yet).
- Latency is not displayed because it cannot be measured reliably from the data the SDK exposes here.
- Voice list cache is in memory per server process (60 seconds).
- Archiving a project does not archive its agents; they remain in the library.
- No Git repository.

## 8. Completion checklist

### Agent creation
| Item | Status |
| --- | --- |
| Users can describe an agent in natural language | PASS (UI and API tested) |
| Configured provider produces a structured configuration | Implemented, tested with a test double and a local mock; live BLOCKED |
| Generated configuration is validated | PASS |
| Review and edit | PASS |
| Use-case starters work | PASS |
| Voice information comes from the integration | PASS in code and tests; live BLOCKED |
| Voice selection works | PASS (UI tested) |
| Actual ElevenLabs agent creation | Implemented and tested against fakes and a mock; live BLOCKED |
| Returned remote id saved correctly | PASS against fakes and mock |
| Agent can be reopened from the database | PASS (real PostgreSQL) |

### Voice interaction
| Item | Status |
| --- | --- |
| Live testing loads the correct saved agent | PASS (tested) |
| Supported ElevenLabs voice session works | BLOCKED (needs key and browser microphone) |
| Connection and microphone errors handled | PASS at the boundary (tested); wording from the SDK not observed |
| Actual conversation data used | PASS by construction: transcript only from SDK message events |
| No simulated conversation presented as real | PASS |

### Refinement
| Item | Status |
| --- | --- |
| Plain-language change requests | PASS (UI tested); live model BLOCKED |
| Proposed changes validated | PASS |
| Review and reject | PASS |
| Approved changes persist | PASS (real PostgreSQL) |
| Supported remote updates use the API | Implemented, tested with fakes and mock; live BLOCKED |
| Versions inspectable | PASS |
| Unsaved and unsynchronised changes identified | PASS |

### Engineering quality
| Item | Status |
| --- | --- |
| Phase 0 and 1 audits complete | PASS |
| Repairable earlier defects fixed | PASS |
| No hardcoded business data or fake integration results | PASS (starters hold general guidance only; test doubles live under `tests/` and the mock under `/tmp`, not in the project) |
| Secrets server-side | PASS |
| Migrations correct | PASS (applied to a database holding Phase 1 data; real-DB tests) |
| Important tests pass | PASS |
| Lint, type check, build | PASS |
| Documentation matches implementation | PASS |
| No dead buttons or misleading claims | PASS by inspection and tests |
| Starts using the documented instructions | PASS (`next dev` and `next start` exercised) |
| End-to-end browser test with real services | BLOCKED |
