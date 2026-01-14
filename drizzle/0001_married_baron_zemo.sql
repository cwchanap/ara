
-- Create pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
-- Saved Configurations table for storing user's saved chaos map configurations
CREATE TABLE IF NOT EXISTS "saved_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"map_type" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_configurations" ADD CONSTRAINT "check_valid_map_type" CHECK ("map_type" IN ('lorenz','henon','logistic','newton','standard','bifurcation-logistic','bifurcation-henon','chaos-esthetique'));

--> statement-breakpoint
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_configurations_user_id_idx" ON "saved_configurations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_configurations_user_created_at_idx" ON "saved_configurations" USING btree ("user_id","created_at");