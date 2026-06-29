import { and, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { db, quotes } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { notifyAdmins } from "../lib/notifications.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

const VALID_PROPERTY_TYPES = ["house", "commercial"] as const;
const VALID_SYSTEM_TYPES = ["on-grid", "hybrid", "off-grid", "day-time", "agri", "commercial-system"] as const;
const VALID_STATUSES = ["submitted", "under_review", "quote_sent", "accepted", "rejected"] as const;
const CUSTOMER_SETTABLE = ["accepted", "rejected"] as const;
const ADMIN_SETTABLE = ["submitted", "under_review", "quote_sent", "accepted", "rejected"] as const;

router.get("/quotes", requireAuth, async (req, res) => {
  try {
    const rows = req.auth!.isAdmin
      ? await db.select().from(quotes).orderBy(sql`${quotes.createdAt} DESC`)
      : await db.select().from(quotes)
          .where(eq(quotes.userId, req.auth!.userId))
          .orderBy(sql`${quotes.createdAt} DESC`);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotes/guest", async (req, res) => {
  try {
    const { customerName, phone, city, address, propertyType, monthlyBill, roofArea, systemType, notes } = req.body;
    if (!customerName || !phone || !city || !address || !propertyType || !monthlyBill || !systemType) {
      res.status(400).json({ error: "customerName, phone, city, address, propertyType, monthlyBill and systemType are required" });
      return;
    }
    if (!VALID_PROPERTY_TYPES.includes(propertyType)) {
      res.status(400).json({ error: "propertyType must be house or commercial" });
      return;
    }
    if (!VALID_SYSTEM_TYPES.includes(systemType)) {
      res.status(400).json({ error: `systemType must be one of: ${VALID_SYSTEM_TYPES.join(", ")}` });
      return;
    }
    const [quote] = await db.insert(quotes).values({
      id: generateId(),
      userId: null,
      customerName: String(customerName).trim(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      address: String(address).trim(),
      propertyType: String(propertyType),
      monthlyBill: String(monthlyBill).trim(),
      roofArea: roofArea ? String(roofArea).trim() : null,
      systemType: String(systemType),
      notes: notes ? String(notes).trim() : null,
      status: "submitted",
    }).returning();
    res.status(201).json(quote);
    notifyAdmins({
      pushTitle: "New Quote Request 💬",
      pushBody: `${quote.systemType} — ${quote.customerName}`,
      pushData: { type: "quote_new", tab: "admin" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create guest quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotes", requireAuth, async (req, res) => {
  try {
    const {
      customerName, phone, city, address,
      propertyType, monthlyBill, roofArea,
      systemType, notes,
    } = req.body;

    if (!customerName || !phone || !city || !address || !propertyType || !monthlyBill || !systemType) {
      res.status(400).json({ error: "customerName, phone, city, address, propertyType, monthlyBill and systemType are required" });
      return;
    }
    if (!VALID_PROPERTY_TYPES.includes(propertyType)) {
      res.status(400).json({ error: "propertyType must be house or commercial" });
      return;
    }
    if (!VALID_SYSTEM_TYPES.includes(systemType)) {
      res.status(400).json({ error: `systemType must be one of: ${VALID_SYSTEM_TYPES.join(", ")}` });
      return;
    }

    const [quote] = await db.insert(quotes).values({
      id: generateId(),
      userId: req.auth!.userId,
      customerName: String(customerName).trim(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      address: String(address).trim(),
      propertyType: String(propertyType),
      monthlyBill: String(monthlyBill).trim(),
      roofArea: roofArea ? String(roofArea).trim() : null,
      systemType: String(systemType),
      notes: notes ? String(notes).trim() : null,
      status: "submitted",
    }).returning();

    res.status(201).json(quote);
    notifyAdmins({
      pushTitle: "New Quote Request 💬",
      pushBody: `${quote.systemType} — ${quote.customerName}`,
      pushData: { type: "quote_new", tab: "admin" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quotes/:id", requireAuth, async (req, res) => {
  try {
    const [quote] = await db.select().from(quotes)
      .where(eq(quotes.id, String(req.params.id)));

    if (!quote) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (!req.auth!.isAdmin && quote.userId !== req.auth!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(quote);
  } catch (err) {
    req.log.error({ err }, "Failed to get quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quotes/:id", requireAuth, async (req, res) => {
  try {
    const [existing] = await db.select().from(quotes)
      .where(eq(quotes.id, String(req.params.id)));

    if (!existing) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    const isAdmin = req.auth!.isAdmin;
    const isOwner = existing.userId === req.auth!.userId;

    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updates: Partial<typeof quotes.$inferInsert> = {};
    const { status, systemSize, priceEstimate, adminNote } = req.body;

    if (status !== undefined) {
      if (isAdmin) {
        if (!ADMIN_SETTABLE.includes(status)) {
          res.status(400).json({ error: `status must be one of: ${ADMIN_SETTABLE.join(", ")}` });
          return;
        }
        updates.status = status;
      } else {
        if (!CUSTOMER_SETTABLE.includes(status)) {
          res.status(400).json({ error: "Customers may only set status to accepted or rejected" });
          return;
        }
        if (existing.status !== "quote_sent") {
          res.status(400).json({ error: "Can only accept or reject a quote that has been sent" });
          return;
        }
        updates.status = status;
      }
    }

    if (isAdmin) {
      if (systemSize !== undefined) updates.systemSize = systemSize === null ? null : String(systemSize).trim();
      if (priceEstimate !== undefined) updates.priceEstimate = priceEstimate === null ? null : String(priceEstimate).trim();
      if (adminNote !== undefined) updates.adminNote = adminNote === null ? null : String(adminNote).trim();
      if (systemSize !== undefined || priceEstimate !== undefined || adminNote !== undefined) {
        updates.respondedAt = new Date();
      }
    }

    if (Object.keys(updates).length === 0) {
      res.json(existing);
      return;
    }

    const [updated] = await db.update(quotes)
      .set(updates)
      .where(eq(quotes.id, String(req.params.id)))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
