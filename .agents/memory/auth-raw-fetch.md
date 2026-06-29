---
name: Auth flow bypasses the custom-fetch mutator
description: Why login/auth screens need their own defensive JSON parsing, and the meaning of the "Unexpected end of JSON input" error
---

# Auth flow uses raw fetch, not the generated API client

The auth flow (`context/AuthContext.tsx` and the `app/(auth)/*` screens) calls
the API with **raw `fetch()` + `res.json()`**, NOT through the generated React
Query hooks / `lib/api-client-react/src/custom-fetch.ts` mutator. The mutator is
defensive (reads text, returns null on empty/non-JSON bodies); the raw auth
calls are not by default.

**Why this matters:** when a user reports a login error
`Failed to execute 'json' on 'Response': Unexpected end of JSON input`, the
cause is almost always that the **API server was down / not started**, or a
proxy returned an empty / HTML error body, and a raw `res.json()` choked on it.
First fix: restart the `artifacts/api-server: API Server` workflow. Then confirm
`curl localhost:80/api/healthz` is 200.

**How to apply:** any new auth-flow fetch must parse defensively — read
`res.text()` first, `JSON.parse` in a try/catch, and wrap `fetch` itself in
try/catch to convert network failures into a clear "Cannot reach the server"
message instead of the cryptic DOM exception. A `parseJsonSafe` helper already
exists in `AuthContext.tsx`. Non-auth screens (`warranty-search.tsx`,
`technician.tsx`, `useWeather.ts`) still use raw `.json()` and would need the
same hardening if they ever surface the same error.
