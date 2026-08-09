ALTER TABLE "activities" ADD COLUMN "follow_up_phase" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "follow_up_step" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_follow_up_step_idx" ON "activities" USING btree ("opportunity_id","follow_up_phase","follow_up_step") WHERE "activities"."follow_up_phase" is not null;