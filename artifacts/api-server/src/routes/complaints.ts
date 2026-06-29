import { and, eq, inArray, or, sql } from "drizzle-orm";
import { Router } from "express";
import { db, complaints, users, complaintTechnicians } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { notifyUser, notifyAdmins, notifyTechnician, complaintEmailHtml } from "../lib/notifications.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

const VALID_SUBJECTS = ["Hybrid System", "OnGrid System", "Off-Grid System", "Tubewell System"];
const ALLOWED_STATUSES = ["submitted", "in_progress", "resolved", "closed"];

async function withTechnicianIds(complaintList: (typeof complaints.$inferSelect)[]) {
  if (complaintList.length === 0) return complaintList.map((c) => ({ ...c, technicianIds: [] as string[] }));
  const ids = complaintList.map((c) => c.id);
  const rows = await db
    .select({ complaintId: complaintTechnicians.complaintId, technicianId: complaintTechnicians.technicianId })
    .from(complaintTechnicians)
    .where(inArray(complaintTechnicians.complaintId, ids));
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.complaintId]) map[r.complaintId] = [];
    map[r.complaintId].push(r.technicianId);
  }
  return complaintList.map((c) => ({ ...c, technicianIds: map[c.id] ?? [] }));
}

router.get("/complaints", requireAuth, async (req, res) => {
  try {
    let result: (typeof complaints.$inferSelect)[];
    if (req.auth!.isAdmin) {
      result = await db.select().from(complaints).orderBy(sql`${complaints.createdAt} DESC`);
    } else if (req.auth!.isTechnician) {
      const userId = req.auth!.userId;
      // Technician sees complaints assigned directly OR via junction table
      const junctionRows = await db
        .select({ complaintId: complaintTechnicians.complaintId })
        .from(complaintTechnicians)
        .where(eq(complaintTechnicians.technicianId, userId));
      const junctionIds = junctionRows.map((r) => r.complaintId);
      result = await db
        .select()
        .from(complaints)
        .where(
          junctionIds.length > 0
            ? or(eq(complaints.technicianId, userId), inArray(complaints.id, junctionIds))
            : eq(complaints.technicianId, userId)
        )
        .orderBy(sql`${complaints.createdAt} DESC`);
    } else {
      result = await db
        .select()
        .from(complaints)
        .where(eq(complaints.userId, req.auth!.userId))
        .orderBy(sql`${complaints.createdAt} DESC`);
    }
    res.json(await withTechnicianIds(result));
  } catch (err) {
    req.log.error({ err }, "Failed to get complaints");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/complaints/:id", requireAuth, async (req, res) => {
  try {
    const [complaint] = await db.select().from(complaints)
      .where(eq(complaints.id, String(req.params.id)));

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    const isTech = req.auth!.isTechnician;
    const isAdmin = req.auth!.isAdmin;
    const isOwner = complaint.userId === req.auth!.userId;
    const isAssignedTech = isTech && complaint.technicianId === req.auth!.userId;

    // Also check junction table for technician access
    let isJunctionTech = false;
    if (isTech && !isAssignedTech) {
      const [jRow] = await db
        .select()
        .from(complaintTechnicians)
        .where(and(eq(complaintTechnicians.complaintId, complaint.id), eq(complaintTechnicians.technicianId, req.auth!.userId)));
      isJunctionTech = !!jRow;
    }

    if (!isAdmin && !isOwner && !isAssignedTech && !isJunctionTech) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [withIds] = await withTechnicianIds([complaint]);
    res.json(withIds);
  } catch (err) {
    req.log.error({ err }, "Failed to get complaint");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/complaints", requireAuth, async (req, res) => {
  try {
    const { subject, customerName, phone, address, message, bookingId } = req.body;
    if (!subject || !customerName || !phone || !address || !message) {
      res.status(400).json({ error: "Subject, name, phone, address and message are required" });
      return;
    }

    if (!VALID_SUBJECTS.includes(String(subject))) {
      res.status(400).json({ error: "Invalid system type" });
      return;
    }

    const [complaint] = await db.insert(complaints).values({
      id: generateId(),
      userId: req.auth!.userId,
      bookingId: bookingId ? String(bookingId) : null,
      subject: String(subject),
      customerName: String(customerName),
      phone: String(phone),
      address: String(address),
      message: String(message),
      status: "submitted",
      statusHistory: [{ status: "submitted", changedAt: new Date().toISOString() }],
    }).returning();

    res.status(201).json({ ...complaint, technicianIds: [] });

    notifyUser(req.auth!.userId, {
      emailSubject: "Complaint Received – K&S Solar Energy",
      emailHtml: complaintEmailHtml(complaint.customerName ?? "Customer", complaint.subject, "submitted"),
      pushTitle: "Complaint Received",
      pushBody: `Your complaint about ${complaint.subject} has been received.`,
      pushData: { type: "complaint", id: complaint.id },
    }).catch((err) => req.log.warn({ err }, "Complaint notification failed"));
    notifyAdmins({
      pushTitle: "New Complaint ⚠️",
      pushBody: complaint.subject,
      pushData: { type: "complaint_new", tab: "admin" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create complaint");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/complaints/guest", async (req, res) => {
  try {
    const { subject, customerName, phone, address, message } = req.body;
    if (!subject || !customerName || !phone || !address || !message) {
      res.status(400).json({ error: "Subject, name, phone, address and message are required" });
      return;
    }

    if (!VALID_SUBJECTS.includes(String(subject))) {
      res.status(400).json({ error: "Invalid system type" });
      return;
    }

    const [complaint] = await db.insert(complaints).values({
      id: generateId(),
      userId: null,
      subject: String(subject),
      customerName: String(customerName),
      phone: String(phone),
      address: String(address),
      message: String(message),
      status: "submitted",
      statusHistory: [{ status: "submitted", changedAt: new Date().toISOString() }],
    }).returning();

    res.status(201).json({ ...complaint, technicianIds: [] });
    notifyAdmins({
      pushTitle: "New Complaint ⚠️",
      pushBody: String(subject),
      pushData: { type: "complaint_new" },
    }).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "Failed to create guest complaint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /complaints/:id/technicians — assign multiple technicians (admin only)
router.put("/complaints/:id/technicians", requireAdmin, async (req, res) => {
  try {
    const complaintId = String(req.params.id);
    const { technicianIds } = req.body;
    if (!Array.isArray(technicianIds)) {
      res.status(400).json({ error: "technicianIds must be an array" }); return;
    }

    const [existing] = await db.select().from(complaints).where(eq(complaints.id, complaintId));
    if (!existing) { res.status(404).json({ error: "Complaint not found" }); return; }

    // Replace all assigned technicians
    await db.delete(complaintTechnicians).where(eq(complaintTechnicians.complaintId, complaintId));
    if (technicianIds.length > 0) {
      await db.insert(complaintTechnicians).values(
        technicianIds.map((techId: string) => ({
          id: generateId(),
          complaintId,
          technicianId: String(techId),
          assignedAt: new Date(),
        }))
      );
    }

    const techRows = await db
      .select({ technicianId: complaintTechnicians.technicianId })
      .from(complaintTechnicians)
      .where(eq(complaintTechnicians.complaintId, complaintId));

    res.json({ ...existing, technicianIds: techRows.map((r) => r.technicianId) });
    req.log.info({ complaintId, technicianIds }, "Complaint technicians updated");

    // Notify each newly assigned technician
    for (const techId of technicianIds as string[]) {
      notifyTechnician(techId, {
        pushTitle: "Complaint Assigned ⚠️",
        pushBody: `Subject: ${existing.subject} — ${existing.customerName}`,
        pushData: { type: "complaint_assigned", id: complaintId },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to assign complaint technicians");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /complaints/:id — update status and/or technician info (admin, or assigned technician for status only)
router.patch("/complaints/:id", requireAuth, async (req, res) => {
  try {
    const isTech = req.auth!.isTechnician;
    const isAdmin = req.auth!.isAdmin;

    if (!isAdmin && !isTech) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { status, technicianName, technicianPhone } = req.body;

    if (status !== undefined && !ALLOWED_STATUSES.includes(String(status))) {
      res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` });
      return;
    }

    const [existing] = await db.select().from(complaints)
      .where(eq(complaints.id, String(req.params.id)));

    if (!existing) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    // Technicians: only allow status update on complaints assigned to them (direct or junction)
    if (isTech && !isAdmin) {
      let allowed = existing.technicianId === req.auth!.userId;
      if (!allowed) {
        const [jRow] = await db
          .select()
          .from(complaintTechnicians)
          .where(and(eq(complaintTechnicians.complaintId, existing.id), eq(complaintTechnicians.technicianId, req.auth!.userId)));
        allowed = !!jRow;
      }
      if (!allowed) {
        res.status(403).json({ error: "You can only update complaints assigned to you" });
        return;
      }
      const TECH_ALLOWED = ["in_progress", "resolved"];
      if (status === undefined || !TECH_ALLOWED.includes(String(status))) {
        res.status(400).json({ error: "Technicians can only set status to in_progress or resolved" });
        return;
      }
      const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
      const statusChanged = existing.status !== String(status);
      const [updated] = await db.update(complaints)
        .set({
          status: String(status),
          statusHistory: statusChanged
            ? [...history, { status: String(status), changedAt: new Date().toISOString() }]
            : history,
        })
        .where(eq(complaints.id, String(req.params.id)))
        .returning();
      const [withIds] = await withTechnicianIds([updated]);
      res.json(withIds);

      if (statusChanged && updated.userId) {
        notifyUser(updated.userId, {
          emailSubject: "Complaint Update – K&S Solar Energy",
          emailHtml: complaintEmailHtml(updated.customerName ?? "Customer", updated.subject, updated.status),
          pushTitle: updated.status === "resolved" ? "Complaint Resolved ✓" : "Complaint Update",
          pushBody: `Your complaint about ${updated.subject} is now ${updated.status}.`,
          pushData: { type: "complaint", id: updated.id, status: updated.status },
        }).catch((err) => req.log.warn({ err }, "Complaint status notification failed"));
      }
      return;
    }

    // Admin path — full update
    const updates: Record<string, unknown> = {};
    const statusChanged = status !== undefined && existing.status !== String(status);
    if (status !== undefined) {
      updates.status = String(status);
      if (statusChanged) {
        const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
        updates.statusHistory = [
          ...history,
          { status: String(status), changedAt: new Date().toISOString() },
        ];
      }
    }
    if (technicianName !== undefined) {
      updates.technicianName = technicianName === null ? null : String(technicianName);
    }
    if (technicianPhone !== undefined) {
      updates.technicianPhone = technicianPhone === null ? null : String(technicianPhone);
    }
    const { technicianId } = req.body;
    if (technicianId !== undefined) {
      const newTechId = technicianId === null || technicianId === "" ? null : String(technicianId);
      if (newTechId !== null) {
        const [tech] = await db.select().from(users)
          .where(and(eq(users.id, newTechId), eq(users.role, "technician"), eq(users.status, "approved")));
        if (!tech) {
          res.status(400).json({ error: "Assignee must be an active technician" });
          return;
        }
      }
      updates.technicianId = newTechId;
    }

    if (Object.keys(updates).length === 0) {
      const [withIds] = await withTechnicianIds([existing]);
      res.json(withIds);
      return;
    }

    const prevTechId = existing.technicianId;
    const [updated] = await db.update(complaints)
      .set(updates)
      .where(eq(complaints.id, String(req.params.id)))
      .returning();

    const [withIds] = await withTechnicianIds([updated]);
    res.json(withIds);

    if (statusChanged && updated.userId) {
      notifyUser(updated.userId, {
        emailSubject: "Complaint Update – K&S Solar Energy",
        emailHtml: complaintEmailHtml(updated.customerName ?? "Customer", updated.subject, updated.status),
        pushTitle: updated.status === "resolved" ? "Complaint Resolved ✓" : "Complaint Update",
        pushBody: `Your complaint about ${updated.subject} is now ${updated.status}.`,
        pushData: { type: "complaint", id: updated.id, status: updated.status },
      }).catch((err) => req.log.warn({ err }, "Complaint status notification failed"));
    }
    const newTechId = updated.technicianId;
    if (newTechId && newTechId !== prevTechId) {
      notifyTechnician(newTechId, {
        pushTitle: "Complaint Assigned ⚠️",
        pushBody: `Subject: ${updated.subject}`,
        pushData: { type: "complaint_assigned", id: updated.id },
      }).catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update complaint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Legacy PATCH /complaints/:id/status — kept for backward compat
router.patch("/complaints/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = [...ALLOWED_STATUSES, "open", "in_review"];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const [existing] = await db.select().from(complaints)
      .where(eq(complaints.id, String(req.params.id)));

    if (!existing) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
    const statusChanged = existing.status !== String(status);
    const [complaint] = await db.update(complaints)
      .set({
        status: String(status),
        statusHistory: statusChanged
          ? [...history, { status: String(status), changedAt: new Date().toISOString() }]
          : history,
      })
      .where(eq(complaints.id, String(req.params.id)))
      .returning();

    const [withIds] = await withTechnicianIds([complaint]);
    res.json(withIds);

    if (statusChanged && complaint.userId) {
      notifyUser(complaint.userId, {
        emailSubject: "Complaint Update – K&S Solar Energy",
        emailHtml: complaintEmailHtml(complaint.customerName ?? "Customer", complaint.subject, complaint.status),
        pushTitle: complaint.status === "resolved" ? "Complaint Resolved ✓" : "Complaint Update",
        pushBody: `Your complaint about ${complaint.subject} is now ${complaint.status}.`,
        pushData: { type: "complaint", id: complaint.id, status: complaint.status },
      }).catch((err) => req.log.warn({ err }, "Complaint legacy status notification failed"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update complaint status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
