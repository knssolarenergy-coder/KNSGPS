---
name: OpenAPI spec is the source of truth for hooks AND types
description: Adding an Express route or a response field without updating openapi.yaml + rerunning codegen ships a latent runtime crash; how to keep spec/backend/client in sync.
---

# openapi.yaml drives both generated hooks and response/zod types

`lib/api-spec/openapi.yaml` is the single source of truth. `pnpm --filter @workspace/api-spec run codegen` (orval) generates the react-query hooks in `lib/api-client-react` AND the response/zod types. Skipping the spec update silently breaks the app.

- **Every new/changed Express route needs a matching openapi path + a codegen run.**
  **Why:** a feature shipped backend routes (`PUT /complaints/:id/technicians`, `PUT /site-visits/:id/technicians`) and admin UI hooks (`useAssignComplaintTechnicians`, `useAssignSiteVisitTechnicians`) but never updated the spec. The hooks were therefore never generated → the named import resolves to `undefined` → calling the hook crashes the screen on render (Metro bundles the missing import as undefined; it does not fail the build). The APK builds fine and breaks only at runtime.
  **How to apply:** after adding/altering any route, add/update its path in openapi.yaml and rerun codegen; then `tsc --noEmit` the consuming app — an undefined hook shows up as a missing-export TS error.

- **If the backend ALWAYS augments a response with a field (via a `withX` join helper), the schema must declare it — and `required` is a promise EVERY endpoint must keep.**
  **Why:** the backend adds `technicianIds` to complaint/site-visit responses via `withTechnicianIds` / `withTechnicianName`, but the schemas lacked it, so `obj.technicianIds.map(...)` failed to typecheck. After adding it as `required`, a legacy `PATCH /complaints/:id/status` route still returned the raw row (no `withTechnicianIds`), violating the now-required contract.
  **How to apply:** when you mark a field `required` on a shared response schema, audit every handler returning that type so none omit it; route any direct `res.json(row)` through the same `withX` helper.
