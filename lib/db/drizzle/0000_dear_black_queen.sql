CREATE TABLE IF NOT EXISTS "bookings" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text,
        "customer_name" text NOT NULL,
        "phone" text NOT NULL,
        "address" text NOT NULL,
        "city" text NOT NULL,
        "panel_count" integer NOT NULL,
        "panel_type" text NOT NULL,
        "preferred_date" text NOT NULL,
        "preferred_time" text NOT NULL,
        "notes" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "is_admin_sender" boolean DEFAULT false NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaints" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text,
        "booking_id" text,
        "subject" text NOT NULL,
        "customer_name" text,
        "phone" text,
        "address" text,
        "message" text NOT NULL,
        "status" text DEFAULT 'submitted' NOT NULL,
        "technician_name" text,
        "technician_phone" text,
        "status_history" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text NOT NULL,
        "password_hash" text NOT NULL,
        "is_admin" boolean DEFAULT false NOT NULL,
        "is_master" boolean DEFAULT false NOT NULL,
        "inverter_brand" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "technician_name" text;
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "technician_phone" text;
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "status_history" jsonb;
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'submitted' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_master" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specialty" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "technician_id" text;
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "technician_id" text;
