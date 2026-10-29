# Baseline audit

Date: 2026-10-28. Method: direct inspection of the working directory before any change, then installation and tooling checks.

## What existed

No repository was available to this build. The only input was the Phase 0 and Phase 1 brief. The working directory was empty:

| Item | Finding |
| --- | --- |
| Git state | No repository, no commits, no uncommitted changes |
| Framework, package manager, language | None present. Chosen: Next.js 15 (App Router), TypeScript, npm |
| Database configuration and migrations | None |
| Existing tests, lint, type-check setup | None, so no pre-existing failures to report |
| Existing integrations | None |
| Deployment configuration | None |
| Security problems | None present. No code or secrets existed |
| Technical debt | None inherited |

Because nothing existed, the brief's rule "preserve a working implementation" had nothing to preserve and the recommended stack was adopted. If you already have a VocaForge repository, do not overwrite it. Merge `src/server`, `src/components`, `docs` and the scripts into it and reconcile `package.json`.

## Toolchain facts recorded at the start

- Node 22.22.2, npm 12.x.
- Prisma was deliberately not used. Prisma downloads native engine binaries at install time, which this build environment's network policy blocks, and it adds a generation step. Plain SQL migrations with the `pg` driver need no engines, are easy to review, and are fully testable. See `architecture.md` for the trade-off.
- Dependency versions installed: Next 15.5.x, React 19.x, Zod 4.x, Vitest 5.x, ESLint 9.x.
- `npm audit` was not run (it was disabled during install with `--no-audit`). Run it in your environment.

## Baseline check results

There was no baseline to run. All checks were first run after the implementation. See `docs/phase-1/implementation-report.md`.

## Addendum (2026-10-29)
A full audit of Phases 0 and 1 against the running application was done before Phase 2: see `docs/phase-2/phase-0-1-audit.md`. The `npm audit` gap noted above was closed (0 vulnerabilities).
