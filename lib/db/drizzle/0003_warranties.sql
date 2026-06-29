CREATE TABLE IF NOT EXISTS "warranties" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "warranty_type" text NOT NULL,
  "brand" text NOT NULL,
  "model" text,
  "purchase_date" text NOT NULL,
  "duration_months" integer NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
