import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, settings } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const HHMM_KEYS = new Set([
  "attendance_checkin_deadline",
  "attendance_shift_end",
  "attendance_absent_alert_time",
]);

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(settings);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings/:key", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined || value === null || typeof value !== "string") {
      res.status(400).json({ error: "Value is required" });
      return;
    }
    const key = String(req.params.key);
    if (HHMM_KEYS.has(key) && !/^\d{2}:\d{2}$/.test(value)) {
      res.status(400).json({ error: "Value must be in HH:MM format (e.g. 08:00)" });
      return;
    }
    const [row] = await db
      .insert(settings)
      .values({ key, value: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: new Date() } })
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update setting");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
