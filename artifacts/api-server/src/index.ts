import bcrypt from "bcryptjs";
import cron from "node-cron";
import { eq, and, gte, lt, isNotNull, or } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { sendEmail } from "./lib/notifications.js";
import { ObjectStorageService } from "./lib/objectStorage.js";
import { db, users, settings, attendance, runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@kssolar.pk").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@KS2024";

  try {
    const existing = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(users).values({
        id: "admin-" + Date.now().toString(36),
        name: "K&S Admin",
        email: adminEmail,
        phone: "0300-0000000",
        passwordHash,
        isAdmin: true,
        isMaster: true,
        status: "approved",
      });
      logger.info({ email: adminEmail }, "Admin user created");
    } else {
      await db.update(users)
        .set({ isAdmin: true, isMaster: true, status: "approved" })
        .where(eq(users.email, adminEmail));
      logger.info({ email: adminEmail }, "Admin user refreshed");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

async function seedSettings() {
  const defaults = [
    { key: "whatsapp_booking", value: "923001234567" },
    { key: "whatsapp_complaint", value: "923001234567" },
    { key: "whatsapp_installation", value: "923001234567" },
    { key: "whatsapp_support", value: "923001234567" },
    { key: "whatsapp_ai_support", value: "923001234567" },
    { key: "ai_support_enabled", value: "true" },
    { key: "contact_phone", value: "" },
    { key: "contact_email", value: "" },
    { key: "contact_address", value: "" },
    { key: "contact_hours", value: "" },
    { key: "social_instagram", value: "" },
    { key: "social_facebook", value: "" },
    { key: "social_tiktok", value: "" },
    { key: "social_linkedin", value: "" },
    { key: "social_youtube", value: "" },
    { key: "social_website", value: "" },
    { key: "referral_enabled", value: "true" },
    { key: "referral_points_per_referral", value: "10" },
    { key: "referral_pkr_per_point", value: "1" },
    { key: "attendance_checkin_deadline", value: "08:00" },
    { key: "attendance_shift_end", value: "18:00" },
    { key: "attendance_absent_alert_time", value: "09:00" },
    { key: "app_timezone_offset", value: "5" },
  ];
  try {
    for (const row of defaults) {
      await db.insert(settings).values(row).onConflictDoNothing();
    }
    logger.info("Default settings seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed settings");
  }
}

function scheduleAbsentAlert() {
  let lastAlertDay = "";

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const todayKey = now.toISOString().split("T")[0] as string;
      if (lastAlertDay === todayKey) return;

      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const settingRows = await db.select().from(settings)
        .where(or(eq(settings.key, "attendance_absent_alert_time"), eq(settings.key, "app_timezone_offset")));
      const getSetting = (k: string, d: string) => settingRows.find(r => r.key === k)?.value ?? d;
      const alertTime = getSetting("attendance_absent_alert_time", "09:00");
      const tzOffsetHours = parseFloat(getSetting("app_timezone_offset", "5")) || 5;
      if (currentHHMM < alertTime) return;

      lastAlertDay = todayKey;

      const OFFSET_MS = tzOffsetHours * 60 * 60 * 1000;
      const localNow = new Date(now.getTime() + OFFSET_MS);
      const midnightLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
      const today = new Date(midnightLocal - OFFSET_MS);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const technicians = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(and(eq(users.role, "technician"), eq(users.status, "approved")));

      if (technicians.length === 0) return;

      const todayCheckins = await db
        .select({ technicianId: attendance.technicianId })
        .from(attendance)
        .where(and(gte(attendance.checkInAt, today), lt(attendance.checkInAt, tomorrow)));

      const checkedInIds = new Set(todayCheckins.map(r => r.technicianId));
      const absent = technicians.filter(t => !checkedInIds.has(t.id));
      if (absent.length === 0) return;

      const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@kssolar.pk").toLowerCase();
      const rows = absent
        .map(t => `<tr><td style="padding:6px 14px;border-bottom:1px solid #eee;font-size:13px;color:#333;">${t.name}</td><td style="padding:6px 14px;border-bottom:1px solid #eee;font-size:13px;color:#555;">${t.phone ?? "—"}</td></tr>`)
        .join("");
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:#1E3A5F;padding:28px 40px;text-align:center;">
        <div style="font-size:26px;margin-bottom:6px;">☀️</div>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">K&amp;S Solar Energy</h1>
        <p style="color:#ffffffcc;margin:6px 0 0;font-size:13px;">Daily Attendance Alert</p>
      </td></tr>
      <tr><td style="padding:32px 40px;">
        <h2 style="color:#1E3A5F;margin:0 0 10px;font-size:17px;">Absent Technicians — ${todayKey}</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">${absent.length} technician${absent.length === 1 ? " has" : "s have"} not checked in today. To reach them quickly, use WhatsApp with their numbers listed below.</p>
        <table width="100%" style="background:#f8fafc;border-radius:10px;border-collapse:collapse;">
          <tr>
            <th style="padding:8px 14px;text-align:left;font-size:12px;color:#1E3A5F;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;">Name</th>
            <th style="padding:8px 14px;text-align:left;font-size:12px;color:#1E3A5F;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;">Phone</th>
          </tr>
          ${rows}
        </table>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#bbb;font-size:11px;margin:0;">© K&amp;S Solar Energy · Pakistan</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

      const sent = await sendEmail(
        adminEmail,
        `⚠️ ${absent.length} Technician${absent.length === 1 ? "" : "s"} Absent Today – ${todayKey}`,
        html
      );
      if (sent) {
        logger.info({ absentCount: absent.length, date: todayKey }, "Absent alert email sent");
      } else {
        logger.warn({ absentCount: absent.length, date: todayKey }, "Absent alert email NOT sent (check RESEND_API_KEY)");
      }
    } catch (err) {
      logger.error({ err }, "Failed to run absent technician cron job");
    }
  });

  logger.info("Absent technician alert cron scheduled (runs every minute, fires once at configured time)");
}

