ALTER TABLE "activities" ADD COLUMN "telegram_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "telegram_reminder_message_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_link_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_link_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_chat_id_idx" ON "users" USING btree ("telegram_chat_id") WHERE "users"."telegram_chat_id" is not null;