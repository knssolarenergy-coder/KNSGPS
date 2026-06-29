import { Router } from "express";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import { db, users, referrals, settings, paymentRequests } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

const router = Router();

const referrerAlias = alias(users, "referrer");
const referredAlias = alias(users, "referred");

// GET /referral/my-stats — return my code, points, balance, referral count
router.get("/referral/my-stats", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const settingsRows = await db.select().from(settings);
    const enabled = settingsRows.find((s) => s.key === "referral_enabled")?.value === "true";
    const moneyPerPoint = parseInt(settingsRows.find((s) => s.key === "referral_money_per_point")?.value ?? "100");

    const myReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));

    res.json({
      enabled,
      code: user.referralCode ?? null,
      points: user.referralPoints,
      balance: user.referralPoints * moneyPerPoint,
      referralCount: myReferrals.length,
    });
  } catch (err) {
    req.log.error({ err }, "Get referral stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /referral/redeem — request a payment for referral points
router.post("/referral/redeem", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.bankName || !user.bankAccountNumber || !user.bankAccountTitle) {
      res.status(400).json({ error: "Please add your bank account details in your profile before requesting payment." });
      return;
    }

    if (user.referralPoints <= 0) {
      res.status(400).json({ error: "You have no points to redeem." });
      return;
    }

    // Check for any pending request already
    const [pending] = await db
      .select()
      .from(paymentRequests)
      .where(and(eq(paymentRequests.userId, user.id), eq(paymentRequests.status, "pending")));
    if (pending) {
      res.status(400).json({ error: "You already have a pending payment request. Please wait for it to be processed." });
      return;
    }

    const settingsRows = await db.select().from(settings);
    const moneyPerPoint = parseInt(settingsRows.find((s) => s.key === "referral_money_per_point")?.value ?? "100");

    const amountPkr = user.referralPoints * moneyPerPoint;
    const pointsUsed = user.referralPoints;

    // Deduct points immediately
    await db
      .update(users)
      .set({ referralPoints: 0 })
      .where(eq(users.id, user.id));

    const [created] = await db
      .insert(paymentRequests)
      .values({
        id: generateId(),
        userId: user.id,
        pointsUsed,
        amountPkr,
        bankName: user.bankName,
        bankAccountNumber: user.bankAccountNumber,
        bankAccountTitle: user.bankAccountTitle,
        status: "pending",
      })
      .returning();

    res.status(201).json(serializePayment(created));
  } catch (err) {
    req.log.error({ err }, "Redeem referral points failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /referral/payments — my payment history
router.get("/referral/payments", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.userId, req.auth!.userId))
      .orderBy(desc(paymentRequests.createdAt));

    res.json(rows.map(serializePayment));
  } catch (err) {
    req.log.error({ err }, "Get my payments failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/referrals — list all referrals with referrer + referred info
router.get("/admin/referrals", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: referrals.id,
        pointsAwarded: referrals.pointsAwarded,
        createdAt: referrals.createdAt,
        referrerId: referrals.referrerId,
        referredId: referrals.referredId,
        referrerName: referrerAlias.name,
        referrerEmail: referrerAlias.email,
        referredName: referredAlias.name,
        referredEmail: referredAlias.email,
      })
      .from(referrals)
      .innerJoin(referrerAlias, eq(referrals.referrerId, referrerAlias.id))
      .innerJoin(referredAlias, eq(referrals.referredId, referredAlias.id))
      .orderBy(desc(referrals.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Get admin referrals failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/payment-requests — all payment requests with user info
router.get("/admin/payment-requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const baseQuery = db
      .select({
        id: paymentRequests.id,
        userId: paymentRequests.userId,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        pointsUsed: paymentRequests.pointsUsed,
        amountPkr: paymentRequests.amountPkr,
        bankName: paymentRequests.bankName,
        bankAccountNumber: paymentRequests.bankAccountNumber,
        bankAccountTitle: paymentRequests.bankAccountTitle,
        status: paymentRequests.status,
        adminNote: paymentRequests.adminNote,
        paidAt: paymentRequests.paidAt,
        createdAt: paymentRequests.createdAt,
      })
      .from(paymentRequests)
      .innerJoin(users, eq(paymentRequests.userId, users.id))
      .orderBy(desc(paymentRequests.createdAt));

    const rows = status && typeof status === "string"
      ? await baseQuery.where(eq(paymentRequests.status, status))
      : await baseQuery;

    res.json(rows.map(serializeAdminPayment));
  } catch (err) {
    req.log.error({ err }, "Get admin payment requests failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/payment-requests/:id — mark as paid or rejected
router.patch("/admin/payment-requests/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status, adminNote } = req.body;

    if (!["paid", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be 'paid' or 'rejected'" });
      return;
    }

    const [existing] = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id));

    if (!existing) {
      res.status(404).json({ error: "Payment request not found" });
      return;
    }
    if (existing.status !== "pending") {
      res.status(400).json({ error: "Only pending requests can be updated" });
      return;
    }

    // If rejected, return points to user
    if (status === "rejected") {
      await db
        .update(users)
        .set({ referralPoints: existing.pointsUsed })
        .where(eq(users.id, existing.userId));
    }

    const [updated] = await db
      .update(paymentRequests)
      .set({
        status,
        adminNote: adminNote ?? null,
        paidAt: status === "paid" ? new Date() : null,
      })
      .where(eq(paymentRequests.id, String(id)))
      .returning();

    // Join with user for response
    const [user] = await db.select().from(users).where(eq(users.id, updated.userId));

    res.json(serializeAdminPayment({ ...updated, userName: user.name, userEmail: user.email, userPhone: user.phone }));
  } catch (err) {
    req.log.error({ err }, "Update payment request failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

function serializePayment(p: typeof paymentRequests.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    pointsUsed: p.pointsUsed,
    amountPkr: p.amountPkr,
    bankName: p.bankName,
    bankAccountNumber: p.bankAccountNumber,
    bankAccountTitle: p.bankAccountTitle,
    status: p.status,
    adminNote: p.adminNote ?? null,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeAdminPayment(p: typeof paymentRequests.$inferSelect & { userName: string; userEmail: string; userPhone: string }) {
  return {
    ...serializePayment(p),
    userName: p.userName,
    userEmail: p.userEmail,
    userPhone: p.userPhone,
  };
}

export default router;
