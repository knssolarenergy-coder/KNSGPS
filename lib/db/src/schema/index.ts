import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  isMaster: boolean("is_master").notNull().default(false),
  inverterBrand: text("inverter_brand"),
  city: text("city"),
  status: text("status").notNull().default("pending"),
  role: text("role").notNull().default("customer"),
  specialty: text("specialty"),
  pushToken: text("push_token"),
  referralCode: text("referral_code").unique(),
  referralPoints: integer("referral_points").notNull().default(0),
  referredByCode: text("referred_by_code"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountTitle: text("bank_account_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  panelCount: integer("panel_count").notNull(),
  panelType: text("panel_type").notNull(),
  preferredDate: text("preferred_date").notNull(),
  preferredTime: text("preferred_time").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  technicianId: text("technician_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const complaints = pgTable("complaints", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  bookingId: text("booking_id"),
  subject: text("subject").notNull(),
  customerName: text("customer_name"),
  phone: text("phone"),
  address: text("address"),
  message: text("message").notNull(),
  status: text("status").notNull().default("submitted"),
  technicianName: text("technician_name"),
  technicianPhone: text("technician_phone"),
  technicianId: text("technician_id").references(() => users.id, { onDelete: "set null" }),
  statusHistory: jsonb("status_history").$type<Array<{status: string; changedAt: string}>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  propertyType: text("property_type").notNull(),
  monthlyBill: text("monthly_bill").notNull(),
  roofArea: text("roof_area"),
  systemType: text("system_type").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("submitted"),
  systemSize: text("system_size"),
  priceEstimate: text("price_estimate"),
  adminNote: text("admin_note"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const warranties = pgTable("warranties", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  invoiceNumber: text("invoice_number"),
  warrantyType: text("warranty_type").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),
  purchaseDate: text("purchase_date").notNull(),
  durationMonths: integer("duration_months").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  isAdminSender: boolean("is_admin_sender").notNull().default(false),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: text("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentRequests = pgTable("payment_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pointsUsed: integer("points_used").notNull(),
  amountPkr: integer("amount_pkr").notNull(),
  bankName: text("bank_name").notNull(),
  bankAccountNumber: text("bank_account_number").notNull(),
  bankAccountTitle: text("bank_account_title").notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookingTechnicians = pgTable("booking_technicians", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const complaintTechnicians = pgTable("complaint_technicians", {
  id: text("id").primaryKey(),
  complaintId: text("complaint_id").notNull().references(() => complaints.id, { onDelete: "cascade" }),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const sites = pgTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteTechnicians = pgTable("site_technicians", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
  selfieUrl: text("selfie_url"),
  sitePhotoUrl: text("site_photo_url"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  locationAddress: text("location_address"),
  checkInAt: timestamp("check_in_at").notNull().defaultNow(),
  checkOutAt: timestamp("check_out_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locationPings = pgTable("location_pings", {
  id: text("id").primaryKey(),
  attendanceId: text("attendance_id").notNull().references(() => attendance.id, { onDelete: "cascade" }),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  address: text("address"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const siteVisits = pgTable("site_visits", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  purpose: text("purpose").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  technicianNotes: text("technician_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteVisitTechnicians = pgTable("site_visit_technicians", {
  id: text("id").primaryKey(),
  siteVisitId: text("site_visit_id").notNull().references(() => siteVisits.id, { onDelete: "cascade" }),
  technicianId: text("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const technicianLocations = pgTable("technician_locations", {
  technicianId: text("technician_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  attendanceId: text("attendance_id"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  address: text("address"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  status: true,
  technicianId: true,
  createdAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type User = typeof users.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
