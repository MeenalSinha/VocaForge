# ElevenLabs validation report

Date: 2026-10-28. **No call to the live ElevenLabs API was made.** The build environment had no `ELEVENLABS_API_KEY`, and its network policy does not allow elevenlabs.io. Everything below marked "unit tested" ran against a test double for `fetch`, which proves request construction and error handling, not that ElevenLabs accepts the requests.

## Documentation consulted (current at the date above)

- Create agent: `POST /v1/convai/agents/create`, body requires `conversation_config`, optional `name`; response `agent_id`.
- Create test: `POST /v1/convai/agent-testing/create`. Simulation variant takes `name`, `type: "simulation"`, `simulation_scenario`, `success_conditions[]`, `simulation_max_turns` (default 5), optional `evaluation_model`, `simulated_user_model`. Response `id`.
- Run tests: `POST /v1/convai/agents/{agent_id}/run-tests`, body `tests: [{ test_id }]`.
- Read result: `GET /v1/convai/test-invocations/{test_invocation_id}`; response has `id` and `test_runs[]` (each with a `status`).
- Delete test: `DELETE /v1/convai/agent-testing/{test_id}`. Delete agent: documented as "Delete agent" under agents.
- Authentication: header `xi-api-key`. Servers: `api.elevenlabs.io`, plus US, EU, India and Singapore residency hosts (configurable through `ELEVENLABS_API_BASE_URL`).

### Important finding

The endpoint `POST /v1/convai/agents/{agent_id}/simulate-conversation` (and its `/stream` variant) is marked **deprecated and will be removed on 31 October 2026**, three days after this report. The replacement is the agent-testing create plus run-tests workflow, which is what this integration uses. A build on the older endpoint would have broken immediately.

## Operations

| Operation | Implemented | Unit tested | Executed live |
| --- | --- | --- | --- |
| Missing credentials handled before any request | Yes | Yes | Not applicable |
| Authentication check (`GET /v1/convai/agents?page_size=1`) | Yes | Yes | **BLOCKED: no key** |
| Create agent | Yes | Yes | **BLOCKED** |
| Create simulation test | Yes | Yes | **BLOCKED** |
| Run test and poll invocation | Yes | Yes | **BLOCKED** |
| Classify outcome (passed, failed criteria, infrastructure error, pending, inconclusive) | Yes | Yes | **BLOCKED** |
| Delete own test and agent | Yes | Not directly | **BLOCKED** |
| Error mapping: 401, 403, 404/405/410, 422, 429 (with Retry-After), 5xx, network, timeout, non-JSON, wrong shape | Yes | Yes | Not applicable |

## Known uncertainties to confirm on the first real run

1. The auth check uses the agent list endpoint. A key limited to other permissions may get 403, which the app reports as "Permission denied" rather than "Authentication failed".
2. The exact `status` strings in `test_runs[]` were not readable in the documentation fetched. `simulation.ts` maps `pending/queued/running`, `passed/success`, `failed/failure`, `error/cancelled/timed_out`, and any other value becomes `inconclusive` (never success). If the first run shows a different vocabulary, update the three sets at the top of `simulation.ts`.
3. A run with status failed and no `condition_result` is classified as an infrastructure error. This is a heuristic: failure without an evaluation means the criteria were never judged.
4. Run-tests and test-invocation response fields beyond `id`, `test_runs`, `status`, `condition_result` are tolerated but not relied on.
5. Whether the account's plan includes agent testing, and its concurrency and credit limits, is unknown.

## How to produce the real evidence

```bash
cp .env.example .env.local                     # set ELEVENLABS_API_KEY
npm run elevenlabs:check                       # read-only, free
cp scripts/smoke/smoke.config.example.json scripts/smoke/smoke.config.json   # edit freely
ELEVENLABS_SMOKE_OPT_IN=true npm run elevenlabs:smoke
npm run elevenlabs:cleanup                     # deletes only what the smoke run recorded
```

The smoke script refuses to run without the opt-in flag, creates one agent and one test whose names start with `vocaforge-smoke-`, writes `.vocaforge/smoke-evidence-<time>.json` (ids and step results, no secrets) and records the created ids in `.vocaforge/smoke-resources.json`. Cleanup reads only that file, so it cannot delete an existing agent. Paste the evidence file contents into the table above and change BLOCKED to PASS or FAIL.
