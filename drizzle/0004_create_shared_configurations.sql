-- Create shared_configurations table for public shareable configuration URLs
CREATE TABLE IF NOT EXISTS "shared_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" varchar(8) NOT NULL,
	"user_id" uuid NOT NULL,
	"map_type" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "shared_configurations_short_code_unique" UNIQUE("short_code"),
	CONSTRAINT "chk_shared_configurations_expires_after_created" CHECK ("expires_at" > "created_at"),
	CONSTRAINT "chk_shared_configurations_map_type" CHECK ("map_type" IN ('lorenz', 'rossler', 'henon', 'lozi', 'logistic', 'newton', 'standard', 'bifurcation-logistic', 'bifurcation-henon', 'chaos-esthetique', 'lyapunov'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_configurations_user_id_idx" ON "shared_configurations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_configurations_expires_at_idx" ON "shared_configurations" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "shared_configurations" ADD CONSTRAINT "shared_configurations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
