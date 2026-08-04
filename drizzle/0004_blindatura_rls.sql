-- Blindatura dell'API pubblica di Supabase.
--
-- Supabase espone automaticamente ogni tabella dello schema `public` tramite
-- PostgREST. I ruoli `anon` e `authenticated` hanno privilegi di default e la
-- chiave anon e' pubblica per progettazione: senza RLS, chiunque la conosca
-- potrebbe leggere anagrafiche, preventivi e costi AGGIRANDO il policy layer
-- dell'applicazione (ADR-006).
--
-- Qui si abilita RLS su ogni tabella SENZA definire alcuna policy: il risultato
-- e' "nega tutto" per i ruoli dell'API pubblica. L'applicazione non ne risente,
-- perche' si collega con il proprio ruolo proprietario, che non e' soggetto a
-- RLS (non viene usato FORCE ROW LEVEL SECURITY).
--
-- Conseguenza da tenere presente: se un giorno si volesse usare il client
-- Supabase dal browser, servirebbero policy esplicite. E' una decisione da
-- prendere consapevolmente, non da subire per omissione.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inbound_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunity_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
