CREATE TABLE IF NOT EXISTS "location_pings" (
	"id" text PRIMARY KEY NOT NULL,
	"attendance_id" text NOT NULL,
	"technician_id" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"address" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
