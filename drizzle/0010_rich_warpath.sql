CREATE TABLE "survey_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"field_code" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_files_survey_idx" ON "survey_files" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_files_survey_field_idx" ON "survey_files" USING btree ("survey_id","field_code");--> statement-breakpoint
ALTER TABLE "survey_files" ENABLE ROW LEVEL SECURITY;