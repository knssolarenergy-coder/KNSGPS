---
name: Pakistan business-day timezone
description: Day-bucketed attendance/"today" reporting uses a fixed UTC+5 day boundary, but the "is this technician on shift right now" check for continuous location tracking must use a rolling window, not any day boundary.
---

# Pakistan business-day boundaries

The K&S Solar app serves a Pakistani company, but the deployed server runs in **UTC**. Any "today" / day-bucketed window computed from server-local midnight is a **UTC** midnight = 05:00 PKT — five hours off from the real Pakistan business day.

**Rule A — day-bucketed reporting:** compute the business-day window from a fixed **UTC+5** offset (PKT has **no daylight saving**, so a constant offset is correct year-round — do not reach for a DST-aware tz library). `attendance.ts` has a local-midnight helper (`localDayStartUtc(now, tzOffsetHours)`, default offset 5) for daily totals / late-detection.

**Rule B — continuous/overnight tracking (different!):** deciding whether a technician is *currently on shift* in order to record their live-location trail must NOT use any day boundary. A shift that checks in before local midnight and continues past it loses its active-attendance match at 00:00 and silently stops recording the trail mid-shift. Use a **rolling window**: most recent attendance with `checkOutAt IS NULL AND checkInAt >= now - 24h`, newest first. The live-map and per-technician trail GET endpoints already use the same rolling 24h window, so keep all three consistent.

**Why:** location tracking runs 24/7 including overnight. A day-boundary active-shift check was a root cause of the reported "tracking stops / trail & coordinates don't show" bug — overnight checked-in techs dropped their `activeAttId`, so trail pings stopped even though live location kept upserting.

**How to apply:** day-bucketed *reports/totals* → PKT day bounds. "Is this person on shift right now" for live tracking → rolling 24h window, never a day boundary. Older attendance endpoints (late-detection via `checkIn.getHours()`, `/attendance/today`) still use server-local time and share the latent day-boundary bug — fix them with the PKT helper if they ever surface a timezone complaint.
