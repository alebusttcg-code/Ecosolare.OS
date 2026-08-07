CREATE TYPE "public"."outbox_status" AS ENUM('in_attesa', 'in_corso', 'completato', 'fallito');--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"dedup_key" text,
	"status" "outbox_status" DEFAULT 'in_attesa' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
CREATE INDEX "outbox_da_fare_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_dedup_idx" ON "outbox_events" USING btree ("dedup_key");--> statement-breakpoint
-- Senza questa riga la coda sarebbe leggibile e scrivibile dall'API pubblica di
-- Supabase: i payload contengono identificativi di clienti e commesse, e chi
-- potesse inserirvi righe farebbe eseguire al sistema le proprie chiamate.
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
