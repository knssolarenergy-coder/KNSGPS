import { Router } from "express";
import { db } from "@workspace/db";
import { attendance, bookings, complaints, sites, siteTechnicians, users } from "@workspace/db/schema";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { verifyToken } from "../lib/jwt.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const router = Router();

const WORK_START_HOUR = 9;
const STANDARD_HOURS = 8;

function calcHours(checkIn: Date, checkOut: Date | null) {
  const isLate = checkIn.getHours() > WORK_START_HOUR ||
    (checkIn.getHours() === WORK_START_HOUR && checkIn.getMinutes() > 0);
  let totalHours: number | null = null;
  let overtimeHours: number | null = null;
  if (checkOut) {
    totalHours = Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;
    overtimeHours = Math.round(Math.max(0, totalHours - STANDARD_HOURS) * 100) / 100;
  }
  return { isLate, totalHours, overtimeHours };
}

function fmt(date: Date) {
  return date.toISOString().split("T")[0];
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function workingDaysInRange(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const day = cur.getDay();
    if (day !== 0) count++; // exclude Sunday
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function buildReport(techId: string, from: Date, to: Date) {
  const tech = await db.select({ name: users.name, email: users.email })
    .from(users).where(eq(users.id, techId)).limit(1);
  if (!tech[0]) return null;

  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const rows = await db.select().from(attendance)
    .where(and(
      eq(attendance.technicianId, techId),
      gte(attendance.checkInAt, from),
      lte(attendance.checkInAt, toEnd)
    ))
    .orderBy(attendance.checkInAt);

  const dailyStats = rows.map(r => {
    const { isLate, totalHours, overtimeHours } = calcHours(r.checkInAt, r.checkOutAt ?? null);
    return {
      date: fmt(r.checkInAt),
      checkInAt: r.checkInAt.toISOString(),
      checkOutAt: r.checkOutAt?.toISOString() ?? null,
      totalHours,
      overtimeHours,
      isLate,
    };
  });

  const presentDays = rows.length;
  const lateDays = dailyStats.filter(d => d.isLate).length;
  const totalHours = dailyStats.reduce((s, d) => s + (d.totalHours ?? 0), 0);
  const overtimeHours = dailyStats.reduce((s, d) => s + (d.overtimeHours ?? 0), 0);
  const totalDays = workingDaysInRange(from, toEnd);

  const bookingsCompleted = await db.select({ c: count() }).from(bookings)
    .where(and(
      eq(bookings.technicianId, techId),
      eq(bookings.status, "completed"),
      gte(bookings.createdAt, from),
      lte(bookings.createdAt, toEnd)
    ));

  const complaintsHandled = await db.select({ c: count() }).from(complaints)
    .where(and(
      eq(complaints.technicianId, techId),
      gte(complaints.createdAt, from),
      lte(complaints.createdAt, toEnd)
    ));

  const assignedSites = await db.select({ siteId: siteTechnicians.siteId })
    .from(siteTechnicians)
    .innerJoin(sites, eq(sites.id, siteTechnicians.siteId))
    .where(and(
      eq(siteTechnicians.technicianId, techId),
      eq(sites.status, "completed"),
      gte(sites.createdAt, from),
      lte(sites.createdAt, toEnd)
    ));

  return {
    technicianId: techId,
    technicianName: tech[0].name,
    from: fmt(from),
    to: fmt(to),
    totalDays,
    presentDays,
    lateDays,
    absentDays: Math.max(0, totalDays - presentDays),
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    bookingsCompleted: bookingsCompleted[0]?.c ?? 0,
    sitesCompleted: assignedSites.length,
    complaintsHandled: complaintsHandled[0]?.c ?? 0,
    dailyStats,
  };
}

// GET /reports/technician
router.get("/reports/technician", requireAdmin, async (req, res) => {
  const { technicianId: id, from, to } = req.query as { technicianId?: string; from?: string; to?: string };
  if (!id) {
    res.status(400).json({ error: "technicianId is required" });
    return;
  }

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();
  fromDate.setHours(0, 0, 0, 0);

  const report = await buildReport(id, fromDate, toDate);
  if (!report) {
    res.status(404).json({ error: "Technician not found" });
    return;
  }
  res.json(report);
});

// GET /reports/technician/download — Excel
router.get("/reports/technician/download", requireAdmin, async (req, res) => {
  const { technicianId: id, from, to } = req.query as { technicianId?: string; from?: string; to?: string };
  if (!id) {
    res.status(400).json({ error: "technicianId is required" });
    return;
  }

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();
  fromDate.setHours(0, 0, 0, 0);

  const report = await buildReport(id, fromDate, toDate);
  if (!report) {
    res.status(404).json({ error: "Technician not found" });
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "K&S Solar Energy";
  wb.created = new Date();

  // ── Sheet 1: Summary ──────────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 30 }, { width: 25 }];

  const titleRow = summary.addRow(["K&S Solar Energy — Technician Report"]);
  titleRow.font = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
  summary.mergeCells("A1:B1");
  summary.addRow([]);

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } },
  };

  const addRow = (label: string, value: string | number) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  };

  addRow("Technician", report.technicianName);
  addRow("Period", `${report.from} to ${report.to}`);
  summary.addRow([]);

  const statsHeader = summary.addRow(["Metric", "Value"]);
  statsHeader.eachCell(cell => Object.assign(cell, headerStyle));

  addRow("Total Working Days", report.totalDays);
  addRow("Days Present", report.presentDays);
  addRow("Days Absent", report.absentDays);
  addRow("Days Late", report.lateDays);
  addRow("Total Hours Worked", `${report.totalHours} hrs`);
  addRow("Overtime Hours", `${report.overtimeHours} hrs`);
  summary.addRow([]);
  addRow("Bookings Completed", report.bookingsCompleted);
  addRow("Sites Completed", report.sitesCompleted);
  addRow("Complaints Handled", report.complaintsHandled);

  // ── Sheet 2: Daily Attendance ─────────────────────────────────
  const daily = wb.addWorksheet("Daily Attendance");
  daily.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Check In", key: "checkIn", width: 14 },
    { header: "Check Out", key: "checkOut", width: 14 },
    { header: "Total Hours", key: "totalHours", width: 14 },
    { header: "Overtime (hrs)", key: "overtime", width: 16 },
    { header: "Status", key: "status", width: 14 },
  ];

  const hRow = daily.getRow(1);
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  });

  for (const d of report.dailyStats) {
    const checkIn = new Date(d.checkInAt);
    const checkOut = d.checkOutAt ? new Date(d.checkOutAt) : null;
    const row = daily.addRow({
      date: fmt(checkIn),
      checkIn: fmtTime(checkIn),
      checkOut: checkOut ? fmtTime(checkOut) : "—",
      totalHours: d.totalHours != null ? `${d.totalHours} hrs` : "—",
      overtime: d.overtimeHours != null ? `${d.overtimeHours} hrs` : "—",
      status: d.isLate ? "Late" : "On Time",
    });
    if (d.isLate) {
      row.getCell("status").font = { color: { argb: "FFEF4444" } };
    } else {
      row.getCell("status").font = { color: { argb: "FF10B981" } };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="report-${report.technicianName.replace(/\s+/g, "-")}-${report.from}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// GET /reports/technician/download-pdf — PDF
// Accepts Bearer header OR ?token= query param (for Linking.openURL on mobile)
router.get("/reports/technician/download-pdf", async (req, res) => {
  const { technicianId: id, from, to, token: queryToken } = req.query as {
    technicianId?: string; from?: string; to?: string; token?: string;
  };

  // Auth: header first, fall back to ?token= for mobile direct-open
  if (!req.auth) {
    const rawToken = queryToken ?? req.headers.authorization?.replace(/^Bearer /, "");
    if (!rawToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      req.auth = verifyToken(rawToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }
  if (!req.auth.isAdmin) {
    res.status(403).json({ error: "Forbidden — admin only" });
    return;
  }
  if (!id) {
    res.status(400).json({ error: "technicianId is required" });
    return;
  }

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();
  fromDate.setHours(0, 0, 0, 0);

  const report = await buildReport(id, fromDate, toDate);
  if (!report) {
    res.status(404).json({ error: "Technician not found" });
    return;
  }

  const filename = `report-${report.technicianName.replace(/\s+/g, "-")}-${report.from}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);

  const BLUE = "#1E3A5F";
  const GRAY = "#555555";
  const BLACK = "#111111";
  const GREEN = "#10B981";
  const RED = "#EF4444";

  // Header band
  doc.rect(0, 0, doc.page.width, 80).fill(BLUE);
  doc.fontSize(22).fillColor("#FFFFFF").text("K&S Solar Energy", 50, 20, { align: "center" });
  doc.fontSize(11).fillColor("#FFFFFFBB").text("Technician Attendance Report", 50, 50, { align: "center" });

  doc.moveDown(3);

  // Meta info box
  doc.roundedRect(50, 95, doc.page.width - 100, 56, 8).fillAndStroke("#F0F4F8", "#CBD5E1");
  doc.fontSize(11).fillColor(BLUE).text("Technician:", 66, 107, { continued: true }).fillColor(BLACK).text(`  ${report.technicianName}`);
  doc.fontSize(11).fillColor(BLUE).text("Period:", 66, 125, { continued: true }).fillColor(GRAY).text(`  ${report.from}  →  ${report.to}`);

  doc.y = 170;
  doc.moveDown(0.5);

  // Summary section heading
  doc.fontSize(13).fillColor(BLUE).text("Summary", 50);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#CBD5E1").stroke();
  doc.moveDown(0.4);

  const summaryRows: [string, string, boolean?][] = [
    ["Total Working Days", String(report.totalDays)],
    ["Days Present", String(report.presentDays)],
    ["Days Absent", String(report.absentDays), report.absentDays > 0],
    ["Days Late", String(report.lateDays), report.lateDays > 0],
    ["Total Hours Worked", `${report.totalHours} hrs`],
    ["Overtime Hours", `${report.overtimeHours} hrs`],
    ["Bookings Completed", String(report.bookingsCompleted)],
    ["Sites Completed", String(report.sitesCompleted)],
    ["Complaints Handled", String(report.complaintsHandled)],
  ];

  let rowY = doc.y;
  for (let i = 0; i < summaryRows.length; i++) {
    const [label, value, warn] = summaryRows[i]!;
    if (i % 2 === 0) {
      doc.rect(50, rowY - 2, doc.page.width - 100, 20).fill("#F8FAFC");
    }
    doc.fontSize(10).fillColor(GRAY).text(label, 60, rowY);
    doc.fontSize(10).fillColor(warn ? RED : BLACK).text(value, doc.page.width - 160, rowY, { width: 110, align: "right" });
    rowY += 20;
  }

  doc.y = rowY + 10;
  doc.moveDown(0.5);

  // Daily attendance section
  doc.fontSize(13).fillColor(BLUE).text("Daily Attendance", 50);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#CBD5E1").stroke();
  doc.moveDown(0.4);

  if (report.dailyStats.length === 0) {
    doc.fontSize(10).fillColor(GRAY).text("No attendance records in this period.", 60);
  } else {
    // Table header
    const colX = [60, 145, 240, 320, 390, 460];
    const headers = ["Date", "Check In", "Check Out", "Hours", "OT", "Status"];
    doc.rect(50, doc.y - 3, doc.page.width - 100, 18).fill(BLUE);
    headers.forEach((h, i) => {
      doc.fontSize(9).fillColor("#FFFFFF").text(h, colX[i]!, doc.y - 1, { width: 80 });
    });
    doc.y += 15;

    for (let i = 0; i < report.dailyStats.length; i++) {
      const d = report.dailyStats[i]!;
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.y = 50;
      }
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      doc.rect(50, doc.y - 2, doc.page.width - 100, 18).fill(rowBg);

      const checkIn = new Date(d.checkInAt);
      const checkOut = d.checkOutAt ? new Date(d.checkOutAt) : null;
      const cells = [
        d.date,
        fmtTime(checkIn),
        checkOut ? fmtTime(checkOut) : "—",
        d.totalHours != null ? `${d.totalHours}h` : "—",
        d.overtimeHours != null && d.overtimeHours > 0 ? `${d.overtimeHours}h` : "—",
        d.isLate ? "Late" : "On Time",
      ];

      cells.forEach((cell, ci) => {
        const isStatus = ci === 5;
        const color = isStatus ? (d.isLate ? RED : GREEN) : BLACK;
        doc.fontSize(8.5).fillColor(color).text(cell, colX[ci]!, doc.y, { width: 80 });
      });
      doc.y += 18;
    }
  }

  // Footer
  doc.y = doc.page.height - 50;
  doc.fontSize(8).fillColor("#AAAAAA").text(
    `Generated by K&S Solar Energy  ·  ${new Date().toLocaleDateString("en-PK")}`,
    50, doc.y, { align: "center", width: doc.page.width - 100 }
  );

  doc.end();
});

export default router;
