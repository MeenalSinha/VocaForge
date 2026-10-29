# VocaForge

Deploy virtual customers. Discover real problems. Launch with confidence.

VocaForge is a platform for testing voice agents with virtual customers. This repository contains the complete implementation through **Phase 4 (Simulation & Execution Engine)**: project management, ElevenLabs voice agent lifecycle & live testing, persona modeling, structured test scenario generation, automated batch simulation execution, and interactive Test Lab.

## Implemented now (Phases 0 to 4)

- **Test Lab & Simulation Engine (`/test-lab`)**:
  - Run real-world simulation batches deploying configured customer personas against synchronized ElevenLabs voice agents.
  - Multi-scenario batch selection, concurrency controls, and repeat execution parameters.
  - Comprehensive preflight checks inspecting agent sync status, scenario/persona readiness, and tool safety notices.
  - SHA-256 fingerprint caching in `remote_test_definitions` to avoid duplicate test creation on ElevenLabs.
  - Live progress monitoring with auto-polling every 3 seconds.
  - Interactive transcript drawer displaying complete conversation dialogue with speaker speech bubbles, timestamps, tool calls, and LLM judge evaluation rationales.
  - Defensively separates criteria evaluation failures (`failed_evaluation`) from infrastructure errors (`infrastructure_error` / `timed_out`).
  - Non-destructive scenario reruns preserving full historical execution evidence and immutable snapshots.
  - Past execution history table with pass rates and quick batch inspection.

- **Virtual Customer Studio (`/virtual-customers`)**:
  - Design realistic simulated caller personas with custom backgrounds, multi-dimensional personality traits (patience, assertiveness, familiarity), knowledge limits, and emotional response triggers.
  - Guided 6-step creation wizard with real-time configuration readiness analysis.
  - AI-assisted persona generation from natural language descriptions using configured model provider.
  - Curated catalogue of 10 starter customer archetypes across Customer Experience, Pricing & Policies, Communication, and Support.
  - Test scenario builder with concrete missions, success criteria, failure conditions, execution bounds, and target agent compatibility checking.
  - Persona and scenario duplication, soft-archiving, search, filtering, and aggregate statistics.
  - Referential integrity protection preventing accidental deletion of personas with active scenarios.

- **Agent Builder & Lifecycle (`/agents`)**:
  - Describe an assistant in plain language, generate a validated configuration with your configured model provider, edit it, choose a real ElevenLabs voice (with real text-to-speech preview), create a real ElevenLabs agent, reopen it from the library, talk to it live, refine it in plain language, and keep versioned history with explicit sent-to-ElevenLabs status.

- **Dashboard & Projects**:
  - Real project counts, aggregate persona statistics, persisted activity, and verified integration health.
  - Projects: create, list, view, edit, archive, restore, search, status filter.
- **Settings**: Database and migration status, ElevenLabs connection check.
- **ElevenLabs service**: Auth check, create agent, create and run a simulation test, read and classify the result.
- **Access-token gate, health endpoint, structured logging with redaction**.
- **Three future sections** (Results, Refinement, Deployments) shown as planned.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Radix UI, PostgreSQL via `pg` with SQL migrations, Zod, `@elevenlabs/react` (live voice), Anthropic Messages API (configuration generation, replaceable), Vitest, Testing Library, pg-mem (tests), Playwright.

## Folder layout

```
vocaforge/
  src/
    app/                       routes: (app)/dashboard, projects, settings, six planned sections; api/
    components/                layout/, ui/, projects/, integration-card.tsx
    lib/                       utils, navigation, browser API helper
    middleware.ts              access-token gate
    server/
      config/env.ts            validated environment
      db/                      pool, migration runner, migrations/0001_init.sql
      projects/                schema, repository, service
      activity/                activity repository
      agents/                  config schema, prompt + remote payload, starters, diff, repository, service, voices
      generation/              provider interface, Anthropic provider, generation + refinement service
      http/respond.ts          JSON envelope and error mapping
      integrations/elevenlabs/ client, schemas, errors, simulation, smoke, status
      errors.ts, logger.ts
  scripts/                     migrate, elevenlabs-check, elevenlabs-smoke, elevenlabs-cleanup, smoke/
  tests/                       unit/, integration/, ui/
  e2e/                         Playwright specs
  docs/phase-0/, docs/phase-1/
  docker-compose.yml, .env.example, .github/workflows/ci.yml
```

