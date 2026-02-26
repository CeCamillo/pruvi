# Pruvi — Vestibular Prep App

## Stack

- **Mobile:** React Native 0.81 + Expo 54 + Expo Router 6 + HeroUI Native
- **Backend:** Fastify 5 + @fastify/type-provider-zod
- **DB:** PostgreSQL 17 + Drizzle ORM (PGLite for tests)
- **Cache:** Redis 7 + ioredis
- **Queue:** BullMQ 5
- **Auth:** Better-Auth + @better-auth/expo
- **Testing:** Vitest + PGLite (DB), Testing Library (UI)
- **Monorepo:** pnpm workspaces + Turborepo

## Architecture

```
apps/native       → Expo mobile app (Expo Router, file-based routing)
apps/server       → Fastify API (features/, queues/, redis/)
packages/auth     → Better-Auth config (already wired)
packages/db       → Drizzle schema + migrations + test-client
packages/env      → Zod-validated env vars (@t3-oss/env-core)
packages/shared   → Zod contracts (E2E type-safe API types)
packages/config   → Shared tsconfig
```

## Task Source

GitHub Issues on `CeCamillo/pruvi`. Priority: `bug` > `tracer-bullet` > `feature` > `polish` > `refactor`.

## Conventions

- **Files:** kebab-case (`review-logs.ts`, not `reviewLogs.ts`)
- **Exports:** Named exports only (no `export default` except Expo Router pages)
- **Tests:** Colocated in `__tests__/` directories next to source
- **API routes:** Feature folders under `apps/server/src/features/`
- **Schema:** One file per table in `packages/db/src/schema/`
- **Contracts:** Zod schemas in `packages/shared/src/` matching feature names
- **Commits:** `RALPH: <type>: <description> (Issue #NNN)` for RALPH, conventional commits for humans

## Commands

```bash
pnpm dev              # Start all apps (turbo)
pnpm dev:native       # Expo dev server
pnpm dev:server       # Fastify dev server
pnpm test             # Vitest run (all workspaces)
pnpm test:watch       # Vitest watch mode
pnpm typecheck        # tsc -b across all workspaces
pnpm lint             # ESLint flat config
pnpm format           # Prettier write
pnpm format:check     # Prettier check
pnpm db:generate      # Drizzle generate migrations
pnpm db:push          # Drizzle push schema to DB
pnpm db:migrate       # Drizzle run migrations
pnpm db:studio        # Drizzle Studio GUI
pnpm db:start         # docker compose up -d
pnpm db:stop          # docker compose stop
```

## Quality Gates

### Pre-commit (local)

All 3 must pass. No `--no-verify`.

1. `pnpm exec lint-staged` — Prettier on staged files
2. `pnpm typecheck` — tsc -b
3. `pnpm test` — Vitest

### CI (on every PR to main)

1. `pnpm typecheck`
2. `pnpm test:coverage` — Vitest + v8 coverage
3. `pnpm lint` — ESLint strictTypeChecked
4. `pnpm format:check` — Prettier

## Database

5 domain tables: `subject`, `question`, `review_log`, `daily_session`
4 auth tables (Better-Auth): `user`, `session`, `account`, `verification`

Services receive `db` as dependency injection for testability.
Tests use PGLite via `packages/db/src/test-client.ts`.

## Error Handling

Throw `AppError` subclasses (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) from `apps/server/src/errors.ts`. Never set status codes directly in route handlers — the Fastify error handler plugin converts errors to structured JSON automatically.

## Branch Workflow

- **RALPH:** `ralph/<issue>-<slug>` branches, always via PR, never merge own PR
- **Human:** `feature/*` branches, all via PR
- Never push directly to main

## Reviewing RALPH PRs

1. Dependencies injected (no singleton imports in logic)
2. Tests exist for new/changed behavior
3. Routes are thin — logic lives in services
4. Files under 200 lines
5. Contracts updated if API shape changed (`packages/shared`)
6. Errors use `AppError` subclasses
7. No raw SQL (use Drizzle query builder)
8. No `console.log` (use `fastify.log` in server)

## Transactions

Use `db.transaction()` for multi-write operations and read-then-write patterns to prevent race conditions.

## Skills

- `do-work` — 4-phase autonomous workflow (Explore → Implement → Feedback Loops → Branch, PR & Close)
- `do-work/DB-TDD` — Drizzle + PGLite TDD pattern
- `do-work/FRONTEND-TDD` — React Native reducer TDD pattern
- `do-work/QUEUE-TDD` — BullMQ processor TDD pattern
