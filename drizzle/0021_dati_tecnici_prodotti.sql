CREATE TYPE "public"."component_role" AS ENUM('modulo', 'inverter', 'accumulo', 'struttura', 'quadro', 'pompa_calore', 'altro');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "component_role" "component_role";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rated_power_w" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ac_power_kw" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "capacity_kwh" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model" text;--> statement-breakpoint
CREATE INDEX "products_role_idx" ON "products" USING btree ("component_role");