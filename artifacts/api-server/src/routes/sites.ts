import { and, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import { db, sites, siteTechnicians, users } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

type SiteWithTechs = (typeof sites.$inferSelect) & { technicianIds: string[] };

async function withTechnicianIds(siteList: (typeof sites.$inferSelect)[]): Promise<SiteWithTechs[]> {
  if (siteList.length === 0) return [];
  const ids = siteList.map((s) => s.id);
  const rows = await db
    .select({ siteId: siteTechnicians.siteId, technicianId: siteTechnicians.technicianId })
    .from(siteTechnicians)
    .where(inArray(siteTechnicians.siteId, ids));
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.siteId]) map[row.siteId] = [];
    map[row.siteId].push(row.technicianId);
  }
  return siteList.map((s) => ({ ...s, technicianIds: map[s.id] ?? [] }));
}

// GET /sites — admin: all, technician: assigned
router.get("/sites", requireAuth, async (req, res) => {
  try {
    let raw: (typeof sites.$inferSelect)[];
    if (req.auth!.isAdmin) {
      raw = await db.select().from(sites).orderBy(sql`${sites.createdAt} DESC`);
    } else if (req.auth!.isTechnician) {
      const assigned = await db
        .select({ siteId: siteTechnicians.siteId })
        .from(siteTechnicians)
        .where(eq(siteTechnicians.technicianId, req.auth!.userId));
      const siteIds = assigned.map((r) => r.siteId);
      if (siteIds.length === 0) { res.json([]); return; }
      raw = await db.select().from(sites).where(inArray(sites.id, siteIds)).orderBy(sql`${sites.createdAt} DESC`);
    } else {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(await withTechnicianIds(raw));
  } catch (err) {
    req.log.error({ err }, "Failed to get sites");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /sites — admin only
router.post("/sites", requireAdmin, async (req, res) => {
  try {
    const { name, address, city, clientName, clientPhone, notes, technicianIds } = req.body;
    if (!name || !address || !city || !clientName || !clientPhone) {
      res.status(400).json({ error: "name, address, city, clientName, clientPhone are required" }); return;
    }
    const siteId = generateId();
    const [site] = await db.insert(sites).values({
      id: siteId,
      name: String(name),
      address: String(address),
      city: String(city),
      clientName: String(clientName),
      clientPhone: String(clientPhone),
      notes: notes ? String(notes) : null,
      status: "active",
    }).returning();

    if (Array.isArray(technicianIds) && technicianIds.length > 0) {
      await db.insert(siteTechnicians).values(
        technicianIds.map((techId: string) => ({
          id: generateId(),
          siteId,
          technicianId: String(techId),
        }))
      );
    }
    const [result] = await withTechnicianIds([site]);
    req.log.info({ siteId }, "Site created");
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create site");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /sites/:id — admin only
router.patch("/sites/:id", requireAdmin, async (req, res) => {
  try {
    const { name, address, city, clientName, clientPhone, notes, status } = req.body;
    const updates: Partial<typeof sites.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name);
    if (address !== undefined) updates.address = String(address);
    if (city !== undefined) updates.city = String(city);
    if (clientName !== undefined) updates.clientName = String(clientName);
    if (clientPhone !== undefined) updates.clientPhone = String(clientPhone);
    if (notes !== undefined) updates.notes = notes ? String(notes) : null;
    if (status !== undefined) updates.status = String(status);

    const [updated] = await db.update(sites).set(updates).where(eq(sites.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Site not found" }); return; }
    const [result] = await withTechnicianIds([updated]);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update site");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /sites/:id — admin only
router.delete("/sites/:id", requireAdmin, async (req, res) => {
  try {
    const [deleted] = await db.delete(sites).where(eq(sites.id, String(req.params.id))).returning();
    if (!deleted) { res.status(404).json({ error: "Site not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete site");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /sites/:id/technicians — admin only
router.put("/sites/:id/technicians", requireAdmin, async (req, res) => {
  try {
    const { technicianIds } = req.body;
    if (!Array.isArray(technicianIds)) {
      res.status(400).json({ error: "technicianIds must be an array" }); return;
    }
    const siteId = String(req.params.id);
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId));
    if (!site) { res.status(404).json({ error: "Site not found" }); return; }
    await db.delete(siteTechnicians).where(eq(siteTechnicians.siteId, siteId));
    if (technicianIds.length > 0) {
      await db.insert(siteTechnicians).values(
        technicianIds.map((techId: string) => ({
          id: generateId(),
          siteId,
          technicianId: String(techId),
        }))
      );
    }
    const [result] = await withTechnicianIds([site]);
    req.log.info({ siteId, technicianIds }, "Site technicians updated");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to assign site technicians");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
