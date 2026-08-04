CREATE TYPE "public"."questionnaire_kind" AS ENUM('prequalifica', 'sopralluogo');--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "prequalification_template_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "score_max" integer;--> statement-breakpoint
ALTER TABLE "survey_templates" ADD COLUMN "kind" "questionnaire_kind" DEFAULT 'sopralluogo' NOT NULL;