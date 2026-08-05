CREATE TYPE "public"."reconciliation_outcome" AS ENUM('abbinato', 'importo_diverso', 'solo_importo', 'non_trovato');--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"period_from" timestamp with time zone,
	"period_to" timestamp with time zone,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"parse_report" jsonb,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"value_date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"transaction_id" uuid,
	"outcome" "reconciliation_outcome" NOT NULL,
	"name_match" text NOT NULL,
	"difference" numeric(14, 2),
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD COLUMN "admin_ok_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD COLUMN "admin_ok_by" uuid;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD COLUMN "admin_ok_note" text;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_milestone_id_payment_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."payment_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_checks" ADD CONSTRAINT "reconciliation_checks_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_checks" ADD CONSTRAINT "reconciliation_checks_milestone_id_payment_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."payment_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_checks" ADD CONSTRAINT "reconciliation_checks_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_checks" ADD CONSTRAINT "reconciliation_checks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_statements_uploaded_idx" ON "bank_statements" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "bank_tx_statement_idx" ON "bank_transactions" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "bank_tx_date_idx" ON "bank_transactions" USING btree ("value_date");--> statement-breakpoint
CREATE INDEX "payment_receipts_milestone_idx" ON "payment_receipts" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "reconciliation_statement_idx" ON "reconciliation_checks" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "reconciliation_outcome_idx" ON "reconciliation_checks" USING btree ("outcome");--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_unico_idx" ON "reconciliation_checks" USING btree ("statement_id","milestone_id");--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_admin_ok_by_users_id_fk" FOREIGN KEY ("admin_ok_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;