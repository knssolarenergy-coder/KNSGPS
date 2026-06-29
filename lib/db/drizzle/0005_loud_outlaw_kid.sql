CREATE TABLE IF NOT EXISTS "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"technician_id" text NOT NULL,
	"site_id" text,
	"selfie_url" text,
	"site_photo_url" text,
	"latitude" text,
	"longitude" text,
	"location_address" text,
	"check_in_at" timestamp DEFAULT now() NOT NULL,
	"check_out_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_technicians" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"technician_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"points_used" integer NOT NULL,
	"amount_pkr" integer NOT NULL,
	"bank_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"bank_account_title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"property_type" text NOT NULL,
	"monthly_bill" text NOT NULL,
	"roof_area" text,
	"system_type" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"system_size" text,
	"price_estimate" text,
	"admin_note" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referred_id" text NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_technicians" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"technician_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warranties" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invoice_number" text,
	"warranty_type" text NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"purchase_date" text NOT NULL,
	"duration_months" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bookings" ADD COLUMN "technician_id" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "complaints" ADD COLUMN "technician_id" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "city" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'customer' NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "specialty" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "push_token" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "referral_code" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "referral_points" integer DEFAULT 0 NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "referred_by_code" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "bank_name" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "bank_account_number" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "bank_account_title" text; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance" ADD CONSTRAINT "attendance_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance" ADD CONSTRAINT "attendance_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "booking_technicians" ADD CONSTRAINT "booking_technicians_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "booking_technicians" ADD CONSTRAINT "booking_technicians_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_technicians" ADD CONSTRAINT "site_technicians_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_technicians" ADD CONSTRAINT "site_technicians_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "warranties" ADD CONSTRAINT "warranties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "complaints" ADD CONSTRAINT "complaints_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code"); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
