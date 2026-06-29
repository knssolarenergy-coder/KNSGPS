# K&S Solar Energy

Mobile app for K&S Solar Energy — customers monitor their inverter status and book solar panel services; technicians check in and share live location; admins manage bookings, complaints, warranties, and staff.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24+ | Use [nvm](https://github.com/nvm-sh/nvm) or install from nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 14+ | Local instance or any hosted Postgres (e.g. Neon, Supabase, Railway) |
| Expo CLI | latest | `npm install -g expo-cli` (for mobile dev only) |
| EAS CLI | ≥ 16.0.0 | `npm install -g eas-cli` (for Android/iOS builds only) |

---

## Clone & Install

```bash
git clone <repo-url>
cd <repo-folder>
pnpm install
```

---

## Environment Variables

Create a `.env` file in the **repo root** (or set these in your host environment). The API server picks them up at startup.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string — e.g. `postgresql://user:pass@localhost:5432/kssolar` |
| `JWT_SECRET` | Secret used to sign auth tokens — use a long random string in production |
| `PORT` | Port the API server listens on (set automatically by Replit; set manually otherwise — e.g. `8080`) |

### Optional but Recommended

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_EMAIL` | `admin@kssolar.pk` | Email of the seeded admin account |
| `ADMIN_PASSWORD` | `Admin@KS2024` | Password of the seeded admin account — **change in production** |
| `RESEND_API_KEY` | *(none)* | [Resend](https://resend.com) API key — enables email notifications (absent alert, booking confirmations, etc.). Emails are silently skipped when unset. |
| `LOG_LEVEL` | `info` | Pino log level: `trace` / `debug` / `info` / `warn` / `error` |
| `NODE_ENV` | `development` | Set to `production` for deployed environments |

### Mobile App (Expo)

Create `artifacts/ks-solar/.env.local` (or set in your shell before starting Expo):

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_DOMAIN` | Hostname the mobile app uses to reach the API — e.g. `localhost:8080` locally, or your deployed domain |

For EAS builds this is baked into `eas.json` per build profile; update that file if you change domains.

---

## Database Setup

Push the schema to your database (first run or after schema changes):

```bash
pnpm --filter @workspace/db run push
```

> **Migrations**: The API server also runs pending migrations automatically on startup (`lib/db/drizzle/`). For development, `push` is the fastest way to iterate. When the schema is stable, generate and commit a migration file:
>
> ```bash
> pnpm --filter @workspace/db run generate   # creates a migration file
> pnpm --filter @workspace/db run migrate    # applies pending migrations
> ```

---

## Running Locally

### API Server

```bash
PORT=8080 DATABASE_URL=<your-url> pnpm --filter @workspace/api-server run dev
```

The server starts on the port you set, runs migrations, seeds the admin account, and seeds default settings.

**Default admin credentials** (created on first boot):

- Email: `admin@kssolar.pk` (or `ADMIN_EMAIL`)
- Password: `Admin@KS2024` (or `ADMIN_PASSWORD`)

### Expo Mobile App

```bash
EXPO_PUBLIC_DOMAIN=localhost:8080 pnpm --filter @workspace/ks-solar run dev
```

Then scan the QR code with **Expo Go** on your phone, or press `a` to open an Android emulator / `i` for iOS simulator.

> **Note**: The WebView inverter-monitor screen is only functional on a real device or emulator — it shows a placeholder in the browser.

---

## Code Generation

The API client hooks and Zod validators are generated from `lib/api-spec/openapi.yaml`. After any change to the OpenAPI spec, regenerate before touching the frontend:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Then restart the Expo bundler — Orval wipes the output folder before regenerating, which crashes Metro if it is running during the clean step.

---

## Type Checking

```bash
pnpm run typecheck        # full check: libs + all artifacts
pnpm run typecheck:libs   # composite libs only (faster)
```

---

## Building

```bash
pnpm run build            # typecheck + build all packages
```

> `build` requires `PORT` and `BASE_PATH` env vars (wired automatically in Replit workflows). For local verification, prefer `typecheck`.

---

## EAS Android Build (Standalone APK)

### One-time Setup

1. Log in to Expo: `eas login`
2. Make sure `artifacts/ks-solar/google-services.json` exists with package `com.kssolar.app`. A placeholder file is already committed — replace it with a real Firebase project file when you need push notifications.
3. Update `EXPO_PUBLIC_DOMAIN` in `eas.json` under the target build profile to point at your deployed API.

### Trigger a Build

```bash
cd artifacts/ks-solar

# Preview APK (internal testing)
eas build --profile preview --platform android

# Production AAB (Play Store)
eas build --profile production --platform android
```

> **Requirements that prevent Gradle failures:**
> - `newArchEnabled: true` must remain in `app.json` — react-native-reanimated v4 requires New Architecture.
> - Do **not** add `babel-plugin-react-compiler` or `reactCompiler: true` — it crashes the Metro bundle step.
> - The custom plugin `plugins/withAndroidBuildReliability.js` limits ABIs to `armeabi-v7a,arm64-v8a` and raises the Gradle heap to 4 GB. Do not remove it.

---

## Project Structure

```
artifacts/
  ks-solar/          # Expo (React Native) mobile app
  api-server/        # Express 5 API server
  mockup-sandbox/    # Design canvas (internal)
lib/
  api-spec/          # OpenAPI spec (source of truth) + codegen config
  api-client-react/  # Auto-generated React Query hooks
  api-zod/           # Auto-generated Zod schemas
  db/                # Drizzle ORM schema + migrations
scripts/             # Shared utility scripts
```

---

## Key Architectural Decisions

- **Inverter monitoring** uses WebView to load each manufacturer's official portal — no inverter APIs needed, no credentials stored.
- **OpenAPI spec** (`lib/api-spec/openapi.yaml`) is the single source of truth. Always update the spec first, then run codegen.
- **Bookings, complaints, warranties, and attendance** are stored in PostgreSQL via Drizzle ORM.
- **Account approval**: new registrations start as `pending` and cannot log in until an admin approves them.
- **Email notifications** use [Resend](https://resend.com) — set `RESEND_API_KEY` to enable.
