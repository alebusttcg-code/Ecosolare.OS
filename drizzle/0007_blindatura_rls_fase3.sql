-- Blindatura delle tabelle nate dopo la migrazione 0004.
--
-- La 0004 elencava le tabelle esistenti in quel momento: era una fotografia,
-- non una regola. Le Fasi 3 e successive ne hanno aggiunte diciassette, tutte
-- rimaste raggiungibili dall'API pubblica di Supabase — quindi leggibili e
-- scrivibili scavalcando il policy layer dell'applicazione (ADR-006).
--
-- Il difetto e' stato trovato collegando il progetto a Supabase per la prima
-- volta. Perche' non si ripeta, `src/db/rls.test.ts` ora fallisce se anche una
-- sola tabella dello schema public risulta senza RLS: aggiungerne una senza
-- proteggerla rompe la build invece di passare inosservata.

ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_practices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reconciliation_checks" ENABLE ROW LEVEL SECURITY;
