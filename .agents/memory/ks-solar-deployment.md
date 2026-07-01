---
name: K&S Solar deployment (autoscale vs VM, single port)
description: Why the published deployment fails at "Creating Autoscale service" and the correct deployment shape for this multi-service artifact app.
---

# K&S Solar deployment

This is a multi-service artifact project: an Express API artifact (`/api`, internal port 8080)
and an Expo web artifact (`/`, internal port 25115), fronted by Replit's artifact router which
multiplexes both paths onto ONE domain/port (verified: the main dev domain serves both `/` HTML
and `/api/healthz` 200). Build + run of BOTH services succeed locally in production mode.

## Two hard requirements for a successful publish

1. **Single external port only.** Autoscale AND Reserved VM support exactly one external port.
   Multiple `externalPort` entries in `.replit` (e.g. `80` for the API + `3000` for Expo, plus any
   stray ports auto-added when you run ad-hoc test servers) make the publish fail at the
   **"Creating Autoscale service"** promote step — the build phase (image push) succeeds first, so
   the failure looks confusing. Keep only one external port (`externalPort = 80`); the second
   service is reached internally through the router and needs no external port.
   **Note:** `.replit` cannot be edited directly by the agent (tool-gated); external-port trimming
   is a user action in the Publishing UI, or via the owning port tool.

2. **Reserved VM, not Autoscale.** The API runs always-on `node-cron` jobs (absent-alert every
   minute, daily photo cleanup). Autoscale scales to zero and kills idle instances, so those jobs
   never fire. Always-on background work = Reserved VM. Deployment type is changed in the Publishing
   pane, not in code.

**Why:** Diagnosed a real failed publish — build/image steps passed, "Creating Autoscale service"
retried 3× then failed with no app logs (container never became ready). Env vars (incl.
DATABASE_URL) were identical dev↔prod and both services were individually healthy, so the cause was
the deployment shape (ports + type), not the code.

**How to apply:** When a publish of this project fails at service creation, first check for >1
external port in `.replit`, then confirm the deployment type is Reserved VM. The startup DB
migration error (`relation "..._unique" already exists`) is caught and harmless — not the cause.
