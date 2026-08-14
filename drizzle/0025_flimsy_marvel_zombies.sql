CREATE TABLE "climate_cache" (
	"grid_key" text PRIMARY KEY NOT NULL,
	"lat" numeric(8, 5) NOT NULL,
	"lng" numeric(8, 5) NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- RLS: la cache non passa dal policy layer applicativo, ma Supabase pubblica lo
-- schema public sull'API anonima. Senza RLS la tabella sarebbe leggibile con la
-- chiave pubblica; con RLS attiva e nessuna policy resta accessibile solo alla
-- connessione server (proprietaria), che è l'unica che la usa.
ALTER TABLE "climate_cache" ENABLE ROW LEVEL SECURITY;
