---
name: DB composite tsconfig rebuild
description: After adding new tables to lib/db schema, TypeScript project-reference consumers get "no exported member" errors unless the DB package declarations are regenerated.
---

When new tables are added to `lib/db/src/schema/index.ts`, the TypeScript composite project emits `.d.ts` files into `lib/db/dist/`. These are what the API server's project references resolve at type-check time.

**Rule:** After any schema change, run:
```
cd lib/db && pnpm exec tsc --build
```

**Why:** The API server uses `"references": [{ "path": "../../lib/db" }]` in its tsconfig. TypeScript project references read `dist/*.d.ts`, not the source `.ts` directly. Without rebuilding, `tsc --noEmit` on the API server sees the stale declarations (missing the new tables) and throws `TS2305: Module has no exported member`.

**How to apply:** Any time you add/rename a schema table and then need to type-check the API server. The esbuild-based `pnpm run build` script bypasses TS project references so the server runs fine — this is a type-checking-only issue.
