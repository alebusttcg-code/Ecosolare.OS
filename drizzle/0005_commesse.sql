CREATE TYPE "public"."document_status" AS ENUM('richiesto', 'caricato', 'da_verificare', 'approvato', 'respinto', 'scaduto', 'non_necessario');--> statement-breakpoint
CREATE TYPE "public"."material_status" AS ENUM('da_ordinare', 'ordinato', 'parzialmente_consegnato', 'consegnato', 'non_disponibile');--> statement-breakpoint
CREATE TYPE "public"."payment_milestone_status" AS ENUM('previsto', 'fatturato', 'incassato', 'insoluto');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('da_preparare', 'in_preparazione', 'inviata', 'approvata', 'respinta');--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signature_method" text DEFAULT 'cartacea' NOT NULL,
	"amount_net" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "contracts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"source" text DEFAULT 'interno' NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" uuid,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"mandatory" boolean DEFAULT true NOT NULL,
	"provided_by_client" boolean DEFAULT false NOT NULL,
	"status" "document_status" DEFAULT 'richiesto' NOT NULL,
	"status_since" timestamp with time zone DEFAULT now() NOT NULL,
	"responsible_id" uuid,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"rejection_reason" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"last_reminded_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_line" "business_line",
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"mandatory" boolean DEFAULT true NOT NULL,
	"provided_by_client" boolean DEFAULT false NOT NULL,
	"default_role" "user_role",
	"due_days_from_start" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "document_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"percentage" numeric(5, 2),
	"amount_net" numeric(14, 2) NOT NULL,
	"blocks_start" boolean DEFAULT false NOT NULL,
	"status" "payment_milestone_status" DEFAULT 'previsto' NOT NULL,
	"due_at" timestamp with time zone,
	"invoiced_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"unit" text DEFAULT 'pz' NOT NULL,
	"quantity_planned" numeric(12, 3) NOT NULL,
	"quantity_ordered" numeric(12, 3) DEFAULT '0' NOT NULL,
	"quantity_received" numeric(12, 3) DEFAULT '0' NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"status" "material_status" DEFAULT 'da_ordinare' NOT NULL,
	"status_since" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_unit_cost" numeric(14, 4),
	"actual_unit_cost" numeric(14, 4),
	"supplier_id" uuid,
	"expected_at" timestamp with time zone,
	"responsible_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"handled_externally" boolean DEFAULT false NOT NULL,
	"status" "practice_status" DEFAULT 'da_preparare' NOT NULL,
	"status_since" timestamp with time zone DEFAULT now() NOT NULL,
	"responsible_id" uuid,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"reference_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"requires_readiness" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"days_in_previous_stage" integer,
	"note" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"assigned_to" uuid,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"site_id" uuid,
	"business_line" "business_line" NOT NULL,
	"title" text NOT NULL,
	"stage" text NOT NULL,
	"stage_since" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"revenue_net" numeric(14, 2) NOT NULL,
	"estimated_cost" numeric(14, 2),
	"estimated_margin" numeric(14, 2),
	"readiness_state" text DEFAULT 'non_pianificabile' NOT NULL,
	"readiness_blockers" jsonb,
	"readiness_computed_at" timestamp with time zone,
	"blocked_since" timestamp with time zone,
	"technical_check_done_at" timestamp with time zone,
	"client_confirmed_at" timestamp with time zone,
	"planned_start_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "projects_code_unique" UNIQUE("code"),
	CONSTRAINT "projects_contract_id_unique" UNIQUE("contract_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vat_number" text,
	"email" text,
	"phone" text,
	"lead_time_days" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_line" "business_line",
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"default_role" "user_role",
	"due_days_from_start" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "task_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_requirement_id_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_stage_project_stages_code_fk" FOREIGN KEY ("stage") REFERENCES "public"."project_stages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contracts_opportunity_idx" ON "contracts" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_files_req_version_idx" ON "document_files" USING btree ("requirement_id","version_no");--> statement-breakpoint
CREATE INDEX "doc_req_project_idx" ON "document_requirements" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "doc_req_status_idx" ON "document_requirements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_req_project_code_idx" ON "document_requirements" USING btree ("project_id","code");--> statement-breakpoint
CREATE INDEX "payment_milestones_project_idx" ON "payment_milestones" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "project_materials_project_idx" ON "project_materials" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_materials_status_idx" ON "project_materials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "practices_project_idx" ON "project_practices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_history_project_idx" ON "project_status_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_project_idx" ON "project_tasks" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "projects_stage_idx" ON "projects" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "projects_readiness_idx" ON "projects" USING btree ("readiness_state");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_contact_idx" ON "projects" USING btree ("contact_id");