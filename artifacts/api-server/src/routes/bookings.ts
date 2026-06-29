import { and, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import { db, bookings, users, bookingTechnicians } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { notifyUser, notifyAdmins, notifyTechnician, bookingEmailHtml } from "../lib/notifications.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

type BookingWithTechs = (typeof bookings.$inferSelect) & { technicianIds: string[] };

async function withTechnicianIds(bookingList: (typeof bookings.$inferSelect)[]): Promise<BookingWithTechs[]> {
  if (bookingList.length === 0) return [];
  const ids = bookingList.map((b) => b.id);
  const rows = await db
    .select({ bookingId: bookingTechnicians.bookingId, technicianId: bookingTechnicians.technicianId })
    .from(bookingTechnicians)
    .where(inArray(bookingTechnicians.bookingId, ids));
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.bookingId]) map[row.bookingId] = [];
    map[row.bookingId].push(row.technicianId);
  }
  return bookingList.map((b) => ({ ...b, technicianIds: map[b.id] ?? [] }));
}

router.get("/bookings/stats/summary", requireAuth, async (req, res) => {
  try {
    let all: (typeof bookings.$inferSelect)[];
    if (req.auth!.isAdmin) {
      all = await db.select().from(bookings).orderBy(sql`${bookings.createdAt} DESC`);
    } else if (req.auth!.isTechnician) {
      const assigned = await db
        .select({ bookingId: bookingTechnicians.bookingId })
        .from(bookingTechnicians)
        .where(eq(bookingTechnicians.technicianId, req.auth!.userId));
      const ids = assigned.map((r) => r.bookingId);
      all = ids.length > 0
        ? await db.select().from(bookings).where(inArray(bookings.id, ids))
        : [];
    } else {
      all = await db.select().from(bookings).where(eq(bookings.userId, req.auth!.userId));
    }
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    res.json({
      total: all.length,
      pending: all.filter((b) => b.status === "pending").length,
      confirmed: all.filter((b) => b.status === "confirmed").length,
      completed: all.filter((b) => b.status === "completed").length,
      thisMonth: all.filter((b) => new Date(b.createdAt) >= thisMonthStart).length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings", requireAuth, async (req, res) => {
  try {
    let raw: (typeof bookings.$inferSelect)[];
    if (req.auth!.isAdmin) {
      raw = await db.select().from(bookings).orderBy(sql`${bookings.createdAt} DESC`);
    } else if (req.auth!.isTechnician) {
      const assigned = await db
        .select({ bookingId: bookingTechnicians.bookingId })
        .from(bookingTechnicians)
        .where(eq(bookingTechnicians.technicianId, req.auth!.userId));
      const ids = assigned.map((r) => r.bookingId);
      if (ids.length === 0) { res.json([]); return; }
      raw = await db.select().from(bookings).where(inArray(bookings.id, ids)).orderBy(sql`${bookings.createdAt} DESC`);
    } else {
      raw = await db.select().from(bookings).where(eq(bookings.userId, req.auth!.userId)).orderBy(sql`${bookings.createdAt} DESC`);
    }
    res.json(await withTechnicianIds(raw));
  } catch (err) {
    req.log.error({ err }, "Failed to get bookings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", requireAuth, async (req, res) => {
  try {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, String(req.params.id)));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    const [assignment] = await db
      .select({ id: bookingTechnicians.id })
      .from(bookingTechnicians)
      .where(and(eq(bookingTechnicians.bookingId, booking.id), eq(bookingTechnicians.technicianId, req.auth!.userId)));
    if (!req.auth!.isAdmin && booking.userId !== req.auth!.userId && !assignment) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const [result] = await withTechnicianIds([booking]);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/guest", async (req, res) => {
  try {
    const { customerName, phone, address, city, panelCount, panelType, preferredDate, preferredTime, notes } = req.body;
    if (!customerName || !phone || !address || !city || !panelCount || !panelType || !preferredDate || !preferredTime) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }
    const [booking] = await db.insert(bookings).values({
      id: generateId(), userId: null,
      customerName: String(customerName), phone: String(phone),
      address: String(address), city: String(city),
      panelCount: Number(panelCount), panelType: String(panelType),
      preferredDate: String(preferredDate), preferredTime: String(preferredTime),
      notes: notes ? String(notes) : null, status: "pending",
    }).returning();
    res.status(201).json({ ...booking, technicianIds: [] });
    notifyAdmins({
      pushTitle: "New Booking 📋",
      pushBody: `${booking.customerName} — ${booking.preferredDate}`,
      pushData: { type: "booking_new", tab: "admin" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create guest booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", requireAuth, async (req, res) => {
  try {
    const { customerName, phone, address, city, panelCount, panelType, preferredDate, preferredTime, notes } = req.body;
    if (!customerName || !phone || !address || !city || !panelCount || !panelType || !preferredDate || !preferredTime) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }
    const [booking] = await db.insert(bookings).values({
      id: generateId(), userId: req.auth!.userId,
      customerName: String(customerName), phone: String(phone),
      address: String(address), city: String(city),
      panelCount: Number(panelCount), panelType: String(panelType),
      preferredDate: String(preferredDate), preferredTime: String(preferredTime),
      notes: notes ? String(notes) : null, status: "pending",
    }).returning();
    res.status(201).json({ ...booking, technicianIds: [] });
    notifyUser(req.auth!.userId, {
      emailSubject: "Booking Received – K&S Solar Energy",
      emailHtml: bookingEmailHtml(booking.customerName, "pending", {
        date: booking.preferredDate, time: booking.preferredTime,
        panels: `${booking.panelCount} (${booking.panelType})`,
        address: `${booking.address}, ${booking.city}`,
      }),
      pushTitle: "Booking Received ✓",
      pushBody: `Your solar panels washing booking for ${booking.preferredDate} has been received.`,
      pushData: { type: "booking", id: booking.id },
    }).catch((err) => req.log.warn({ err }, "Booking notification failed"));
    notifyAdmins({
      pushTitle: "New Booking 📋",
      pushBody: `${booking.customerName} — ${booking.preferredDate}`,
      pushData: { type: "booking_new", tab: "admin" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const isTech = req.auth!.isTechnician;
    const allowedAdmin = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
    const allowedTech = ["in_progress", "completed"];

    if (req.auth!.isAdmin) {
      if (!status || !allowedAdmin.includes(status)) {
        res.status(400).json({ error: "Invalid status" }); return;
      }
    } else if (isTech) {
      if (!status || !allowedTech.includes(status)) {
        res.status(400).json({ error: "Technicians can only set bookings to in_progress or completed" }); return;
      }
      const [assignment] = await db
        .select({ id: bookingTechnicians.id })
        .from(bookingTechnicians)
        .where(and(eq(bookingTechnicians.bookingId, String(req.params.id)), eq(bookingTechnicians.technicianId, req.auth!.userId)));
      if (!assignment) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    } else {
      res.status(403).json({ error: "Forbidden — admin only" }); return;
    }

    const [updated] = await db.update(bookings)
      .set({ status: String(status) })
      .where(eq(bookings.id, String(req.params.id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Booking not found" }); return; }
    const [result] = await withTechnicianIds([updated]);
    res.json(result);

    if (updated.userId) {
      notifyUser(updated.userId, {
        emailSubject: "Booking Update – K&S Solar Energy",
        emailHtml: bookingEmailHtml(updated.customerName, updated.status),
        pushTitle: `Booking ${updated.status === "confirmed" ? "Confirmed ✓" : updated.status === "completed" ? "Completed ✓" : "Updated"}`,
        pushBody: `Your solar panels washing booking status: ${updated.status}.`,
        pushData: { type: "booking", id: updated.id, status: updated.status },
      }).catch((err) => req.log.warn({ err }, "Booking status notification failed"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update booking status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/bookings/:id/technicians", requireAdmin, async (req, res) => {
  try {
    const { technicianIds } = req.body;
    if (!Array.isArray(technicianIds)) {
      res.status(400).json({ error: "technicianIds must be an array" }); return;
    }
    const bookingId = String(req.params.id);
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    await db.delete(bookingTechnicians).where(eq(bookingTechnicians.bookingId, bookingId));
    if (technicianIds.length > 0) {
      await db.insert(bookingTechnicians).values(
        technicianIds.map((techId: string) => ({
          id: generateId(),
          bookingId,
          technicianId: String(techId),
        }))
      );
    }
    const techRows = await db
      .select({ technicianId: bookingTechnicians.technicianId })
      .from(bookingTechnicians)
      .where(eq(bookingTechnicians.bookingId, bookingId));
    res.json({ ...booking, technicianIds: techRows.map((r) => r.technicianId) });
    req.log.info({ bookingId, technicianIds }, "Booking technicians updated");
    // Notify each newly assigned technician
    for (const techId of technicianIds as string[]) {
      notifyTechnician(techId, {
        pushTitle: "New Job Assigned 🔧",
        pushBody: `Booking for ${booking.customerName} on ${booking.preferredDate}`,
        pushData: { type: "booking_assigned", id: bookingId },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to assign booking technicians");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