function schedulePhotoCleanup() {
  cron.schedule("0 2 * * *", async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 40);

      const oldRecords = await db
        .select({ id: attendance.id, selfieUrl: attendance.selfieUrl, sitePhotoUrl: attendance.sitePhotoUrl })
        .from(attendance)
        .where(
          and(
            lt(attendance.checkInAt, cutoff),
            or(isNotNull(attendance.selfieUrl), isNotNull(attendance.sitePhotoUrl))
          )
        );

      if (oldRecords.length === 0) return;

      const svc = new ObjectStorageService();
      let cleaned = 0;

      for (const record of oldRecords) {
        const updates: { selfieUrl?: null; sitePhotoUrl?: null } = {};

        for (const [field, url] of [
          ["selfieUrl", record.selfieUrl] as const,
          ["sitePhotoUrl", record.sitePhotoUrl] as const,
        ]) {
          if (!url) continue;
          try {
            const normalized = svc.normalizeObjectEntityPath(url);
            if (normalized.startsWith("/")) {
              const file = await svc.getObjectEntityFile(normalized);
              await file.delete();
            }
          } catch (err) {
            logger.warn({ err, field, attendanceId: record.id }, "Photo storage delete failed, clearing DB ref");
          }
          updates[field] = null;
        }

        if (Object.keys(updates).length > 0) {
          await db.update(attendance).set(updates).where(eq(attendance.id, record.id));
          cleaned++;
        }
      }

      logger.info({ cleaned, total: oldRecords.length }, "Attendance photo cleanup completed");
    } catch (err) {
      logger.error({ err }, "Attendance photo cleanup cron failed");
    }
  });

  logger.info("Attendance photo cleanup cron scheduled (daily at 2 AM, deletes photos >40 days old)");
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  try {
    const migrationsFolder = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "drizzle"
    );
    await runMigrations(migrationsFolder);
    logger.info("Database migrations applied");
  } catch (migErr) {
    logger.error({ err: migErr }, "Failed to run migrations");
  }

  await seedAdmin();
  await seedSettings();
  scheduleAbsentAlert();
  schedulePhotoCleanup();
});
