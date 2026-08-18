CREATE TYPE "public"."invoice_status" AS ENUM('bozza', 'emessa', 'esportata', 'incassata', 'stornata');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('fattura', 'acconto', 'nota_credito');--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"descrizione" text NOT NULL,
	"imponibile" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"aliquota_iva" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"imposta" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"natura" text
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequences" (
	"sezionale" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_number_sequences_sezionale_year_pk" PRIMARY KEY("sezionale","year")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "invoice_type" DEFAULT 'fattura' NOT NULL,
	"status" "invoice_status" DEFAULT 'bozza' NOT NULL,
	"sezionale" text,
	"year" integer,
	"number" integer,
	"display_number" text,
	"project_id" uuid,
	"contract_id" uuid,
	"milestone_id" uuid,
	"contact_id" uuid,
	"corregge_invoice_id" uuid,
	"cliente_snapshot" jsonb,
	"imponibile" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"imposta" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"totale" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"vat_breakdown" jsonb,
	"esigibilita" text,
	"causale" text,
	"data_documento" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"issued_by" uuid,
	"esportata_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_milestone_id_payment_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."payment_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE INDEX "invoices_project_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoices_contact_idx" ON "invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_numero_idx" ON "invoices" USING btree ("sezionale","year","number");--> statement-breakpoint
-- RLS: come per le altre tabelle, lo schema public è pubblicato sull'API anonima
-- di Supabase. Attiva senza policy = accessibile solo alla connessione server.
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_number_sequences" ENABLE ROW LEVEL SECURITY;