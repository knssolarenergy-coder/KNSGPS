import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq, ne, count } from "drizzle-orm";
import { Router } from "express";
import { Resend } from "resend";
import { db, users, referrals, settings, passwordResetTokens, bookings, complaints, quotes, warranties } from "@workspace/db";
import { signToken, verifyToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import PDFDocument from "pdfkit";

function getResend() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return null;
  return new Resend(key);
}

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function ensureReferralCode(user: typeof users.$inferSelect): Promise<typeof users.$inferSelect> {
  if (user.referralCode) return user;
  let code: string;
  let collision = true;
  do {
    code = generateReferralCode();
    const [ex] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code));
    collision = !!ex;
  } while (collision);
  const [updated] = await db.update(users).set({ referralCode: code }).where(eq(users.id, user.id)).returning();
  return updated;
}

function sanitizeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isAdmin: user.isAdmin,
    isMaster: user.isMaster,
    inverterBrand: user.inverterBrand ?? null,
    city: user.city ?? null,
    status: user.status,
    role: user.role,
    specialty: user.specialty ?? null,
    createdAt: user.createdAt,
    referralCode: user.referralCode ?? null,
    referralPoints: user.referralPoints ?? 0,
    bankName: user.bankName ?? null,
    bankAccountNumber: user.bankAccountNumber ?? null,
    bankAccountTitle: user.bankAccountTitle ?? null,
  };
}

function sanitizeAdminUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isAdmin: user.isAdmin,
    isMaster: user.isMaster,
    inverterBrand: user.inverterBrand ?? null,
    status: user.status,
    role: user.role,
    specialty: user.specialty ?? null,
    createdAt: user.createdAt,
  };
}

