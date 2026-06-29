---
name: Live map WebView zoom & markers
description: LiveMapModal (native WebView + web iframe) — update markers without resetting the user's zoom, plus the stale-marker / refit traps that come with it.
---

# Live technician map: WebView/iframe marker updates

The live map renders a Leaflet map inside a WebView (native) / iframe (web) by injecting an HTML string. Four traps when updating it on a refresh interval:

- **Never rebuild the map HTML on every data refresh.** If `source={{html}}` (WebView) or `srcDoc` (iframe) changes, the whole view reloads and the initial `fitBounds`/`setView` re-runs, throwing away the user's manual zoom/pan.
  **Why:** users reported the map zooming back out every refresh tick.
  **How to apply:** build the HTML once (memoize with `[]`), keep latest locations in a ref, and push marker data via `injectJavaScript` (native) / `postMessage` (web) on both the `[locations]` effect and the map's `onLoad` (covers the load-vs-data race).

- **Auto-fit only the FIRST time markers appear.** Guard the fit logic with a `hasFitted` flag inside the injected JS; later updates just move markers.

- **Incremental marker updates must remove stale IDs.** Once you stop full-reloading, an add/update-only `setMarkers` leaves checked-out technicians on the map forever. Track a `seen` set each update and `removeLayer` + delete any marker id not in the latest payload.

- **Force a fresh map mount per open.** The modal toggles `visible` but may keep the WebView/iframe mounted, so `onLoad` won't refire and `hasFitted` stays true → reopen won't refit. Bump a `key` (state) on every open so the map remounts clean.

- **The admin "Live Map" tab renders `LiveMapSection`, NOT `LiveMapModal`.** `LiveMapModal.{native,}.tsx` is dead code — not imported anywhere (`admin.tsx` imports `LiveMapSection`). Editing the modal to "fix the map" ships nothing.
  **How to apply:** always confirm the component is actually imported (grep `app/`) before editing a map surface — there are near-duplicate map files and the unused twin is an easy decoy.

- **The technician trail must be technician-scoped over a rolling 24h window, NOT derived from "today's attendance".** Source it from a `recordedAt >= now-24h` query keyed by `technicianId` (endpoint `GET /technician-locations/:technicianId/trail`), spanning all attendance sessions.
  **Why:** the old UI did `useGetAttendance({date: today})` → open-attendance id → `useGetLocationTrail(attendanceId)`, so a tech who checked in yesterday lost their entire trail at local midnight, and the trail never crossed session boundaries.
  **How to apply:** use the rolling-window endpoint on BOTH `LiveMapSection.native.tsx` and `LiveMapSection.tsx`; a rolling *duration* (`Date.now() - 24h`) sidesteps the Pakistan/local-midnight bucketing entirely. Don't reintroduce an attendance-id-scoped trail for the live map.

- **Escape every technician-supplied field before concatenating it into the popup/marker HTML.** Markers/popups build HTML by string concat and set it via `innerHTML` → technician-controlled `name`/`address` is stored XSS in the admin-facing map. An `esc()` helper is defined inside each map HTML string; wrap any new dynamic field in `esc(...)`. Surfaces: native = **Mapbox GL JS** (`LiveMapSection.native.tsx`), web = **Leaflet** (`LiveMapSection.tsx`). Server-side, validate lat/lng ranges so junk can't reach the map either.

- **Native maps use Mapbox GL JS (CDN) inside a WebView; web stays Leaflet.** Leaflet/OSM has no satellite imagery and the user wants a satellite toggle, so the native `.tsx` surfaces load `mapbox-gl-js` from the Mapbox CDN inside the WebView (style `light-v11` ↔ `satellite-streets-v12`).
  **Why (token handling):** the Mapbox access token must NEVER be a committed literal in source OR memory (policy: no committed tokens). It is fetched at runtime from an admin-only API endpoint that reads the server-side `MAPBOX_TOKEN` env var; the HTML is built only once the token arrives and the WebView is gated until then. An earlier `@rnmapbox/maps` native-module approach gated on `EXPO_PUBLIC_MAPBOX_TOKEN`, which eas.json set to a truthy placeholder → the production APK showed an **all-black screen** (env baked at build time, fine in dev). Avoid env-baked client tokens and `@rnmapbox/maps` entirely; runtime-fetch also sidesteps the EAS build-env fragility.
  **How to apply:** keep the WebView bridge: `{type:'ready'}` handshake (RN injects markers/trail/selection only after `ready`), `{type:'selectTech',techId}` posts, data pushed via `JSON.stringify`. Mapbox markers are DOM (survive `setStyle`); GeoJSON trail layers are wiped on style switch, so re-apply the trail in `map.once('style.load')`. RN trail coords are `[lat,lng]`; Mapbox needs `[lng,lat]` — flip them.
