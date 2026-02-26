## Changes

<!-- Describe what changed and why -->

## Checklist

- [ ] Tests exist for new/changed behavior
- [ ] Dependencies injected (no singleton imports in logic)
- [ ] Files under 200 lines
- [ ] No `console.log` (use `fastify.log` in server)
- [ ] Contracts updated if API shape changed (`packages/shared`)
- [ ] Errors use `AppError` subclasses (not raw status codes)
- [ ] No raw SQL (use Drizzle query builder)
