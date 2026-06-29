import { Router } from "express";
import { db } from "@workspace/db";
import { attendance, locationPings, settings, sites, technicianLocations, users } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, lt, inArray, isNull, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { requireTechnician } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const router = Router();

// Returns the UTC instant of the most recent local midnight for a given timezone
// offset (hours, may be fractional e.g. 5.5 for IST), so "today / active shift"
// detection stays correct even when the server runs in UTC.
function localDayStartUtc(now: Date, tzOffsetHours: number): Date {
  const OFFSET_MS = tzOffsetHours * 60 * 60 * 1000;
  const local = new Date(now.getTime() + OFFSET_MS);
  const midnightLocalAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocalAsUtc - OFFSET_MS);
}

// How far back to look for a still-open attendance when recording a location.
// MUST be a rolling window, NOT a local-midnight bound: a shift that checks in
// before midnight and continues after it would otherwise drop its activeAttId
// at 00:00 local and silently stop recording the trail mid-shift. 24h matches
// the rolling window the admin map + trail endpoints already use, and covers
// any realistic overnight shift without resurrecting an ancient un-checked-out
// attendance.
const ACTIVE_SHIFT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Resolve the technician's currently active attendance id (checked in, not yet
// checked out) using a rolling window. Returns null when off-shift. Never trusts
// a client-supplied attendanceId. Shared by the single + batch location upserts
// so the trail keeps recording across midnight.
async function findActiveAttendanceId(technicianId: string, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - ACTIVE_SHIFT_WINDOW_MS);
  const [row] = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(
      eq(attendance.technicianId, technicianId),
      isNull(attendance.checkOutAt),
      gte(attendance.checkInAt, since),
    ))
    .orderBy(desc(attendance.checkInAt))
    .limit(1);
  return row?.id ?? null;
}

interface AttendanceSettings {
  deadlineHHMM: string;
  shiftEndHHMM: string;
  tzOffsetHours: number;
}

async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const rows = await db.select().from(settings)
    .where(inArray(settings.key, ["attendance_checkin_deadline", "attendance_shift_end", "app_timezone_offset"]));
  const get = (key: string, def: string) => rows.find(r => r.key === key)?.value ?? def;
  return {
    deadlineHHMM: get("attendance_checkin_deadline", "08:00"),
    shiftEndHHMM: get("attendance_shift_end", "18:00"),
    tzOffsetHours: parseFloat(get("app_timezone_offset", "5")) || 5,
  };
}

function calcStats(
  checkIn: Date,
  checkOut: Date | null,
  deadlineHHMM: string,
  shiftEndHHMM: string
) {
  const [dlH = 8, dlM = 0] = deadlineHHMM.split(":").map(Number);
  const deadlineMins = dlH * 60 + dlM;
  const checkInMins = checkIn.getHours() * 60 + checkIn.getMinutes();
  const isLate = checkInMins > deadlineMins;

  let totalHours: number | null = null;
  let overtimeHours: number | null = null;
  if (checkOut) {
    totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const [seH = 18, seM = 0] = shiftEndHHMM.split(":").map(Number);
    const shiftEndMins = seH * 60 + seM;
    const checkOutMins = checkOut.getHours() * 60 + checkOut.getMinutes();
    overtimeHours = Math.max(0, (checkOutMins - shiftEndMins) / 60);
  }
  return { isLate, totalHours, overtimeHours };
}

