# Requirements and phase boundaries

## Product

VocaForge lets a team create virtual customers who test a voice agent, collect evidence-backed findings, apply fixes, and rerun to verify. Lifecycle: create agent, create virtual customers, define scenarios, deploy, execute, analyse, fix, rerun, verify, deploy. The first release targets ElevenLabs voice agents. ArogyaDesk (a dental receptionist) is the demonstration use case and is intentionally not hardcoded anywhere: its policies, prices and personas will be user data.

## Phase map

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Requirements, architecture, data model, configuration, database connection, ElevenLabs proof of concept, test strategy | Delivered; ElevenLabs live execution blocked on credentials |
| 1 | App shell, design system, dashboard, projects CRUD with persistence, settings, honest future routes | Delivered |
| 2 | No-code agent builder, agent versions, ElevenLabs agent configuration, voices, live test, refinement | Delivered (live ElevenLabs verification blocked on credentials) |
| 3 | Virtual customer personas | Planned |
| 4 | Test Lab: scenarios, success criteria, simulation execution | Planned |
| 5 | Results: transcripts, verdicts, failure categories, metrics | Planned |
| 6 | Refinement and regression testing | Planned |
| 7 | Deployments and observability | Planned |
| Later | Browser-based application testing | Not scheduled |

Phase numbers 2 to 7 are this project's own roadmap, shown in the sidebar.

## Functional requirements for Phases 0 and 1

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| F1 | Validated server configuration | Missing or invalid variables are reported by name without values; unrelated features keep working |
| F2 | Database connectivity | Health endpoint runs a real query and compares applied migrations |
| F3 | Projects | Create, list, view, edit, archive, restore, search, filter; all persisted in PostgreSQL |
| F4 | Dashboard | Counts and activity come from the database; unavailable metrics are labelled as such |
| F5 | Integration status | ElevenLabs state comes from a real authenticated request, never from key presence |
| F6 | ElevenLabs service | Check auth, create agent, create and run simulation test, read result, classify outcome, clean up own resources |
| F7 | Errors | Sanitized messages to users, detail in server logs, no secrets in either |
| F8 | Navigation | Nine sections reachable; six are honest planned-feature pages |
| F9 | Access boundary | No user accounts, so an access token gates the app; production refuses to run open unless explicitly allowed |
| F10 | Quality gates | Type check, lint, unit, database and build checks documented and runnable |

## Out of scope in these phases

Persona generation, simulation scheduling, failure clustering, automated code changes, browser testing, telephony, observability analytics.

## Non-functional

Accessible by keyboard, visible focus, labelled fields, readable at mobile widths. No fabricated data anywhere in production code paths.
