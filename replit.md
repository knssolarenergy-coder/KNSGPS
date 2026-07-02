# K&S Solar Energy

Mobile app for K&S Solar Energy — customers can monitor their inverter status and book solar panel washing services.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ks-solar run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to dev DB (drizzle push)
- `pnpm --filter @workspace/db run generate` — generate a new Drizzle migration file after schema changes
- `pnpm --filter @workspace/db run migrate` — run pending migrations against the DB
- Required env: `DATABASE_URL` — Postgres connection string

> **Migrations**: The API server automatically runs pending migrations (`lib/db/drizzle/`) on startup via `drizzle-orm/node-postgres/migrator`. For dev, continue using `push` for quick iteration; run `generate` when schema is stable to commit a migration file.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with Expo Router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ks-solar/` — Expo mobile app
- `artifacts/api-server/` — Express API server
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/` — Auto-generated React Query hooks
- `lib/api-zod/src/generated/` — Auto-generated Zod schemas
- `lib/db/src/schema/index.ts` — Database schema (bookings table)

## Architecture decisions

- Inverter status uses WebView (react-native-webview) to load each brand's official monitoring portal — no inverter APIs needed.
- Bookings stored in PostgreSQL via Drizzle ORM; API uses generated Zod validators.
- OpenAPI spec is the single source of truth — always update `openapi.yaml` first, then run codegen before touching the frontend.
- setBaseUrl called at module level in _layout.tsx using `EXPO_PUBLIC_DOMAIN` env var for correct proxy routing.

## Product

- **Inverter Status**: Select inverter brand (Livoltek, Solis, GoodWe, Huawei, Growatt, SolarEdge, Fronius, Deye/Solarman) → WebView opens manufacturer's monitoring portal. No credentials stored in app.
- **Solar Panel Washing Booking**: Form with customer name, phone, address, city, panel count, panel type, preferred date & time slot, notes. Submitted to backend.
- **My Orders**: View all submitted booking requests with status (pending/confirmed/completed/cancelled), filterable by status.
- **Home**: Brand dashboard with 2×2 service grid (Inverter, Panel Washing, Installation, Complaint) + WhatsApp Support full-width card + booking stats.
- **WhatsApp Support**: Tapping support card opens WhatsApp with `whatsapp_support` number from settings.
- **Account Approval**: New registrations are `pending` and cannot log in until an admin approves them. Admin sees pending badge on Users tab.
- **Admin Panel tabs**: Bookings · Complaints · Users · Settings.
  - Users tab: list all non-admin accounts, filter by status (pending/approved/rejected), Approve/Reject buttons.
  - Settings tab: WhatsApp numbers for Booking, Complaint, Installation, and Support.

## Bottom Tab Bar

Only 4 tabs shown: Home, Inverter, My Orders, Admin (admin only).
Service screens (booking, installation, complaint, chat) still exist as routes but `href: null` hides them from the tab bar — accessed via home page cards.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Account Status Flow

- `pending` → newly registered, cannot log in
- `approved` → can log in normally
- `rejected` → cannot log in (contact support message)
- Admin (`admin@kssolar.pk`) is always seeded as `approved`
- **Existing accounts** registered before the approval system was added will be `pending` — admin must approve them via the Users tab.

## Gotchas

- Always run codegen after changing `openapi.yaml`: `pnpm --filter @workspace/api-spec run codegen`
- After running codegen, restart the Expo workflow — Orval cleans the output folder before regenerating, which causes a transient Metro hot-reload crash if the bundler is running during the clean step.
- Auto-revive watchdog (`modules/tracking-watchdog`): native 2-min exact-alarm chain + 15-min WorkManager backstop that revives tracking after HiOS kills the app (notification/recents swipe). Armed on tracking start, disarmed on logout. Force stop is unrecoverable by Android design. See `.agents/memory/native-tracking-revival.md` for the mechanism.
- react-native-webview version may show compatibility warning — it works fine in Expo Go.
- WebView on web (browser preview) shows a placeholder message since WebView isn't supported in browser.
- Never use `Link asChild` with style arrays — crashes on web. Use `router.push()` instead.
- All Haptics calls must be guarded with `if (Platform.OS !== "web")` — Haptics API doesn't exist on web.

## EAS Android build (standalone APK)

The standalone Android build (`eas build --profile preview --platform android`) is sensitive to native config. Requirements that, if missing, cause **Gradle "build failed"** or **immediate crash on launch**:

- **`google-services.json` MUST exist** at `artifacts/ks-solar/google-services.json` with a client matching package `com.kssolar.app`. `expo-notifications` enables the Google Services Gradle plugin, which fails the build if the file is absent. It is a placeholder (real Firebase/FCM project needed for push delivery, but the structure is enough to build). Do NOT gitignore it.
- **`newArchEnabled: true` is REQUIRED** in app.json (and forced again in `plugins/withAndroidBuildReliability.js`). `react-native-reanimated` v4 (`~4.1`) + `react-native-worklets` dropped the old architecture; their `assertNewArchitectureEnabledTask` fails the Gradle build deterministically ("[Reanimated] Reanimated requires new architecture to be enabled") if it is off. New Arch is also the Expo SDK 54 default. Do NOT set it to `false` — that was a wrong earlier assumption that caused two straight build failures. After `expo prebuild`, `android/gradle.properties` must show `newArchEnabled=true`.
- **No `babel-plugin-react-compiler` in babel.config.js and no `reactCompiler: true`** in app.json experiments — the beta React Compiler crashes Metro during the Gradle JS bundle step.
- **Only declare native plugins for modules actually imported in source.** Every plugin/dependency that ships native code is autolinked and compiled, adding build surface. `expo-camera` was removed because nothing imports it (`expo-image-picker`'s `launchCameraAsync` covers camera capture and only needs the `CAMERA` permission).
- **Pin exact native package versions for the Expo SDK** (use `expo install`) — version drift causes Gradle resolution failures.
- **Intermittent "Gradle build failed with unknown error" is most likely out-of-memory.** The Expo default builds 4 ABIs (`armeabi-v7a,arm64-v8a,x86,x86_64`) at 2 GB heap, so reanimated/worklets C++ compiles 4× and the EAS worker can OOM unpredictably. Mitigated by the local config plugin `plugins/withAndroidBuildReliability.js`, which sets `reactNativeArchitectures=armeabi-v7a,arm64-v8a` (drops emulator-only x86/x86_64) and raises `org.gradle.jvmargs` to `-Xmx4096m`. Halves native build work; safe for all real ARM phones, but the resulting APK will NOT run on x86/x86_64 Android emulators or rare x86 devices. If logs later show memory pressure, back heap down to `-Xmx3072m`.
- Verify config before building: `pnpm exec expo config --type prebuild --json` must exit 0 and show `android.googleServicesFile` set.
- To pinpoint a Gradle failure, the **"Run gradlew" phase log** on the EAS build page is the only definitive source — the local `expo prebuild --platform android` only catches config-plugin errors, not compile/OOM errors (no Android SDK locally).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
