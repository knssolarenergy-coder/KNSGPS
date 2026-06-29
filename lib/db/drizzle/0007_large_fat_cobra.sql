CREATE TABLE IF NOT EXISTS "technician_locations" (
	"technician_id" text PRIMARY KEY NOT NULL,
	"attendance_id" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"address" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "technician_locations" ADD CONSTRAINT "technician_locations_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
