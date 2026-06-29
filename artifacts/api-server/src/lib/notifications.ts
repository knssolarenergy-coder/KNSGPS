import { Resend } from "resend";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

const EMAIL_FROM = "K&S Solar Energy <noreply@knssolar.com.pk>";

function getResendClient() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return null;
  return new Resend(key);
}

function emailLayout(subtitle: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1E3A5F;padding:32px 40px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">☀️</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">K&amp;S Solar Energy</h1>
            <p style="color:#ffffffcc;margin:6px 0 0;font-size:13px;">${subtitle}</p>
          </td>
        </tr>
        <tr><td style="padding:32px 40px;">${body}</td></tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#bbb;font-size:11px;margin:0;">© K&amp;S Solar Energy · Pakistan</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      logger.warn("RESEND_API_KEY not set — email skipped");
      return false;
    }
    const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (result.error) {
      logger.warn({ resendError: result.error, to }, "Resend returned error");
      return false;
    }
    logger.info({ emailId: result.data?.id, to }, "Email sent successfully");
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to send email");
    return false;
  }
}

export async function sendPush(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, sound: "default" }),
    });
  } catch (err) {
    logger.warn({ err }, "Failed to send push notification");
  }
}

export async function notifyUser(
  userId: string | null | undefined,
  opts: {
    emailSubject: string;
    emailHtml: string;
    pushTitle: string;
    pushBody: string;
    pushData?: Record<string, unknown>;
  }
): Promise<void> {
  if (!userId) return;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return;
    await Promise.all([
      sendEmail(user.email, opts.emailSubject, opts.emailHtml),
      sendPush(user.pushToken, opts.pushTitle, opts.pushBody, opts.pushData),
    ]);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to notify user");
  }
}

export async function notifyAdmins(opts: {
  pushTitle: string;
  pushBody: string;
  pushData?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admins = await db
      .select({ pushToken: users.pushToken })
      .from(users)
      .where(eq(users.isAdmin, true));
    await Promise.all(
      admins
        .filter((a) => !!a.pushToken)
        .map((a) => sendPush(a.pushToken, opts.pushTitle, opts.pushBody, opts.pushData))
    );
  } catch (err) {
    logger.warn({ err }, "Failed to notify admins");
  }
}

export async function notifyTechnician(
  technicianId: string | null | undefined,
  opts: {
    pushTitle: string;
    pushBody: string;
    pushData?: Record<string, unknown>;
  }
): Promise<void> {
  if (!technicianId) return;
  try {
    const [tech] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, technicianId));
    if (!tech) return;
    await sendPush(tech.pushToken, opts.pushTitle, opts.pushBody, opts.pushData);
  } catch (err) {
    logger.warn({ err, technicianId }, "Failed to notify technician");
  }
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  confirmed: "Confirmed ✓",
  in_progress: "In Progress",
  completed: "Completed ✓",
  cancelled: "Cancelled",
};

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  submitted: "Received",
  in_progress: "In Progress",
  resolved: "Resolved ✓",
  closed: "Closed",
};

export function bookingEmailHtml(
  name: string,
  status: string,
  details?: { date?: string; time?: string; panels?: string; address?: string }
): string {
  const label = BOOKING_STATUS_LABELS[status] ?? status;
  const isNew = status === "pending";
  const accentColor = status === "cancelled" ? "#DC2626" : status === "completed" ? "#16A34A" : "#1E3A5F";
  const detailRows = details
    ? `<table width="100%" style="background:#f8fafc;border-radius:10px;margin:16px 0;border-collapse:collapse;">
        ${details.date ? `<tr><td style="padding:8px 14px;font-size:13px;color:#555;border-bottom:1px solid #eee;">📅 Date: <strong>${details.date}</strong></td></tr>` : ""}
        ${details.time ? `<tr><td style="padding:8px 14px;font-size:13px;color:#555;border-bottom:1px solid #eee;">🕐 Time: <strong>${details.time}</strong></td></tr>` : ""}
        ${details.panels ? `<tr><td style="padding:8px 14px;font-size:13px;color:#555;border-bottom:1px solid #eee;">🔆 Panels: <strong>${details.panels}</strong></td></tr>` : ""}
        ${details.address ? `<tr><td style="padding:8px 14px;font-size:13px;color:#555;">📍 Address: <strong>${details.address}</strong></td></tr>` : ""}
      </table>`
    : "";
  const body = `
    <h2 style="color:#1E3A5F;margin:0 0 12px;font-size:18px;">${isNew ? "Booking Received!" : "Booking Status Updated"}</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px;">
      ${isNew ? "Your solar panels washing booking has been received and is pending review." : "Your booking status has been updated."}
    </p>
    <p style="font-size:14px;margin:0 0 4px;">Status: <span style="background:${accentColor};color:#fff;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:bold;">${label}</span></p>
    ${detailRows}
    <p style="color:#888;font-size:13px;margin:20px 0 0;">For assistance, please contact us via WhatsApp.</p>`;
  return emailLayout(isNew ? "Booking Confirmation" : "Booking Status Update", body);
}

export function complaintEmailHtml(name: string, subject: string, status: string): string {
  const label = COMPLAINT_STATUS_LABELS[status] ?? status;
  const isNew = status === "submitted";
  const accentColor = status === "resolved" ? "#16A34A" : status === "in_progress" ? "#D97706" : "#DC2626";
  const body = `
    <h2 style="color:#DC2626;margin:0 0 12px;font-size:18px;">${isNew ? "Complaint Received" : "Complaint Update"}</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px;">
      ${isNew
        ? `Your complaint regarding <strong>${subject}</strong> has been received. Our team will review it shortly.`
        : `Your complaint regarding <strong>${subject}</strong> has been updated.`}
    </p>
    <p style="font-size:14px;margin:0 0 4px;">Status: <span style="background:${accentColor};color:#fff;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:bold;">${label}</span></p>
    <p style="color:#888;font-size:13px;margin:20px 0 0;">For urgent issues, please contact us via WhatsApp.</p>`;
  return emailLayout(isNew ? "Complaint Confirmation" : "Complaint Status Update", body);
}
