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
