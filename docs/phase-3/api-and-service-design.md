# Phase 3 API and Service Architecture

## 1. Overview

Phase 3 introduces enterprise-grade REST endpoints and service workflows for managing Virtual Customer Personas, Test Scenarios, and Persona Templates.

All endpoints adhere to VocaForge's consistent HTTP conventions:
- Standardized response envelopes: `{ data: ... }` for success and `{ error: { code, message, fieldErrors } }` for failures.
- Strict tenant/owner scoping: all repository queries filter by `owner_id`.
- Referential integrity protection: deleting a persona that has associated test scenarios returns `409 Conflict`.
- Transactional persistence: updates, creations, and activity events execute within PostgreSQL transactions (`withTransaction`).

---

## 2. API Routes

### Personas (`/api/personas`)
- `GET /api/personas?projectId={id}&category={cat}&status={status}&search={q}`: List personas.
- `POST /api/personas`: Create a new persona.
- `GET /api/personas/[id]`: Retrieve single persona with readiness report and scenario count.
- `PUT /api/personas/[id]`: Update persona configuration and metadata.
- `DELETE /api/personas/[id]`: Delete persona (fails with 409 if scenarios exist).
- `POST /api/personas/[id]/duplicate`: Duplicate persona with `(Copy)` suffix.
- `POST /api/personas/[id]/archive`: Soft-archive persona.
- `POST /api/personas/generate`: AI-assisted persona generation from natural language prompt.
- `GET /api/personas/templates`: Retrieve curated starter persona templates.
- `GET /api/personas/stats?projectId={id}`: Summary statistics (total, ready, draft, needsConfig, archived).

### Scenarios (`/api/scenarios`)
- `GET /api/scenarios?projectId={id}&personaId={id}&priority={p}&status={s}&search={q}`: List scenarios.
- `POST /api/scenarios`: Create a new scenario.
- `GET /api/scenarios/[id]`: Retrieve single scenario with target agent and persona metadata.
- `PUT /api/scenarios/[id]`: Update scenario configuration.
- `DELETE /api/scenarios/[id]`: Delete scenario.
- `POST /api/scenarios/[id]/duplicate`: Duplicate scenario with `(Copy)` suffix.
- `POST /api/scenarios/[id]/archive`: Soft-archive scenario.

---

## 3. Database Schema (`0003_personas.sql`)

```sql
CREATE TABLE personas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id     text,
  name         varchar(120) NOT NULL,
  description  text,
  category     varchar(60) NOT NULL DEFAULT 'custom',
  template_id  varchar(80),
  status       varchar(24) NOT NULL DEFAULT 'draft',
  version      integer NOT NULL DEFAULT 1,
  config       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scenarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id        text,
  persona_id      uuid NOT NULL REFERENCES personas (id) ON DELETE RESTRICT,
  target_agent_id uuid REFERENCES agents (id) ON DELETE SET NULL,
  name            varchar(140) NOT NULL,
  description     text,
  status          varchar(24) NOT NULL DEFAULT 'draft',
  priority        varchar(20) NOT NULL DEFAULT 'medium',
  config          jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE persona_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  owner_id    text,
  name        varchar(120) NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE persona_collection_items (
  collection_id uuid NOT NULL REFERENCES persona_collections (id) ON DELETE CASCADE,
  persona_id    uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  scenario_id   uuid REFERENCES scenarios (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, persona_id)
);
```
