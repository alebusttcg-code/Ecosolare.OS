ALTER TABLE "document_files" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "survey_files" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "survey_files" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "survey_files" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;