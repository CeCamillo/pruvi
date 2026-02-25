# Do Work — 4-Phase Autonomous Workflow

## Phase 1: Explore

1. Read the assigned GitHub issue thoroughly
2. Search the codebase to understand existing patterns
3. Identify which files need to be created or modified
4. If the task is too large for a single iteration:
   - Stop and say "HANG ON A SECOND"
   - Break it into sub-tasks
   - Comment the sub-tasks on the issue
   - Pick the first sub-task and continue

## Phase 2: Implement

Route to the correct TDD sub-skill based on what you're touching:

| What you're changing               | Sub-skill                             |
| ---------------------------------- | ------------------------------------- |
| Database schema, services, queries | `do-work/DB-TDD`                      |
| React Native state, reducers       | `do-work/FRONTEND-TDD`                |
| BullMQ workers, processors         | `do-work/QUEUE-TDD`                   |
| Pure functions, utilities          | Standard red-green-refactor           |
| API routes (Fastify handlers)      | Write handler, test via service layer |

**Rules:**

- One test at a time: RED → GREEN → next test
- Services receive `db` (and `redis` if needed) as arguments (DI)
- Never import singletons in test files — always inject dependencies
- Keep files under 200 lines; split if growing

## Phase 3: Feedback Loops

Run these sequentially. Fix each before moving to the next. Do NOT commit until all pass.

```bash
pnpm format
pnpm typecheck
pnpm test
pnpm lint
```

If a step fails:

1. Read the error carefully
2. Fix the issue
3. Re-run from that step
4. Do NOT skip ahead

## Phase 4: Commit & Close

1. Stage changed files: `git add <specific files>`
2. Commit with message: `RALPH: <type>: <description> (Issue #NNN)`
   - Types: `feat`, `fix`, `refactor`, `test`, `chore`
3. Push: `git push`
4. Close the issue: `gh issue close <NNN> --comment "Implemented in <commit-sha>"`
5. Update `progress.txt` with what was done

## Important

- Never use `--no-verify` on commits
- Never commit failing code
- If stuck after 3 attempts, leave a comment on the issue explaining the blocker and move on
- Always check `progress.txt` at the start for context from previous sessions