async function formatRecord(row: typeof attendance.$inferSelect, attSettings: AttendanceSettings) {
  const tech = await db.select({ name: users.name }).from(users).where(eq(users.id, row.technicianId)).limit(1);
  let siteName: string | null = null;
  if (row.siteId) {
    const s = await db.select({ name: sites.name }).from(sites).where(eq(sites.id, row.siteId)).limit(1);
    siteName = s[0]?.name ?? null;
  }
  const { isLate, totalHours, overtimeHours } = calcStats(
    row.checkInAt,
    row.checkOutAt ?? null,
    attSettings.deadlineHHMM,
    attSettings.shiftEndHHMM
  );
  return {
    id: row.id,
    technicianId: row.technicianId,
    technicianName: tech[0]?.name ?? "Unknown",
    siteId: row.siteId,
    siteName,
    selfieUrl: row.selfieUrl,
    sitePhotoUrl: row.sitePhotoUrl,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.locationAddress,
    checkInAt: row.checkInAt.toISOString(),
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    totalHours,
    overtimeHours,
    isLate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

// POST /attendance/checkin — technician check-in
router.post("/attendance/checkin", requireTechnician, async (req, res) => {
  const { selfieUrl, sitePhotoUrl, latitude, longitude, locationAddress, siteId, notes } = req.body as {
    selfieUrl?: string;
    sitePhotoUrl?: string;
    latitude?: string;
    longitude?: string;
    locationAddress?: string;
    siteId?: string;
    notes?: string;
  };

  const techId = req.auth!.userId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const existing = await db.select({ id: attendance.id })
    .from(attendance)
    .where(and(
      eq(attendance.technicianId, techId),
      gte(attendance.checkInAt, today),
      lt(attendance.checkInAt, tomorrow)
    ))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Already checked in today" });
    return;
  }

  const id = randomUUID();
  const [row] = await db.insert(attendance).values({
    id,
    technicianId: techId,
    siteId: siteId ?? null,
    selfieUrl: selfieUrl ?? null,
    sitePhotoUrl: sitePhotoUrl ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    locationAddress: locationAddress ?? null,
    notes: notes ?? null,
    checkInAt: new Date(),
  }).returning();

  const attSettings = await getAttendanceSettings();
  res.json(await formatRecord(row, attSettings));
});

// POST /attendance/:id/checkout
router.post("/attendance/:id/checkout", requireTechnician, async (req, res) => {
  const id = req.params.id as string;
  const techId = req.auth!.userId;

  const [row] = await db.select().from(attendance)
    .where(and(eq(attendance.id, id), eq(attendance.technicianId, techId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }
  if (row.checkOutAt) {
    res.status(400).json({ error: "Already checked out" });
    return;
  }

  const [updated] = await db.update(attendance)
    .set({ checkOutAt: new Date() })
    .where(eq(attendance.id, id))
    .returning();

  const attSettings = await getAttendanceSettings();
  res.json(await formatRecord(updated, attSettings));
});

// GET /attendance — admin: all records with optional date + technicianId filter
router.get("/attendance", requireAdmin, async (req, res) => {
  const { date, technicianId } = req.query as { date?: string; technicianId?: string };

  const conditions = [];
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    conditions.push(gte(attendance.checkInAt, d));
    conditions.push(lt(attendance.checkInAt, next));
  }
  if (technicianId) {
    conditions.push(eq(attendance.technicianId, technicianId));
  }

  const rows = conditions.length > 0
    ? await db.select().from(attendance).where(and(...conditions)).orderBy(desc(attendance.checkInAt))
    : await db.select().from(attendance).orderBy(desc(attendance.checkInAt));

  const attSettings = await getAttendanceSettings();
  const records = await Promise.all(rows.map(r => formatRecord(r, attSettings)));
  res.json(records);
});

// GET /attendance/my — technician's own history
router.get("/attendance/my", requireTechnician, async (req, res) => {
  const techId = req.auth!.userId;
  const rows = await db.select().from(attendance)
    .where(eq(attendance.technicianId, techId))
    .orderBy(desc(attendance.checkInAt))
    .limit(60);
  const attSettings = await getAttendanceSettings();
  const records = await Promise.all(rows.map(r => formatRecord(r, attSettings)));
  res.json(records);
});

// POST /attendance/location-ping — technician sends GPS ping while checked in
router.post("/attendance/location-ping", requireTechnician, async (req, res) => {
  const { attendanceId, latitude, longitude, address } = req.body as {
    attendanceId: string;
    latitude: string;
    longitude: string;
    address?: string | null;
  };

  if (!attendanceId || !latitude || !longitude) {
    res.status(400).json({ error: "attendanceId, latitude and longitude are required" });
    return;
  }

  const techId = req.auth!.userId;

  const [att] = await db.select({ id: attendance.id, checkOutAt: attendance.checkOutAt })
    .from(attendance)
    .where(and(eq(attendance.id, attendanceId), eq(attendance.technicianId, techId)))
    .limit(1);

  if (!att) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }
  if (att.checkOutAt) {
    res.status(400).json({ error: "Already checked out — cannot send location ping" });
    return;
  }

  const id = randomUUID();
  const [ping] = await db.insert(locationPings).values({
    id,
    attendanceId,
    technicianId: techId,
    latitude,
    longitude,
    address: address ?? null,
    recordedAt: new Date(),
  }).returning();

  res.status(201).json({
    id: ping.id,
    attendanceId: ping.attendanceId,
    technicianId: ping.technicianId,
    latitude: ping.latitude,
    longitude: ping.longitude,
    address: ping.address,
    recordedAt: ping.recordedAt.toISOString(),
  });
});

// GET /attendance/today — technician's today record
router.get("/attendance/today", requireTechnician, async (req, res) => {
  const techId = req.auth!.userId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [row] = await db.select().from(attendance)
    .where(and(
      eq(attendance.technicianId, techId),
      gte(attendance.checkInAt, today),
      lt(attendance.checkInAt, tomorrow)
    ))
    .limit(1);

  const attSettings = await getAttendanceSettings();
  res.json({ record: row ? await formatRecord(row, attSettings) : null });
});

// GET /attendance/absent-today — admin: technicians who have not checked in today (gated by alert time)
router.get("/attendance/absent-today", requireAdmin, async (req, res) => {
  // Only return absent list after the configured alert time
  const [alertRow] = await db.select().from(settings).where(eq(settings.key, "attendance_absent_alert_time"));
  const alertTime = alertRow?.value ?? "09:00";
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (currentHHMM < alertTime) {
    res.json([]);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const technicians = await db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .where(and(eq(users.role, "technician"), eq(users.status, "approved")));

  if (technicians.length === 0) {
    res.json([]);
    return;
  }

  const todayCheckins = await db
    .select({ technicianId: attendance.technicianId })
    .from(attendance)
    .where(and(gte(attendance.checkInAt, today), lt(attendance.checkInAt, tomorrow)));

  const checkedInIds = new Set(todayCheckins.map(r => r.technicianId));
  const absent = technicians.filter(t => !checkedInIds.has(t.id));

  res.json(absent.map(t => ({ id: t.id, name: t.name, phone: t.phone })));
});

// PATCH /attendance/:id — admin edit check-in or check-out time
router.patch("/attendance/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { checkInAt, checkOutAt, notes } = req.body as {
    checkInAt?: string;
    checkOutAt?: string | null;
    notes?: string | null;
  };

  const [existing] = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const updates: Partial<typeof attendance.$inferInsert> = {};
  if (checkInAt !== undefined) {
    const d = new Date(checkInAt);
    if (isNaN(d.getTime())) { res.status(400).json({ error: "Invalid checkInAt" }); return; }
    updates.checkInAt = d;
  }
  if (checkOutAt !== undefined) {
    if (checkOutAt === null) {
      updates.checkOutAt = null;
    } else {
      const d = new Date(checkOutAt);
      if (isNaN(d.getTime())) { res.status(400).json({ error: "Invalid checkOutAt" }); return; }
      updates.checkOutAt = d;
    }
  }
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(attendance).set(updates).where(eq(attendance.id, id)).returning();
  const attSettings = await getAttendanceSettings();
  res.json(await formatRecord(updated, attSettings));
});