// Register — creates a pending account, does NOT issue a token
router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, isMaster, inverterBrand, referralCode } = req.body;

    if (!name || !email || !phone || !password) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.email, String(email).toLowerCase()));
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const masterFlag = isMaster === true || isMaster === "true";
    const brand = masterFlag ? null : (inverterBrand ? String(inverterBrand) : null);

    // Generate unique referral code (retry if collision)
    let newReferralCode: string;
    let collision = true;
    do {
      newReferralCode = generateReferralCode();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, newReferralCode));
      collision = !!existing;
    } while (collision);

    const passwordHash = await bcrypt.hash(String(password), 10);
    const newId = generateId();
    // Store referral code used (points awarded on admin approval, not at registration)
    const usedReferralCode = referralCode && typeof referralCode === "string"
      ? referralCode.toUpperCase().trim()
      : null;

    await db.insert(users).values({
      id: newId,
      name: String(name),
      email: String(email).toLowerCase(),
      phone: String(phone),
      passwordHash,
      isAdmin: false,
      isMaster: masterFlag,
      inverterBrand: brand,
      status: "pending",
      referralCode: newReferralCode,
      referredByCode: usedReferralCode,
    });

    res.status(201).json({ message: "Account request submitted. Admin will review and approve your account.", pending: true });
  } catch (err) {
    req.log.error({ err }, "Register failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login — blocked for pending/rejected accounts
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase()));
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "pending") {
      res.status(403).json({ error: "pending", message: "Your account is awaiting admin approval. Please contact K&S Solar Energy to get approved." });
      return;
    }
    if (user.status === "rejected") {
      res.status(403).json({ error: "rejected", message: "Your account request was not approved. Please contact K&S Solar Energy for assistance." });
      return;
    }

    const finalUser = await ensureReferralCode(user);
    const token = signToken({ userId: finalUser.id, isAdmin: finalUser.isAdmin, isTechnician: finalUser.role === "technician" });
    res.json({ token, user: sanitizeUser(finalUser) });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get own profile
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const finalUser = await ensureReferralCode(user);
    res.json(sanitizeUser(finalUser));
  } catch (err) {
    req.log.error({ err }, "Get me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update own profile (name, phone, city, bank account)
router.patch("/auth/me", requireAuth, async (req, res) => {
  try {
    const { name, phone, city, bankName, bankAccountNumber, bankAccountTitle, inverterBrand } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: "Name and phone are required" });
      return;
    }

    const updates: {
      name: string; phone: string; city?: string | null;
      bankName?: string | null; bankAccountNumber?: string | null; bankAccountTitle?: string | null;
      inverterBrand?: string | null;
    } = {
      name: String(name).trim(),
      phone: String(phone).trim(),
    };
    if (city !== undefined) {
      updates.city = city === null ? null : String(city).trim() || null;
    }
    if (bankName !== undefined) updates.bankName = bankName ? String(bankName).trim() : null;
    if (bankAccountNumber !== undefined) updates.bankAccountNumber = bankAccountNumber ? String(bankAccountNumber).trim() : null;
    if (bankAccountTitle !== undefined) updates.bankAccountTitle = bankAccountTitle ? String(bankAccountTitle).trim() : null;
    if (inverterBrand !== undefined) updates.inverterBrand = inverterBrand ? String(inverterBrand).trim() : null;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.auth!.userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(sanitizeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Update profile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot password — sends secure reset link to user's email
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db.select().from(users)
      .where(eq(users.email, String(email).toLowerCase().trim()));

    // Always respond with success to prevent email enumeration
    if (!user || user.isAdmin) {
      res.json({ message: "If this email is registered, a reset link has been sent." });
      return;
    }

    // Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      userId: user.id,
      token,
      expiresAt,
    });

    // Build reset URL from REPLIT_DOMAINS
    const domain = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
    const resetUrl = domain
      ? `https://${domain}/(auth)/reset-password?token=${token}`
      : `http://localhost:3000/(auth)/reset-password?token=${token}`;

    const resendClient = getResend();
    if (resendClient) {
      const emailResult = await resendClient.emails.send({
        from: "K&S Solar Energy <noreply@knssolar.com.pk>",
        to: user.email,
        subject: "Reset Your Password — K&S Solar Energy",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1E3A5F;padding:32px 40px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">☀️</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">K&amp;S Solar Energy</h1>
            <p style="color:#ffffffcc;margin:6px 0 0;font-size:13px;">Password Reset Request</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#1a1a2e;font-size:16px;margin:0 0 12px;">Hello <strong>${user.name}</strong>,</p>
            <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 28px;">
              We received a request to reset your password. Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${resetUrl}" style="display:inline-block;background:#1E3A5F;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">Reset Password</a>
            </div>
            <p style="color:#888;font-size:12px;line-height:1.6;margin:0 0 8px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color:#1E3A5F;font-size:12px;word-break:break-all;margin:0 0 28px;">${resetUrl}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px;">
            <p style="color:#aaa;font-size:12px;margin:0;">
              If you didn't request this, please ignore this email — your password will remain unchanged.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#bbb;font-size:11px;margin:0;">© K&amp;S Solar Energy · Pakistan</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
      if (emailResult.error) {
        req.log.warn({ resendError: emailResult.error, to: user.email }, "Resend error on password reset email");
      } else {
        req.log.info({ emailId: emailResult.data?.id, to: user.email }, "Password reset email sent");
      }
    }

    res.json({ message: "If this email is registered, a reset link has been sent." });
  } catch (err) {
    req.log.error({ err }, "Forgot password failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset password using token from email link
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, String(token)));

    if (!resetToken) {
      res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      return;
    }
    if (resetToken.usedAt) {
      res.status(400).json({ error: "This reset link has already been used. Please request a new one." });
      return;
    }
    if (new Date() > resetToken.expiresAt) {
      res.status(400).json({ error: "This reset link has expired (valid for 1 hour). Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetToken.userId))
      .returning();
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Issue JWT so the client can log in immediately after reset
    const jwtToken = signToken({
      userId: updatedUser.id,
      isAdmin: updatedUser.isAdmin,
      isTechnician: updatedUser.role === "technician",
    });

    req.log.info({ userId: resetToken.userId }, "Password reset via email token");
    res.json({ message: "Password reset successfully.", token: jwtToken, user: sanitizeUser(updatedUser) });
  } catch (err) {
    req.log.error({ err }, "Reset password failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Change own password
router.patch("/auth/me/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new passwords are required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, req.auth!.userId));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    req.log.error({ err }, "Change password failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: list all non-admin users
router.get("/admin/users", requireAuth, async (req, res) => {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const allUsers = await db.select().from(users).where(ne(users.isAdmin, true));
    res.json(allUsers.map(sanitizeAdminUser));
  } catch (err) {
    req.log.error({ err }, "Get admin users failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: reset user password
router.patch("/admin/users/:id/password", requireAuth, async (req, res) => {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const [updated] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, String(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    req.log.error({ err }, "Admin reset password failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: update user status
router.patch("/admin/users/:id/status", requireAuth, async (req, res) => {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(String(status))) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ status: String(status) })
      .where(eq(users.id, String(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Award referral points when a user is approved for the first time
    if (String(status) === "approved" && updated.referredByCode) {
      try {
        const settingsRows = await db.select().from(settings);
        const referralEnabled = settingsRows.find((s) => s.key === "referral_enabled")?.value === "true";
        if (referralEnabled) {
          // Check not already awarded (no duplicate referral record)
          const [existing] = await db
            .select({ id: referrals.id })
            .from(referrals)
            .where(eq(referrals.referredId, updated.id));

          if (!existing) {
            const [referrer] = await db
              .select()
              .from(users)
              .where(eq(users.referralCode, updated.referredByCode));

            if (referrer && referrer.id !== updated.id) {
              const pointsPerReferral = parseInt(
                settingsRows.find((s) => s.key === "referral_points_per_referral")?.value ?? "10"
              );
              await db
                .update(users)
                .set({ referralPoints: referrer.referralPoints + pointsPerReferral })
                .where(eq(users.id, referrer.id));
              await db.insert(referrals).values({
                id: generateId(),
                referrerId: referrer.id,
                referredId: updated.id,
                pointsAwarded: pointsPerReferral,
              });
              req.log.info(
                { referrerId: referrer.id, referredId: updated.id, points: pointsPerReferral },
                "Referral points awarded on approval"
              );
            }
          }
        }
      } catch (refErr) {
        req.log.warn({ refErr }, "Referral award on approval failed (non-fatal)");
      }
    }

    res.json(sanitizeAdminUser(updated));
  } catch (err) {
    req.log.error({ err }, "Update user status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: delete a user account (cannot delete admin accounts)
router.delete("/admin/users/:id", requireAuth, async (req, res) => {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { id } = req.params;
    const [target] = await db.select().from(users).where(eq(users.id, String(id)));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.isAdmin) {
      res.status(400).json({ error: "Cannot delete admin accounts" });
      return;
    }
    await db.delete(users).where(eq(users.id, String(id)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper: compute warranty status and expiry date from purchaseDate + durationMonths
function computeWarrantyExpiry(purchaseDate: string, durationMonths: number) {
  const purchase = new Date(purchaseDate);
  const expiry = new Date(purchase);
  expiry.setMonth(expiry.getMonth() + durationMonths);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let warrantyStatus: string;
  if (daysLeft <= 0) warrantyStatus = "expired";
  else if (daysLeft <= 30) warrantyStatus = "expiring_soon";
  else warrantyStatus = "active";
  return { expiryDate: expiry.toISOString().split("T")[0]!, warrantyStatus };
}

// Helper: build customer report data
async function buildCustomerReport(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.isAdmin) return null;

  const userBookings = await db.select().from(bookings).where(eq(bookings.userId, userId));
  const userComplaints = await db.select().from(complaints).where(eq(complaints.userId, userId));
  const userWarranties = await db.select().from(warranties).where(eq(warranties.userId, userId));
  const userQuotes = await db.select().from(quotes).where(eq(quotes.userId, userId));
  const [refCount] = await db.select({ c: count() }).from(referrals).where(eq(referrals.referrerId, userId));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city ?? null,
      status: user.status,
      role: user.role,
      inverterBrand: user.inverterBrand ?? null,
      referralCode: user.referralCode ?? null,
      referralPoints: user.referralPoints,
      createdAt: user.createdAt.toISOString(),
    },
    bookings: userBookings.map(b => ({
      id: b.id,
      customerName: b.customerName,
      status: b.status,
      preferredDate: b.preferredDate,
      city: b.city,
      createdAt: b.createdAt.toISOString(),
    })),
    complaints: userComplaints.map(c => ({
      id: c.id,
      subject: c.subject,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    warranties: userWarranties.map(w => {
      const { expiryDate, warrantyStatus } = computeWarrantyExpiry(w.purchaseDate, w.durationMonths);
      return {
        id: w.id,
        warrantyType: w.warrantyType,
        brand: w.brand,
        model: w.model ?? null,
        purchaseDate: w.purchaseDate,
        durationMonths: w.durationMonths,
        expiryDate,
        warrantyStatus,
      };
    }),
    quotes: userQuotes.map(q => ({
      id: q.id,
      systemType: q.systemType,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    })),
    referralCount: refCount?.c ?? 0,
  };
}

// GET /admin/users/:id/report — customer activity report JSON (admin only)
router.get("/admin/users/:id/report", requireAuth, async (req, res) => {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const report = await buildCustomerReport(String(req.params.id));
    if (!report) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Get customer report failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/users/:id/report/pdf — customer report PDF (admin only)
// Accepts Bearer header OR ?token= query param (for mobile Linking.openURL)
router.get("/admin/users/:id/report/pdf", async (req, res) => {
  const { token: queryToken } = req.query as { token?: string };
  if (!req.auth) {
    const rawToken = queryToken ?? req.headers.authorization?.replace(/^Bearer /, "");
    if (!rawToken) { res.status(401).json({ error: "Unauthorized" }); return; }
    try { req.auth = verifyToken(rawToken); }
    catch { res.status(401).json({ error: "Invalid or expired token" }); return; }
  }
  if (!req.auth.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    const report = await buildCustomerReport(String(req.params.id));
    if (!report) { res.status(404).json({ error: "User not found" }); return; }

    const safeName = report.user.name.replace(/\s+/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="customer-${safeName}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    const BLUE = "#1E3A5F";
    const GRAY = "#555555";
    const BLACK = "#111111";
    const GREEN = "#10B981";
    const RED = "#EF4444";
    const AMBER = "#F59E0B";

    // Header band
    doc.rect(0, 0, doc.page.width, 80).fill(BLUE);
    doc.fontSize(22).fillColor("#FFFFFF").text("K&S Solar Energy", 50, 20, { align: "center" });
    doc.fontSize(11).fillColor("#FFFFFFBB").text("Customer Activity Report", 50, 50, { align: "center" });

    // User info box
    doc.roundedRect(50, 95, doc.page.width - 100, 80, 8).fillAndStroke("#F0F4F8", "#CBD5E1");
    doc.fontSize(14).fillColor(BLUE).text(report.user.name, 66, 107);
    doc.fontSize(10).fillColor(GRAY).text(`${report.user.email}  ·  ${report.user.phone}`, 66, 128);
    doc.fontSize(10).fillColor(GRAY).text(`City: ${report.user.city ?? "N/A"}  ·  Role: ${report.user.role}  ·  Status: ${report.user.status}`, 66, 145);
    doc.fontSize(10).fillColor(GRAY).text(`Member since: ${new Date(report.user.createdAt).toLocaleDateString("en-PK")}  ·  Referral points: ${report.user.referralPoints}  ·  Referrals made: ${report.referralCount}`, 66, 162);

    doc.y = 195;

    function drawSection(title: string, rows: string[][], headers: string[], colWidths: number[]) {
      if (doc.y > doc.page.height - 100) { doc.addPage(); doc.y = 50; }
      doc.fontSize(12).fillColor(BLUE).text(title, 50, doc.y);
      doc.moveTo(50, doc.y + 1).lineTo(doc.page.width - 50, doc.y + 1).strokeColor("#CBD5E1").stroke();
      doc.y += 8;

      if (rows.length === 0) {
        doc.fontSize(9).fillColor(GRAY).text("No records.", 60, doc.y);
        doc.y += 16;
        doc.moveDown(0.5);
        return;
      }

      // Header row
      let x = 60;
      doc.rect(50, doc.y - 2, doc.page.width - 100, 16).fill(BLUE);
      headers.forEach((h, i) => {
        doc.fontSize(8).fillColor("#FFFFFF").text(h, x, doc.y, { width: colWidths[i]! - 4 });
        x += colWidths[i]!;
      });
      doc.y += 14;

      rows.forEach((row, ri) => {
        if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = 50; }
        doc.rect(50, doc.y - 2, doc.page.width - 100, 16).fill(ri % 2 === 0 ? "#F8FAFC" : "#FFFFFF");
        let cx = 60;
        row.forEach((cell, ci) => {
          const isStatus = ci === row.length - 1;
          let color = BLACK;
          if (isStatus) {
            const sl = cell.toLowerCase();
            color = (sl === "completed" || sl === "active" || sl === "resolved" || sl === "approved" || sl === "accepted") ? GREEN
              : (sl === "cancelled" || sl === "rejected" || sl === "expired") ? RED
              : AMBER;
          }
          doc.fontSize(8).fillColor(color).text(cell, cx, doc.y, { width: colWidths[ci]! - 4 });
          cx += colWidths[ci]!;
        });
        doc.y += 16;
      });
      doc.moveDown(0.6);
    }

    drawSection(
      `Bookings (${report.bookings.length})`,
      report.bookings.map(b => [b.customerName, b.preferredDate, b.city, b.status]),
      ["Customer", "Date", "City", "Status"],
      [130, 100, 120, 100]
    );

    drawSection(
      `Complaints (${report.complaints.length})`,
      report.complaints.map(c => [c.subject, new Date(c.createdAt).toLocaleDateString("en-PK"), c.status]),
      ["Subject", "Date", "Status"],
      [230, 120, 100]
    );

    drawSection(
      `Warranties (${report.warranties.length})`,
      report.warranties.map(w => [w.warrantyType, w.brand, w.purchaseDate, w.expiryDate, w.warrantyStatus]),
      ["Type", "Brand", "Purchase", "Expiry", "Status"],
      [80, 130, 90, 90, 80]
    );

    drawSection(
      `Quotes (${report.quotes.length})`,
      report.quotes.map(q => [q.systemType, new Date(q.createdAt).toLocaleDateString("en-PK"), q.status]),
      ["System Type", "Date", "Status"],
      [200, 120, 110]
    );

    // Footer
    doc.y = doc.page.height - 50;
    doc.fontSize(8).fillColor("#AAAAAA").text(
      `Generated by K&S Solar Energy  ·  ${new Date().toLocaleDateString("en-PK")}`,
      50, doc.y, { align: "center", width: doc.page.width - 100 }
    );
    doc.end();
  } catch (err) {
    req.log.error({ err }, "Customer report PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save Expo push token for the authenticated user
router.post("/auth/push-token", requireAuth, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== "string") {
      res.status(400).json({ error: "pushToken is required" });
      return;
    }
    await db.update(users).set({ pushToken: String(pushToken) }).where(eq(users.id, req.auth!.userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Save push token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
