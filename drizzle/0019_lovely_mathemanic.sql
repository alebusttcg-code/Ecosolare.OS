CREATE TYPE "public"."site_study_status" AS ENUM('bozza', 'completo');--> statement-breakpoint
CREATE TABLE "site_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"site_id" uuid,
	"status" "site_study_status" DEFAULT 'bozza' NOT NULL,
	"title" text DEFAULT 'Studio tetto' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moduli_count" integer,
	"power_kwp" numeric(8, 3),
	"produzione_kwh" numeric(12, 1),
	"consumo_kwh" numeric(12, 1),
	"formatted_address" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_study_id" uuid;--> statement-breakpoint
ALTER TABLE "site_studies" ADD CONSTRAINT "site_studies_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_studies" ADD CONSTRAINT "site_studies_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_studies" ADD CONSTRAINT "site_studies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_studies" ADD CONSTRAINT "site_studies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_studies_opportunity_idx" ON "site_studies" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "site_studies_status_idx" ON "site_studies" USING btree ("status");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_study_id_site_studies_id_fk" FOREIGN KEY ("site_study_id") REFERENCES "public"."site_studies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_site_study_idx" ON "quotes" USING btree ("site_study_id");--> statement-breakpoint
-- Studio tetto: payload con indirizzi e layout moduli; senza RLS sarebbe
-- esposto via PostgREST con la chiave anonima di Supabase.
ALTER TABLE "site_studies" ENABLE ROW LEVEL SECURITY;