// POST /attendance/manual — admin manually adds an attendance entry
router.post("/attendance/manual", requireAdmin, async (req, res) => {
  const { technicianId, checkInAt, checkOutAt, notes } = req.body as {
    technicianId?: string;
    checkInAt?: string;
    checkOutAt?: string | null;
    notes?: string | null;
  };

  if (!technicianId || !checkInAt) {
    res.status(400).json({ error: "technicianId and checkInAt are required" });
    return;
  }

  const checkInDate = new Date(checkInAt);
  if (isNaN(checkInDate.getTime())) { res.status(400).json({ error: "Invalid checkInAt" }); return; }

  let checkOutDate: Date | null = null;
  if (checkOutAt) {
    checkOutDate = new Date(checkOutAt);
    if (isNaN(checkOutDate.getTime())) { res.status(400).json({ error: "Invalid checkOutAt" }); return; }
  }

  const [tech] = await db.select({ id: users.id }).from(users).where(eq(users.id, technicianId)).limit(1);
  if (!tech) { res.status(400).json({ error: "Technician not found" }); return; }

  const [row] = await db.insert(attendance).values({
    id: randomUUID(),
    technicianId,
    checkInAt: checkInDate,
    checkOutAt: checkOutDate,
    notes: notes ?? null,
  }).returning();

  const attSettings = await getAttendanceSettings();
  res.status(201).json(await formatRecord(row, attSettings));
});

