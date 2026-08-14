CREATE TABLE "building_insights_cache" (
	"coord_key" text PRIMARY KEY NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- RLS: come per climate_cache, la tabella è raggiungibile dall'API anonima di
-- Supabase se non protetta. Attiva senza policy = solo la connessione server.
ALTER TABLE "building_insights_cache" ENABLE ROW LEVEL SECURITY;
