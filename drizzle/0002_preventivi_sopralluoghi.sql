CREATE TYPE "public"."approval_status" AS ENUM('richiesta', 'approvata', 'respinta', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('materiale', 'servizio', 'manodopera', 'kit');--> statement-breakpoint
CREATE TYPE "public"."quote_version_status" AS ENUM('bozza', 'in_approvazione', 'approvato', 'inviato', 'accettato', 'rifiutato', 'scaduto');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('bozza', 'completato', 'annullato');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"context" jsonb,
	"status" "approval_status" DEFAULT 'richiesta' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "product_type" NOT NULL,
	"unit" text DEFAULT 'pz' NOT NULL,
	"default_cost_price" numeric(14, 4),
	"default_sale_price" numeric(14, 4),
	"vat_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"business_line" "business_line",
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"unit" text DEFAULT 'pz' NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"unit_price" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"line_net" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"line_cost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"status" "quote_version_status" DEFAULT 'bozza' NOT NULL,
	"global_discount_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"revenue_net" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"cost_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"margin_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"margin_pct" numeric(7, 2),
	"vat_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"gross_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"vat_breakdown" jsonb,
	"valid_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"rejection_reason" text,
	"snapshot" jsonb,
	"notes" text,
	"terms_and_conditions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "quotes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "survey_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"business_line" "business_line" NOT NULL,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"site_id" uuid,
	"template_id" uuid NOT NULL,
	"status" "survey_status" DEFAULT 'bozza' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estimated_power_kw" numeric(8, 2),
	"roof_type" text,
	"has_critical_issues" boolean DEFAULT false NOT NULL,
	"performed_at" timestamp with time zone,
	"performed_by" uuid,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_templates" ADD CONSTRAINT "survey_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_template_id_survey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."survey_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_entity_idx" ON "approvals" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_one_pending_idx" ON "approvals" USING btree ("entity_type","entity_id") WHERE "approvals"."status" = 'richiesta';--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("type");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "quote_lines_version_idx" ON "quote_lines" USING btree ("quote_version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_quote_no_idx" ON "quote_versions" USING btree ("quote_id","version_no");--> statement-breakpoint
CREATE INDEX "quote_versions_status_idx" ON "quote_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_opportunity_idx" ON "quotes" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_templates_code_version_idx" ON "survey_templates" USING btree ("code","version");--> statement-breakpoint
CREATE INDEX "surveys_opportunity_idx" ON "surveys" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "surveys_status_idx" ON "surveys" USING btree ("status");