## Prerequisites

Node 20.12 or newer (22 recommended), npm, PostgreSQL 13 or newer (Docker is the easy route).

## Setup

```bash
npm install
cp .env.example .env.local        # then edit
docker compose up -d db           # optional local PostgreSQL matching .env.example
npm run db:migrate
npm run dev                       # http://localhost:3000
```

`npm run db:status` lists applied and pending migrations.

## Environment

See `.env.example`. `DATABASE_URL` is required for projects and the dashboard. `ELEVENLABS_API_KEY` is optional until you use the integration. `VOCAFORGE_ACCESS_TOKEN` gates the app with HTTP Basic auth (any username, token as password). In production the app returns 503 unless a token is set or `VOCAFORGE_ALLOW_UNAUTHENTICATED=true`. Secrets are read on the server only. Variables are never prefixed `NEXT_PUBLIC_`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit, service (pg-mem) and UI tests |
| `npm run test:db` | Service suite against real PostgreSQL (`TEST_DATABASE_URL`, tables are dropped) |
| `npm run test:e2e` | Playwright (run `npx playwright install chromium` first; needs a built app and database) |
| `npm run validate` | typecheck, lint, test, build |
| `npm run elevenlabs:check` | Read-only auth check |
| `npm run elevenlabs:smoke` | Billable proof of concept; needs `ELEVENLABS_SMOKE_OPT_IN=true` |
| `npm run elevenlabs:cleanup` | Delete only what the last smoke run created |
| `npm run phase2:smoke` | Billable Phase 2 proof against real ElevenLabs (create, read, update, session URL, delete its own agent); needs `ELEVENLABS_SMOKE_OPT_IN=true` and `scripts/smoke/agent-smoke.config.json` |
| `npm run generation:check -- "description"` | One real generation call; needs `GENERATION_SMOKE_OPT_IN=true` |

## Using the agent builder

1. Set `ANTHROPIC_API_KEY` and `GENERATION_MODEL` (generation) and `ELEVENLABS_API_KEY` (agents, voices, live test). Settings shows what is configured.
2. Create a project, then open Agents and choose New agent.
3. Describe the assistant, generate, review and edit, pick a voice, create.
4. Open the agent to talk to it, refine it, save versions, and send saved versions to ElevenLabs.

Details: `docs/phase-2/`.

## ElevenLabs setup

1. Create an API key at https://elevenlabs.io/app/settings/api-keys with agent and test permissions.
2. Put it in `.env.local` as `ELEVENLABS_API_KEY`; restart. Use `ELEVENLABS_API_BASE_URL` for a residency endpoint.
3. Open Settings and run the connection check, or `npm run elevenlabs:check`.
4. For the full proof of concept follow `docs/phase-0/elevenlabs-validation.md`.

Note: ElevenLabs removes the older simulate-conversation endpoint on 31 October 2026. This project already uses the agent-testing endpoints.

## Troubleshooting

- **Dashboard says workspace data is unavailable**: check `DATABASE_URL`, that PostgreSQL is running, and run `npm run db:migrate`. `/api/health` shows the exact state.
- **503 "VocaForge has no user accounts yet"**: production mode needs `VOCAFORGE_ACCESS_TOKEN` (or the explicit allow flag).
- **ElevenLabs "Permission denied"**: the key lacks agent read access or the plan excludes the Agents platform.
- **`process.loadEnvFile` error in scripts**: use Node 20.12 or newer.
- **Supabase**: use its connection string and set `DATABASE_SSL=require`.

## Current limitations

No user accounts (one shared workspace behind one token). Requested capabilities such as booking are recorded but unavailable; knowledge-file upload is not implemented. The live ElevenLabs and model-provider paths, the live voice session and Playwright specs were not executed in the build environment; see `docs/phase-2/testing-report.md`.

## Roadmap

Phase 3 virtual customers, 4 Test Lab, 5 Results, 6 Refinement and regression, 7 Deployments. Details in `docs/phase-0/requirements.md`.

## Documentation

`docs/phase-2`: audit of earlier phases, plan, agent configuration, integration, testing report, implementation report. `docs/phase-0`: baseline audit, requirements, architecture and diagram, data model, ElevenLabs validation, test strategy. `docs/phase-1`: UI architecture, implementation report.