// POST /technician-locations — technician: upsert latest location (24/7, decoupled from check-in)
router.post("/technician-locations", requireTechnician, async (req, res) => {
  const { latitude, longitude, address } = req.body as {
    latitude: string;
    longitude: string;
    address?: string | null;
  };
  if (!latitude || !longitude) {
    res.status(400).json({ error: "latitude and longitude are required" });
    return;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "Invalid latitude or longitude" });
    return;
  }
  const technicianId = req.auth!.userId;
  const now = new Date();

  // Determine the technician's currently active attendance (if any) server-side —
  // we never trust a client-supplied attendanceId. The rolling-window lookup keeps
  // overnight / cross-midnight shifts recording. Tracking runs even off-shift
  // (live location is upserted regardless of check-in).
  const activeAttId = await findActiveAttendanceId(technicianId, now);

  // Upsert latest location (one row per technician) — always, even off-shift.
  await db
    .insert(technicianLocations)
    .values({ technicianId, attendanceId: activeAttId, latitude, longitude, address: address ?? null, updatedAt: now })
    .onConflictDoUpdate({
      target: technicianLocations.technicianId,
      set: { attendanceId: activeAttId, latitude, longitude, address: address ?? null, updatedAt: now },
    });

  // Append to the shift trail (locationPings) only during an active shift —
  // avoids unbounded 24/7 history growth while keeping per-session trails intact.
  if (activeAttId) {
    await db.insert(locationPings).values({
      id: randomUUID(),
      attendanceId: activeAttId,
      technicianId,
      latitude,
      longitude,
      address: address ?? null,
      recordedAt: now,
    });
  }

  res.json({ ok: true });
});

// POST /technician-locations/batch — technician: upload queued offline pings (up to 200)
// Each ping carries its original GPS timestamp so the trail stays historically accurate.
router.post("/technician-locations/batch", requireTechnician, async (req, res) => {
  const { pings } = req.body as { pings?: unknown[] };
  if (!Array.isArray(pings) || pings.length === 0) {
    res.status(400).json({ error: "pings array is required and must be non-empty" });
    return;
  }

  const technicianId = req.auth!.userId;
  const now = new Date();

  type ParsedPing = { latitude: string; longitude: string; recordedAt: Date };
  const valid: ParsedPing[] = [];
  for (const p of pings.slice(0, 200)) {
    const item = p as Record<string, unknown>;
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    const ts = new Date(item.recordedAt as string);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
        isNaN(ts.getTime())) continue;
    valid.push({ latitude: String(lat), longitude: String(lng), recordedAt: ts });
  }

  if (valid.length === 0) {
    res.json({ received: 0, inserted: 0 });
    return;
  }

  valid.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const earliest = valid[0]!.recordedAt;
  const latestPing = valid[valid.length - 1]!;

  // Find attendances that overlap with the ping window so FK is satisfied.
  const attRows = await db.select()
    .from(attendance)
    .where(and(
      eq(attendance.technicianId, technicianId),
      lte(attendance.checkInAt, latestPing.recordedAt),
      or(isNull(attendance.checkOutAt), gte(attendance.checkOutAt, earliest)),
    ));

  const pingsToInsert: typeof locationPings.$inferInsert[] = [];
  for (const ping of valid) {
    const att = attRows.find(a => {
      const afterIn = a.checkInAt.getTime() <= ping.recordedAt.getTime();
      const beforeOut = !a.checkOutAt || a.checkOutAt.getTime() >= ping.recordedAt.getTime();
      return afterIn && beforeOut;
    });
    if (att) {
      pingsToInsert.push({
        id: randomUUID(),
        attendanceId: att.id,
        technicianId,
        latitude: ping.latitude,
        longitude: ping.longitude,
        address: null,
        recordedAt: ping.recordedAt,
      });
    }
  }

  if (pingsToInsert.length > 0) {
    await db.insert(locationPings).values(pingsToInsert);
  }

  // Upsert live location to the most recent queued ping.
  const activeAttId = await findActiveAttendanceId(technicianId, now);

  await db.insert(technicianLocations)
    .values({ technicianId, attendanceId: activeAttId, latitude: latestPing.latitude, longitude: latestPing.longitude, address: null, updatedAt: latestPing.recordedAt })
    .onConflictDoUpdate({
      target: technicianLocations.technicianId,
      set: { attendanceId: activeAttId, latitude: latestPing.latitude, longitude: latestPing.longitude, address: null, updatedAt: latestPing.recordedAt },
    });

  res.json({ received: valid.length, inserted: pingsToInsert.length });
});

