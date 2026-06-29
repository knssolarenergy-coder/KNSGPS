-- Ensure technician columns exist on any DB that missed the 0000 ADD COLUMN guards
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specialty" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "technician_id" text;
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "technician_id" text;
--> statement-breakpoint
-- Add FK constraints (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_technician_id_users_id_fk' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_technician_id_users_id_fk"
      FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_technician_id_users_id_fk' AND conrelid = 'complaints'::regclass
  ) THEN
    ALTER TABLE "complaints"
      ADD CONSTRAINT "complaints_technician_id_users_id_fk"
      FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
