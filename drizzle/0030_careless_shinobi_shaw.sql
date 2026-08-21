ALTER TABLE "document_templates" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "survey_templates" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "task_templates" ALTER COLUMN "business_line" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."business_line";--> statement-breakpoint
CREATE TYPE "public"."business_line" AS ENUM('fotovoltaico', 'fv_pdc', 'batterie', 'colonnina');--> statement-breakpoint
ALTER TABLE "document_templates" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";--> statement-breakpoint
ALTER TABLE "survey_templates" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";--> statement-breakpoint
ALTER TABLE "task_templates" ALTER COLUMN "business_line" SET DATA TYPE "public"."business_line" USING "business_line"::"public"."business_line";