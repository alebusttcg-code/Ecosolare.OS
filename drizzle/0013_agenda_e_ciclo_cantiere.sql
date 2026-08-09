DROP INDEX IF EXISTS "work_orders_un_attivo_per_progetto_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_un_attivo_per_progetto_idx" ON "work_orders" ("project_id") WHERE "status" IN ('pianificato', 'in_corso');
