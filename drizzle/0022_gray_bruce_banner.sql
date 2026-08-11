CREATE TYPE "public"."product_document_category" AS ENUM('scheda_tecnica', 'garanzia', 'certificazione', 'manuale');--> statement-breakpoint
CREATE TABLE "product_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category" "product_document_category" DEFAULT 'scheda_tecnica' NOT NULL,
	"title" text NOT NULL,
	"version_label" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"checksum" text,
	"included_pages" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_documents_product_idx" ON "product_documents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_documents_active_order_idx" ON "product_documents" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_documents_version_idx" ON "product_documents" USING btree ("product_id","category","version_label");--> statement-breakpoint
ALTER TABLE "product_documents" ENABLE ROW LEVEL SECURITY;
