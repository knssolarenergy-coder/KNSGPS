---
name: Drizzle push vs migrate for dev DB
description: Dev DB uses drizzle push (not migrate) for schema sync — __drizzle_migrations table does not exist
---

# Drizzle Push vs Migrate

## Rule
Always use `pnpm --filter @workspace/db run push` to sync schema changes to the dev DB. Do NOT rely on `pnpm --filter @workspace/db run migrate` for the dev DB.

**Why:** The dev DB tables were originally created via `drizzle push`, so the `__drizzle_migrations` tracking table (`__drizzle_migrations`) was never initialized. Even though the API server auto-runs the Drizzle migrator on startup and logs "Database migrations applied", new tables added via migration files are NOT actually created in the dev DB. Only `drizzle push` reliably syncs the schema.

**How to apply:** After adding a new table to `lib/db/src/schema/index.ts`, run:
```
pnpm --filter @workspace/db run push
```
This will detect schema drift and apply the missing CREATE TABLE statements.

## Migration files still needed
Keep writing migration SQL files (e.g. `lib/db/drizzle/0002_quotes.sql`) and updating `_journal.json` for production deployments, which use the migrator. But for dev, always use `drizzle push`.
