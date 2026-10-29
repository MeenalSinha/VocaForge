# Test strategy

| Layer | Tool | Command | Runs automatically | What it proves |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `npm test` | Yes | Config validation, schemas, log redaction, ElevenLabs request construction, error mapping, outcome classification, status mapping |
| Service and repository | Vitest + pg-mem | `npm test` | Yes | Project rules, owner scoping, activity, duplicate handling, LIKE escaping, failure mapping. pg-mem is an in-memory emulation, so it proves logic, not PostgreSQL behaviour |
| Real database | Vitest + PostgreSQL | `npm run test:db` | Opt-in via `TEST_DATABASE_URL` | The same suite against real PostgreSQL. The tables are created and dropped, so use a throwaway database |
| UI components | Testing Library + jsdom | `npm test` | Yes | Shell, navigation, accessibility wiring, forms, integration panel, future-section honesty |
| Browser | Playwright | `npm run test:e2e` | Opt-in | Create, list, refresh persistence, edit, archive. Needs a running app and database |
| Static | TypeScript, ESLint | `npm run typecheck`, `npm run lint` | Yes | Types and rules |
| Build | Next.js | `npm run build` | Yes | Production compile |
| Live integration | Script | `npm run elevenlabs:smoke` | Never. Requires `ELEVENLABS_SMOKE_OPT_IN=true` | Real ElevenLabs behaviour, billable |

Rules: test doubles live only under `tests/` and are named as such. Nothing that costs credits runs in `npm test`. CI (`.github/workflows/ci.yml`) runs everything except Playwright and the live smoke test, with a PostgreSQL service for `test:db`.

Known gaps: Playwright and the live ElevenLabs path have not been executed in the build environment (see the implementation report).
