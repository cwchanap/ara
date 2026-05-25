-- Neon Auth user ids are opaque strings, not guaranteed UUIDs.
-- Keep app-generated configuration ids as UUIDs, but store auth-owned user ids as text.
ALTER TABLE "saved_configurations" DROP CONSTRAINT IF EXISTS "saved_configurations_user_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "shared_configurations" DROP CONSTRAINT IF EXISTS "shared_configurations_user_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "id" TYPE text USING "id"::text;
--> statement-breakpoint
ALTER TABLE "saved_configurations" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "shared_configurations" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shared_configurations" ADD CONSTRAINT "shared_configurations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
