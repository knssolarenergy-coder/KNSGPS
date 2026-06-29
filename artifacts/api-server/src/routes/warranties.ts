import { and, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { db, warranties } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

const VALID_TYPES = ["inverter", "panels", "battery", "installation"] as const;

function computeStatus(purchaseDate: string, durationMonths: number): "active" | "expiring_soon" | "expired" {
  const purchase = new Date(purchaseDate);
  const expiry = new Date(purchase);
  expiry.setMonth(expiry.getMonth() + durationMonths);
  const now = new Date();
  const msIn60Days = 60 * 24 * 60 * 60 * 1000;
  if (expiry < now) return "expired";
  if (expiry.getTime() - now.getTime() < msIn60Days) return "expiring_soon";
  return "active";
}

function formatExpiry(purchaseDate: string, durationMonths: number): string {
  const purchase = new Date(purchaseDate);
  const expiry = new Date(purchase);
  expiry.setMonth(expiry.getMonth() + durationMonths);
  return expiry.toISOString().slice(0, 10);
}

function enrichWarranty(w: typeof warranties.$inferSelect) {
  return {
    ...w,
    expiryDate: formatExpiry(w.purchaseDate, w.durationMonths),
    warrantyStatus: computeStatus(w.purchaseDate, w.durationMonths),
  };
}

// Public endpoint — no auth required
router.get("/warranties/search", async (req, res) => {
  try {
    const { invoiceNumber } = req.query as { invoiceNumber?: string };
    if (!invoiceNumber || !invoiceNumber.trim()) {
      res.status(400).json({ error: "invoiceNumber query parameter is required" });
      return;
    }
    const [row] = await db.select().from(warranties)
      .where(eq(warranties.invoiceNumber, invoiceNumber.trim().toUpperCase()));
    if (!row) {
      res.status(404).json({ error: "No warranty found for this invoice number" });
      return;
    }
    res.json(enrichWarranty(row));
  } catch (err) {
    req.log.error({ err }, "Failed to search warranty by invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/warranties", requireAuth, async (req, res) => {
  try {
    const { userId: queryUserId } = req.query as { userId?: string };
    let rows: (typeof warranties.$inferSelect)[];
    if (req.auth!.isAdmin) {
      rows = queryUserId
        ? await db.select().from(warranties).where(eq(warranties.userId, queryUserId)).orderBy(sql`${warranties.createdAt} DESC`)
        : await db.select().from(warranties).orderBy(sql`${warranties.createdAt} DESC`);
    } else {
      rows = await db.select().from(warranties)
        .where(eq(warranties.userId, req.auth!.userId))
        .orderBy(sql`${warranties.createdAt} DESC`);
    }
    res.json(rows.map(enrichWarranty));
  } catch (err) {
    req.log.error({ err }, "Failed to get warranties");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warranties", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, invoiceNumber, warrantyType, brand, model, purchaseDate, durationMonths, notes } = req.body;
    if (!userId || !warrantyType || !brand || !purchaseDate || !durationMonths) {
      res.status(400).json({ error: "userId, warrantyType, brand, purchaseDate and durationMonths are required" });
      return;
    }
    if (!VALID_TYPES.includes(warrantyType)) {
      res.status(400).json({ error: `warrantyType must be one of: ${VALID_TYPES.join(", ")}` });
      return;
    }
    const dur = parseInt(String(durationMonths), 10);
    if (isNaN(dur) || dur < 1) {
      res.status(400).json({ error: "durationMonths must be a positive integer" });
      return;
    }
    const [w] = await db.insert(warranties).values({
      id: generateId(),
      userId: String(userId),
      invoiceNumber: invoiceNumber ? String(invoiceNumber).trim().toUpperCase() : null,
      warrantyType: String(warrantyType),
      brand: String(brand).trim(),
      model: model ? String(model).trim() : null,
      purchaseDate: String(purchaseDate),
      durationMonths: dur,
      notes: notes ? String(notes).trim() : null,
    }).returning();
    res.status(201).json(enrichWarranty(w));
  } catch (err) {
    req.log.error({ err }, "Failed to create warranty");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/warranties/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [existing] = await db.select().from(warranties).where(eq(warranties.id, String(req.params.id)));
    if (!existing) {
      res.status(404).json({ error: "Warranty not found" });
      return;
    }
    const updates: Partial<typeof warranties.$inferInsert> = {};
    const { invoiceNumber, warrantyType, brand, model, purchaseDate, durationMonths, notes } = req.body;
    if (invoiceNumber !== undefined) updates.invoiceNumber = invoiceNumber === null ? null : String(invoiceNumber).trim().toUpperCase();
    if (warrantyType !== undefined) {
      if (!VALID_TYPES.includes(warrantyType)) {
        res.status(400).json({ error: `warrantyType must be one of: ${VALID_TYPES.join(", ")}` });
        return;
      }
      updates.warrantyType = String(warrantyType);
    }
    if (brand !== undefined) updates.brand = String(brand).trim();
    if (model !== undefined) updates.model = model === null ? null : String(model).trim();
    if (purchaseDate !== undefined) updates.purchaseDate = String(purchaseDate);
    if (durationMonths !== undefined) {
      const dur = parseInt(String(durationMonths), 10);
      if (isNaN(dur) || dur < 1) {
        res.status(400).json({ error: "durationMonths must be a positive integer" });
        return;
      }
      updates.durationMonths = dur;
    }
    if (notes !== undefined) updates.notes = notes === null ? null : String(notes).trim();
    if (Object.keys(updates).length === 0) {
      res.json(enrichWarranty(existing));
      return;
    }
    const [updated] = await db.update(warranties).set(updates).where(eq(warranties.id, String(req.params.id))).returning();
    res.json(enrichWarranty(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update warranty");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/warranties/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [existing] = await db.select().from(warranties).where(eq(warranties.id, String(req.params.id)));
    if (!existing) {
      res.status(404).json({ error: "Warranty not found" });
      return;
    }
    await db.delete(warranties).where(eq(warranties.id, String(req.params.id)));
    res.json({ message: "Warranty deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete warranty");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
