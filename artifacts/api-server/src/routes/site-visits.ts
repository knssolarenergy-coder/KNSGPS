import { and, eq, inArray, or, sql } from "drizzle-orm";
import { Router } from "express";
import { db, siteVisits, siteVisitTechnicians, users } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { notifyTechnician } from "../lib/notifications.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

async function withTechnicianName(rows: (typeof siteVisits.$inferSelect)[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, technicianName: null as string | null, technicianIds: [] as string[] }));
  const techIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))] as string[];
  const techs = techIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} = ANY(${techIds})`)
    : [];
  const nameMap: Record<string, string> = {};
  for (const t of techs) nameMap[t.id] = t.name;

  const ids = rows.map((r) => r.id);
  const jRows = ids.length
    ? await db
        .select({ siteVisitId: siteVisitTechnicians.siteVisitId, technicianId: siteVisitTechnicians.technicianId })
        .from(siteVisitTechnicians)
        .where(inArray(siteVisitTechnicians.siteVisitId, ids))
    : [];
  const techMap: Record<string, string[]> = {};
  for (const j of jRows) {
    if (!techMap[j.siteVisitId]) techMap[j.siteVisitId] = [];
    techMap[j.siteVisitId].push(j.technicianId);
  }

  return rows.map((r) => ({
    ...r,
    technicianName: r.assignedTo ? (nameMap[r.assignedTo] ?? null) : null,
    technicianIds: techMap[r.id] ?? [],
  }));
}

// GET /site-visits — admin: all; technician: assigned to them (direct or junction)
router.get("/site-visits", requireAuth, async (req, res) => {
  try {
    let rows: (typeof siteVisits.$inferSelect)[];
    if (req.auth!.isAdmin) {
      rows = await db.select().from(siteVisits).orderBy(sql`${siteVisits.createdAt} DESC`);
    } else if (req.auth!.isTechnician) {
      const userId = req.auth!.userId;
      const jRows = await db
        .select({ siteVisitId: siteVisitTechnicians.siteVisitId })
        .from(siteVisitTechnicians)
        .where(eq(siteVisitTechnicians.technicianId, userId));
      const jIds = jRows.map((r) => r.siteVisitId);
      rows = await db
        .select()
        .from(siteVisits)
        .where(
          jIds.length > 0
            ? or(eq(siteVisits.assignedTo, userId), inArray(siteVisits.id, jIds))
            : eq(siteVisits.assignedTo, userId)
        )
        .orderBy(sql`${siteVisits.createdAt} DESC`);
    } else {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(await withTechnicianName(rows));
  } catch (err) {
    req.log.error({ err }, "Failed to get site visits");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /site-visits — admin only
router.post("/site-visits", requireAdmin, async (req, res) => {
  try {
    const { customerName, phone, address, city, purpose, notes, assignedTo, scheduledDate, scheduledTime } = req.body;
    if (!customerName || !phone || !address || !purpose) {
      res.status(400).json({ error: "customerName, phone, address, purpose are required" }); return;
    }
    const [row] = await db.insert(siteVisits).values({
      id: generateId(),
      customerName: String(customerName),
      phone: String(phone),
      address: String(address),
      city: city ? String(city) : null,
      purpose: String(purpose),
      notes: notes ? String(notes) : null,
      status: "pending",
      assignedTo: assignedTo ? String(assignedTo) : null,
      scheduledDate: scheduledDate ? String(scheduledDate) : null,
      scheduledTime: scheduledTime ? String(scheduledTime) : null,
    }).returning();
    const [result] = await withTechnicianName([row]);
    req.log.info({ id: row.id }, "Site visit created");
    res.status(201).json(result);
    if (row.assignedTo) {
      notifyTechnician(row.assignedTo, {
        pushTitle: "Site Visit Assigned 📍",
        pushBody: `${row.purpose} — ${row.customerName}${row.scheduledDate ? ` on ${row.scheduledDate}` : ""}`,
        pushData: { type: "site_visit_assigned", id: row.id },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to create site visit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /site-visits/:id/technicians — assign multiple technicians (admin only)
router.put("/site-visits/:id/technicians", requireAdmin, async (req, res) => {
  try {
    const siteVisitId = String(req.params.id);
    const { technicianIds } = req.body;
    if (!Array.isArray(technicianIds)) {
      res.status(400).json({ error: "technicianIds must be an array" }); return;
    }
    const [existing] = await db.select().from(siteVisits).where(eq(siteVisits.id, siteVisitId));
    if (!existing) { res.status(404).json({ error: "Site visit not found" }); return; }

    await db.delete(siteVisitTechnicians).where(eq(siteVisitTechnicians.siteVisitId, siteVisitId));
    if (technicianIds.length > 0) {
      await db.insert(siteVisitTechnicians).values(
        technicianIds.map((techId: string) => ({
          id: generateId(),
          siteVisitId,
          technicianId: String(techId),
          assignedAt: new Date(),
        }))
      );
    }
    const [result] = await withTechnicianName([existing]);
    res.json({ ...result, technicianIds });
    req.log.info({ siteVisitId, technicianIds }, "Site visit technicians updated");
    for (const techId of technicianIds as string[]) {
      notifyTechnician(techId, {
        pushTitle: "Site Visit Assigned 📍",
        pushBody: `${existing.purpose} — ${existing.customerName}${existing.scheduledDate ? ` on ${existing.scheduledDate}` : ""}`,
        pushData: { type: "site_visit_assigned", id: siteVisitId },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to assign site visit technicians");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /site-visits/:id — admin: any field; technician: status + technicianNotes only
router.patch("/site-visits/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [existing] = await db.select().from(siteVisits).where(eq(siteVisits.id, id));
    if (!existing) { res.status(404).json({ error: "Site visit not found" }); return; }

    if (!req.auth!.isAdmin) {
      const userId = req.auth!.userId;
      let allowed = req.auth!.isTechnician && existing.assignedTo === userId;
      if (!allowed && req.auth!.isTechnician) {
        const [jRow] = await db
          .select()
          .from(siteVisitTechnicians)
          .where(and(eq(siteVisitTechnicians.siteVisitId, id), eq(siteVisitTechnicians.technicianId, userId)));
        allowed = !!jRow;
      }
      if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }
    }

    const updates: Partial<typeof siteVisits.$inferInsert> = {};
    const { customerName, phone, address, city, purpose, notes, assignedTo, scheduledDate, scheduledTime, status, technicianNotes } = req.body;

    if (req.auth!.isAdmin) {
      if (customerName !== undefined) updates.customerName = String(customerName);
      if (phone !== undefined) updates.phone = String(phone);
      if (address !== undefined) updates.address = String(address);
      if (city !== undefined) updates.city = city ? String(city) : null;
      if (purpose !== undefined) updates.purpose = String(purpose);
      if (notes !== undefined) updates.notes = notes ? String(notes) : null;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo ? String(assignedTo) : null;
      if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate ? String(scheduledDate) : null;
      if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime ? String(scheduledTime) : null;
    }
    if (status !== undefined) updates.status = String(status);
    if (technicianNotes !== undefined) updates.technicianNotes = technicianNotes ? String(technicianNotes) : null;

    if (Object.keys(updates).length === 0) {
      const [result] = await withTechnicianName([existing]);
      res.json(result); return;
    }

    const prevAssignedTo = existing.assignedTo;
    const [updated] = await db.update(siteVisits).set(updates).where(eq(siteVisits.id, id)).returning();
    const [result] = await withTechnicianName([updated]);
    req.log.info({ id }, "Site visit updated");
    res.json(result);
    if (updated.assignedTo && updated.assignedTo !== prevAssignedTo) {
      notifyTechnician(updated.assignedTo, {
        pushTitle: "Site Visit Assigned 📍",
        pushBody: `${updated.purpose} — ${updated.customerName}${updated.scheduledDate ? ` on ${updated.scheduledDate}` : ""}`,
        pushData: { type: "site_visit_assigned", id: updated.id },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update site visit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /site-visits/:id — admin only
router.delete("/site-visits/:id", requireAdmin, async (req, res) => {
  try {
    const [deleted] = await db.delete(siteVisits).where(eq(siteVisits.id, String(req.params.id))).returning();
    if (!deleted) { res.status(404).json({ error: "Site visit not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete site visit");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
