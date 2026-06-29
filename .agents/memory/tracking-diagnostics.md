---
name: Debugging silent always-on background tracking
description: Why shipping blind APKs for the technician GPS bug kept failing, and the observability approach that broke the loop
---

# Debugging silent always-on background tracking

The "tracking stopped" bug went through multiple blind APK rounds because the
background location path swallows every failure. From production (DB rows +
server logs) you CANNOT distinguish these causes from each other:
- background permission is "While using" not "Allow all the time"
- the app was never opened after install (foreground service never started)
- a crash / OEM Doze kill
- the server rejected the upload (expired token → 401/403)

All of them look identical: simply "no POSTs arrive".

**Rule:** for a silent, always-on, device-side feature, do NOT iterate by
shipping blind builds. Build in-app observability FIRST — persist the outcome of
the last service (re)start and the last upload (status/error), and add a one-tap
"send test ping" that does a real GPS fix + raw POST and shows the HTTP result.
That single test isolates GPS vs permission vs network vs auth vs server in one
tap, on the actual device, without reading native logs.

**Why:** rounds 1–3 each "fixed" a guessed cause and shipped; each failed because
the real cause was never visible. The test ping makes the cause visible.

## Gotcha: the readiness gate hides the main screen
The technician screen early-returns `<TrackingSetupGate/>` whenever tracking
readiness fails. So any diagnostics/test entry point placed only on the main
technician screen is UNREACHABLE in exactly the broken state you need it. Any
always-on diagnostics affordance must ALSO live inside TrackingSetupGate (it
does now).

## Gotcha: foreground ping is check-in gated
The 10s foreground ping only runs while the tech is checked in
(`todayRecord && !checkOutAt`). So "zero foreground pings" is NOT evidence of a
regression — the always-on background service is the only 24/7 path, and it's the
one to instrument.
