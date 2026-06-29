import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { db, users, bookings, complaints } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function sanitizeTechnician(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    specialty: user.specialty ?? null,
    status: user.status === "approved" ? "active" : "inactive",
    createdAt: user.createdAt,
  };
}

// GET /technicians — list all technicians (admin only)
router.get("/technicians", requireAuth, requireAdmin, async (req, res) => {
  try {
    const techs = await db.select().from(users)
      .where(eq(users.role, "technician"))
      .orderBy(sql`${users.name} ASC`);
    res.json(techs.map(sanitizeTechnician));
  } catch (err) {
    req.log.error({ err }, "Failed to get technicians");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /technicians — create technician account (admin only)
router.post("/technicians", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, specialty } = req.body;

    if (!name || !email || !phone || !password) {
      res.status(400).json({ error: "Name, email, phone and password are required" });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db.select().from(users)
      .where(eq(users.email, String(email).toLowerCase()));
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const [tech] = await db.insert(users).values({
      id: generateId(),
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone: String(phone).trim(),
      passwordHash,
      isAdmin: false,
      isMaster: false,
      inverterBrand: null,
      status: "approved",
      role: "technician",
      specialty: specialty ? String(specialty).trim() : null,
    }).returning();

    res.status(201).json(sanitizeTechnician(tech));
  } catch (err) {
    req.log.error({ err }, "Failed to create technician");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /technicians/:id — update or deactivate technician (admin only)
router.patch("/technicians/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, specialty, status } = req.body;

    const [existing] = await db.select().from(users)
      .where(and(eq(users.id, String(req.params.id)), eq(users.role, "technician")));

    if (!existing) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (specialty !== undefined) updates.specialty = specialty === null ? null : String(specialty).trim();
    if (status === "active") updates.status = "approved";
    if (status === "inactive") updates.status = "rejected";

    if (email !== undefined) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (normalizedEmail !== existing.email) {
        const [emailConflict] = await db.select().from(users)
          .where(and(eq(users.email, normalizedEmail), ne(users.id, String(req.params.id))));
        if (emailConflict) {
          res.status(400).json({ error: "Email already in use" });
          return;
        }
        updates.email = normalizedEmail;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.json(sanitizeTechnician(existing));
      return;
    }

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, String(req.params.id)))
      .returning();

    res.json(sanitizeTechnician(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update technician");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /bookings/:id/technician — assign/unassign technician to booking (admin only)
router.patch("/bookings/:id/technician", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { technicianId } = req.body;

    const [existing] = await db.select().from(bookings)
      .where(eq(bookings.id, String(req.params.id)));

    if (!existing) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const newTechId = technicianId === null || technicianId === "" ? null : String(technicianId);

    if (newTechId !== null) {
      const [tech] = await db.select().from(users)
        .where(and(eq(users.id, newTechId), eq(users.role, "technician"), eq(users.status, "approved")));
      if (!tech) {
        res.status(400).json({ error: "Assignee must be an active technician" });
        return;
      }
    }

    const [updated] = await db.update(bookings)
      .set({ technicianId: newTechId })
      .where(eq(bookings.id, String(req.params.id)))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to assign booking technician");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