// GET /technician-locations — admin: latest known location for every tracked technician.
// Includes off-shift technicians; marks rows older than the freshness window as stale/offline.
// Uses a rolling 24-hour window (not midnight boundary) so overnight offline trails are visible.
router.get("/technician-locations", requireAdmin, async (req, res) => {
  const now = new Date();
  const trailStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const STALE_MS = 15 * 60 * 1000;

  // Latest location for every technician we have a row for.
  const latestLocs = await db.select().from(technicianLocations);
  if (latestLocs.length === 0) {
    res.json([]);
    return;
  }

  // Active attendance in the last 24h (checked in, not checked out) → derive status + checkInAt.
  const activeRows = await db
    .select({
      id: attendance.id,
      technicianId: attendance.technicianId,
      checkInAt: attendance.checkInAt,
    })
    .from(attendance)
    .where(and(gte(attendance.checkInAt, trailStart), isNull(attendance.checkOutAt)));
  const activeByTech = new Map(activeRows.map(r => [r.technicianId, r]));

  // Technician names.
  const techIds = latestLocs.map(l => l.technicianId);
  const techUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, techIds));
  const nameById = new Map(techUsers.map(u => [u.id, u.name]));

  const result = latestLocs.map(loc => {
    const att = activeByTech.get(loc.technicianId);
    const isStale = now.getTime() - loc.updatedAt.getTime() > STALE_MS;
    const status = isStale ? "offline" : (att ? "checked-in" : "off-shift");
    return {
      technicianId: loc.technicianId,
      name: nameById.get(loc.technicianId) ?? "Unknown",
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      recordedAt: loc.updatedAt.toISOString(),
      attendanceId: att?.id ?? loc.attendanceId ?? null,
      checkInAt: att?.checkInAt.toISOString() ?? null,
      status,
      isStale,
    };
  });

  res.json(result);
});

// GET /attendance/:id/location-trail — admin gets ordered ping list for a session
router.get("/attendance/:id/location-trail", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const pings = await db.select()
    .from(locationPings)
    .where(eq(locationPings.attendanceId, id))
    .orderBy(locationPings.recordedAt);

  res.json(pings.map(p => ({
    id: p.id,
    attendanceId: p.attendanceId,
    technicianId: p.technicianId,
    latitude: p.latitude,
    longitude: p.longitude,
    address: p.address,
    recordedAt: p.recordedAt.toISOString(),
  })));
});

// GET /technician-locations/:technicianId/trail — admin: rolling last-24h GPS trail
// for one technician across ALL attendance sessions, so cross-midnight/overnight
// movement stays visible (not scoped to a single day's attendance row).
router.get("/technician-locations/:technicianId/trail", requireAdmin, async (req, res) => {
  const technicianId = req.params.technicianId as string;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pings = await db.select()
    .from(locationPings)
    .where(and(eq(locationPings.technicianId, technicianId), gte(locationPings.recordedAt, since)))
    .orderBy(locationPings.recordedAt);

  res.json(pings.map(p => ({
    id: p.id,
    attendanceId: p.attendanceId,
    technicianId: p.technicianId,
    latitude: p.latitude,
    longitude: p.longitude,
    address: p.address,
    recordedAt: p.recordedAt.toISOString(),
  })));
});

export default router;
