# Architecture

One Next.js application, one PostgreSQL database, one external integration. No extra services.

## Layers and responsibilities

| Layer | Location | Responsibility | Must not |
| --- | --- | --- | --- |
| User interface | `src/app`, `src/components` | Render state, collect input, call `/api` routes | Call ElevenLabs, touch the database directly from client code |
| Server pages | `src/app/(app)/*/page.tsx` | Read through application services and render | Contain SQL |
| API routes | `src/app/api` | Parse request, call a service, return the JSON envelope | Contain business rules |
| Application services | `src/server/projects/service.ts` | Validation, transactions, activity logging, error mapping | Know about HTTP |
| Database access | `src/server/projects/repository.ts`, `src/server/activity`, `src/server/db` | Parameterised SQL, owner scoping, migrations | Validate business input |
| External integration | `src/server/integrations/elevenlabs` | Typed calls to the documented REST API, error classification, outcome classification | Be imported by UI components |
| Generation | `src/server/generation` | Provider interface, structured generation and refinement, output validation | Return a configuration the model did not produce |
| Agent domain | `src/server/agents` | Configuration schema, prompt and remote payload, versions, creation ledger, sync, voices | Call the UI |
| Configuration | `src/server/config/env.ts` | Validate environment, never echo values | Substitute secrets |
| Error handling and logging | `src/server/errors.ts`, `logger.ts`, `http/respond.ts` | Stable error codes, redaction, uniform envelope | Return stack traces |
| Access boundary | `src/middleware.ts` | Token gate and production fail-closed rule | Pretend to be user authentication |
| Tests | `tests`, `e2e` | See `test-strategy.md` | |

Dependencies point downward only: UI, then routes, then services, then repositories and integrations.

## Decisions

- **Next.js route handlers instead of a separate backend.** One deployable unit; the brief warns against services without a responsibility.
- **Plain SQL migrations with `pg`, not Prisma.** The brief says Prisma "if compatible". Prisma needs engine downloads that were not possible in the build environment and adds a generate step. Cost of the choice: hand-written repository code. Benefit: no native engines, trivially testable, migrations are reviewable SQL. Moving to Prisma later only touches `repository.ts` files.
- **shadcn-style components, hand-written.** Same conventions (`components.json`, Radix primitives, `cva`) without running a generator. The `ui` folder is shadcn-compatible.
- **Archive instead of delete.** Archiving is reversible and keeps later foreign keys valid. Deletion is not offered.
- **Single shared workspace.** `owner_id` exists on every table and every query is scoped by it (NULL today). Adding authentication means supplying an owner id, not rewriting queries.
- **ElevenLabs simulation uses the agent-testing endpoints.** The older simulate-conversation endpoint is documented as deprecated and removed on 31 October 2026. See `elevenlabs-validation.md`.

## Authentication and authorization boundary

Phase 1 has no accounts. The only control is `VOCAFORGE_ACCESS_TOKEN` (HTTP Basic, token as password). Without it, `NODE_ENV=production` returns 503 for everything except `/api/health` unless `VOCAFORGE_ALLOW_UNAUTHENTICATED=true`. This stops accidental public exposure but is one shared secret, not per-user access. Do not run it as a multi-tenant service.

## Extension points for later phases

New domain entities get a folder under `src/server/<domain>` with `schema.ts`, `repository.ts`, `service.ts`, a migration, an API route, and a page. They reference `projects.id`. The ElevenLabs client already exposes the calls Phase 2 and 4 need.

Diagram: `architecture-diagram.mmd`.
