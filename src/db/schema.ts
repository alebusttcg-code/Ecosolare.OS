import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { AdapterAccountType } from 'next-auth/adapters'

/* -------------------------------------------------------------------------- */
/*  Ruoli e capacita' — D-007                                                  */
/* -------------------------------------------------------------------------- */

/**
 * I quattro ruoli funzionali. Un utente ha un solo ruolo (§11.4 regola 4):
 * i ruoli multipli sembrano flessibili e producono permessi imprevedibili.
 */
export const userRole = pgEnum('user_role', [
  'amministratore',
  'contabilita',
  'commerciale',
  'cantiere',
])

/* -------------------------------------------------------------------------- */
/*  Utenti                                                                     */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name'),
    image: text('image'),
    emailVerified: timestamp('email_verified', { withTimezone: true }),

    role: userRole('role').notNull().default('commerciale'),

    /**
     * Capacita' (D-007). Sono flag sul singolo utente, non ruoli:
     * e' cio' che evita di moltiplicare i ruoli a ogni eccezione.
     */
    canViewCosts: boolean('can_view_costs').notNull().default(false),
    isFieldOnly: boolean('is_field_only').notNull().default(false),

    /**
     * Disattivazione invece di cancellazione: un utente cancellato
     * lascerebbe orfani i riferimenti in audit_logs, che devono restare
     * ricostruibili (§14 del blueprint).
     */
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (table) => [index('users_role_idx').on(table.role)],
)

/* -------------------------------------------------------------------------- */
/*  Tabelle richieste da Auth.js (adapter Drizzle)                             */
/* -------------------------------------------------------------------------- */

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

/* -------------------------------------------------------------------------- */
/*  Audit log — §3.3 e §14 del blueprint                                       */
/* -------------------------------------------------------------------------- */

/**
 * Chi ha agito. Distinguere l'automazione e l'AI dall'utente non e' un
 * dettaglio: quando un dato risulta sbagliato, la prima domanda e' sempre
 * "chi l'ha scritto", e "il sistema" non e' una risposta utile.
 */
export const auditActorType = pgEnum('audit_actor_type', [
  'user',
  'automation',
  'ai',
  'system',
])

export const auditAction = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'approve',
  'login',
  'logout',
  'access_denied',
])

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    actorType: auditActorType('actor_type').notNull(),
    /** Null per attori non-utente (automazione, sistema). */
    actorId: uuid('actor_id'),
    actorLabel: text('actor_label'),

    action: auditAction('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),

    /** Null su create/delete: il diff ha senso solo sugli update. */
    field: text('field'),
    oldValue: text('old_value'),
    newValue: text('new_value'),

    /** Lega fra loro le righe prodotte dalla stessa operazione o dallo stesso evento. */
    correlationId: uuid('correlation_id'),

    /** Contesto aggiuntivo: motivo di un accesso negato, nome dell'automazione, esito. */
    context: jsonb('context'),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_actor_idx').on(table.actorId),
    index('audit_logs_occurred_at_idx').on(table.occurredAt),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Configurazioni applicative                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Soglie di marginalita', aliquote, SLA, template: tutto cio' che il brief
 * chiede di non scrivere nel codice (A18, §20). Il valore e' JSONB perche'
 * la forma cambia per chiave; la validazione avviene con uno schema Zod
 * registrato per chiave, non affidandosi al tipo del database.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  /** Se true, la chiave e' modificabile solo da amministratore. */
  adminOnly: boolean('admin_only').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
})

/* ========================================================================== */
/*  FASE 1 — Anagrafiche, intake, pipeline, attivita'                          */
/* ========================================================================== */

/** Le tre linee di business (§1 del brief). Stabili: enum. */
export const businessLine = pgEnum('business_line', [
  'fotovoltaico',
  'elettrico',
  'idraulico',
])

export const preferredChannel = pgEnum('preferred_channel', [
  'telefono',
  'email',
  'whatsapp',
])

/* -------------------------------------------------------------------------- */
/*  Aziende e persone                                                          */
/* -------------------------------------------------------------------------- */

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalName: text('legal_name').notNull(),
    vatNumber: text('vat_number'),
    taxCode: text('tax_code'),
    email: text('email'),
    pec: text('pec'),
    sdiCode: text('sdi_code'),
    phone: text('phone'),
    /** Telefono normalizzato E.164: e' la chiave usata per la deduplica. */
    phoneE164: text('phone_e164'),
    addressLine: text('address_line'),
    city: text('city'),
    province: text('province'),
    postalCode: text('postal_code'),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('companies_legal_name_idx').on(table.legalName),
    index('companies_vat_idx').on(table.vatNumber),
  ],
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name'),
    lastName: text('last_name').notNull(),
    email: text('email'),
    /** Normalizzata in minuscolo alla scrittura: chiave di deduplica. */
    emailNormalized: text('email_normalized'),
    phone: text('phone'),
    phoneE164: text('phone_e164'),
    taxCode: text('tax_code'),

    /** L'azienda per cui il contatto e' referente, se il cliente e' B2B. */
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    roleInCompany: text('role_in_company'),

    preferredChannel: preferredChannel('preferred_channel'),

    /**
     * Consenso marketing per canale. Le automazioni di comunicazione lo leggono
     * PRIMA di ogni invio (§14 del blueprint): senza consenso tracciato, il
     * canale non e' utilizzabile, indipendentemente da cosa dice l'utente.
     */
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),
    /** Testo o versione dell'informativa accettata: serve a dimostrare cosa e' stato accettato. */
    marketingConsentSource: text('marketing_consent_source'),

    sourceId: uuid('source_id').references(() => leadSources.id, { onDelete: 'set null' }),
    notes: text('notes'),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('contacts_last_name_idx').on(table.lastName),
    index('contacts_phone_idx').on(table.phoneE164),
    index('contacts_email_idx').on(table.emailNormalized),
    index('contacts_company_idx').on(table.companyId),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Siti / immobili                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Un cliente puo' possedere piu' immobili (§5.1 del brief). Il sito e' il luogo
 * dell'intervento: e' su di esso che si fanno sopralluogo, impianto e commessa,
 * non sull'anagrafica.
 */
export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),

    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),

    addressLine: text('address_line').notNull(),
    city: text('city').notNull(),
    province: text('province'),
    postalCode: text('postal_code'),

    buildingType: text('building_type'),
    /** Punto di prelievo dell'utenza elettrica: identifica univocamente la fornitura. */
    pod: text('pod'),
    /** Dati catastali: forma variabile, non interrogata in modo strutturato. */
    cadastral: jsonb('cadastral'),
    notes: text('notes'),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('sites_contact_idx').on(table.contactId),
    index('sites_company_idx').on(table.companyId),
    index('sites_city_idx').on(table.city),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Intake                                                                     */
/* -------------------------------------------------------------------------- */

export const leadSources = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const inboundChannel = pgEnum('inbound_channel', [
  'sito',
  'landing',
  'campagna',
  'telefono',
  'email',
  'whatsapp',
  'passaparola',
  'cliente_esistente',
  'import',
  'manuale',
])

export const dedupStatus = pgEnum('dedup_status', [
  'nessun_duplicato',
  'possibile_duplicato',
  'confermato_duplicato',
  'unito',
])

/**
 * Il payload grezzo ricevuto dal canale, immutabile (ADR-003).
 *
 * Esiste perche' quando un lead arriva malformato serve poter vedere COSA E'
 * ARRIVATO DAVVERO, non cosa il sistema ne ha dedotto. E' anche la base della
 * deduplica e della misura di speed-to-lead.
 */
export const inboundSubmissions = pgTable(
  'inbound_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: inboundChannel('channel').notNull(),
    payload: jsonb('payload').notNull(),

    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),

    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    opportunityId: uuid('opportunity_id').references(() => opportunities.id, {
      onDelete: 'set null',
    }),

    dedupStatus: dedupStatus('dedup_status').notNull().default('nessun_duplicato'),
    /** Candidati alla fusione, con punteggio e motivo. Mai fusi in automatico. */
    dedupCandidates: jsonb('dedup_candidates'),

    /** Chiave naturale del canale: impedisce di creare due volte lo stesso lead. */
    externalId: text('external_id'),

    error: text('error'),
  },
  (table) => [
    index('inbound_received_at_idx').on(table.receivedAt),
    uniqueIndex('inbound_external_id_idx')
      .on(table.channel, table.externalId)
      .where(sql`${table.externalId} is not null`),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Gli stati della pipeline stanno nel database, non in un enum (§5.4 del brief:
 * "stati configurabili"). Aggiungerne uno dopo l'audit deve essere una riga in
 * tabella, non una migrazione e un rilascio.
 */
export const pipelineStages = pgTable('pipeline_stages', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull(),
  /** Aperto = richiede una prossima azione. Vedere src/lib/domain/pipeline.ts */
  isOpen: boolean('is_open').notNull().default(true),
  isWon: boolean('is_won').notNull().default(false),
  isLost: boolean('is_lost').notNull().default(false),
  /** Probabilita' suggerita, sovrascrivibile sulla singola opportunita'. */
  defaultProbability: integer('default_probability').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Riferimento leggibile, mostrato all'utente: OPP-2026-0001 */
    code: text('code').notNull().unique(),

    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),

    businessLine: businessLine('business_line').notNull(),
    title: text('title').notNull(),

    stage: text('stage')
      .notNull()
      .references(() => pipelineStages.code),
    stageSince: timestamp('stage_since', { withTimezone: true }).notNull().defaultNow(),

    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sourceId: uuid('source_id').references(() => leadSources.id, { onDelete: 'set null' }),

    estimatedValue: numeric('estimated_value', { precision: 14, scale: 2 }),
    probability: integer('probability').notNull().default(0),

    /**
     * Scadenza della prossima azione. Un'opportunita' in stato aperto senza
     * questo valore e' un errore di sistema, non un caso ammesso (§9.2 del
     * blueprint): e' la regola che impedisce alla pipeline di svuotarsi da sola.
     */
    nextActionDueAt: timestamp('next_action_due_at', { withTimezone: true }),

    /** Misura dello speed-to-lead: chiuso al primo contatto tracciato. */
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),

    lostReason: text('lost_reason'),
    competitor: text('competitor'),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    /** Risposte di prequalifica (ADR-004). Il template arriva in Fase 2. */
    prequalification: jsonb('prequalification'),
    /** Template con cui la prequalifica e' stata compilata: serve a rileggerla. */
    prequalificationTemplateId: uuid('prequalification_template_id'),
    score: integer('score'),
    scoreMax: integer('score_max'),
    scoreComputedAt: timestamp('score_computed_at', { withTimezone: true }),

    notes: text('notes'),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('opportunities_stage_idx').on(table.stage),
    index('opportunities_owner_idx').on(table.ownerId),
    index('opportunities_contact_idx').on(table.contactId),
    index('opportunities_next_action_idx').on(table.nextActionDueAt),
    index('opportunities_created_at_idx').on(table.createdAt),
  ],
)

export const opportunityStatusHistory = pgTable(
  'opportunity_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    fromStage: text('from_stage'),
    toStage: text('to_stage').notNull(),
    /** Giorni trascorsi nello stato precedente: alimenta i KPI di funnel. */
    daysInPreviousStage: integer('days_in_previous_stage'),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('opp_history_opportunity_idx').on(table.opportunityId)],
)

/* -------------------------------------------------------------------------- */
/*  Attivita'                                                                  */
/* -------------------------------------------------------------------------- */

export const activityKind = pgEnum('activity_kind', [
  'chiamata',
  'email',
  'whatsapp',
  'appuntamento',
  'sopralluogo',
  'task',
  'nota',
])

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: activityKind('kind').notNull(),
    subject: text('subject').notNull(),
    notes: text('notes'),

    opportunityId: uuid('opportunity_id').references(() => opportunities.id, {
      onDelete: 'cascade',
    }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),

    assignedTo: uuid('assigned_to')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    outcome: text('outcome'),

    /**
     * Marca l'attivita' come "la prossima azione" dell'opportunita'.
     * Una sola per opportunita' puo' esserlo, garantito da indice univoco parziale.
     */
    isNextAction: boolean('is_next_action').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('activities_assigned_idx').on(table.assignedTo, table.dueAt),
    index('activities_opportunity_idx').on(table.opportunityId),
    index('activities_contact_idx').on(table.contactId),
    // Una sola prossima azione aperta per opportunita': il vincolo sta nel
    // database, non nella fiducia che il codice applicativo si comporti bene.
    uniqueIndex('activities_one_next_action_idx')
      .on(table.opportunityId)
      .where(sql`${table.isNextAction} and ${table.completedAt} is null`),
  ],
)

/* ========================================================================== */
/*  FASE 2 — Sopralluoghi, catalogo, preventivi, approvazioni                  */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Catalogo                                                                   */
/* -------------------------------------------------------------------------- */

export const productType = pgEnum('product_type', [
  'materiale',
  'servizio',
  'manodopera',
  'kit',
])

/**
 * Catalogo unificato di materiali, servizi e manodopera.
 *
 * Una sola tabella e non tre (§9.2): hanno la stessa struttura e lo stesso uso
 * nelle righe di preventivo. La distinzione utile e' il `type`, non lo schema.
 *
 * I prezzi qui sono i DEFAULT correnti. Ogni preventivo inviato congela i propri
 * (ADR-008): cambiare un prezzo in catalogo non altera i documenti gia' emessi.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    type: productType('type').notNull(),
    /** Unita' di misura: pz, kW, kWh, m, h, a corpo. */
    unit: text('unit').notNull().default('pz'),

    /** numeric(14,4): nel fotovoltaico si ragiona anche in euro/Watt. */
    defaultCostPrice: numeric('default_cost_price', { precision: 14, scale: 4 }),
    defaultSalePrice: numeric('default_sale_price', { precision: 14, scale: 4 }),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('10.00'),

    /** Se null, il prodotto vale per tutte le linee di business. */
    businessLine: businessLine('business_line'),

    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('products_type_idx').on(table.type),
    index('products_name_idx').on(table.name),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Sopralluoghi                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Definizione versionata di una checklist di sopralluogo (ADR-004).
 *
 * `definition` contiene i campi, le condizioni di visibilita' e l'obbligatorieta'.
 * La versione non si modifica: se ne crea una nuova, cosi' i sopralluoghi storici
 * restano leggibili con la checklist con cui sono stati compilati.
 */
/**
 * Prequalifica e sopralluogo condividono struttura e motore (§5.3 e §5.6):
 * cambiano il momento in cui si compilano e cosa bloccano.
 */
export const questionnaireKind = pgEnum('questionnaire_kind', [
  'prequalifica',
  'sopralluogo',
])

export const surveyTemplates = pgTable(
  'survey_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    version: integer('version').notNull().default(1),
    kind: questionnaireKind('kind').notNull().default('sopralluogo'),
    name: text('name').notNull(),
    businessLine: businessLine('business_line').notNull(),
    definition: jsonb('definition').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [uniqueIndex('survey_templates_code_version_idx').on(table.code, table.version)],
)

export const surveyStatus = pgEnum('survey_status', ['bozza', 'completato', 'annullato'])

export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),

    templateId: uuid('template_id')
      .notNull()
      .references(() => surveyTemplates.id, { onDelete: 'restrict' }),

    status: surveyStatus('status').notNull().default('bozza'),
    answers: jsonb('answers').notNull().default({}),

    /**
     * Colonne promosse (ADR-004): i pochi campi usati in filtri, elenchi e KPI
     * esistono anche come colonne vere, popolate alla scrittura.
     */
    estimatedPowerKw: numeric('estimated_power_kw', { precision: 8, scale: 2 }),
    roofType: text('roof_type'),
    hasCriticalIssues: boolean('has_critical_issues').notNull().default(false),

    performedAt: timestamp('performed_at', { withTimezone: true }),
    performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('surveys_opportunity_idx').on(table.opportunityId),
    index('surveys_status_idx').on(table.status),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Preventivi                                                                 */
/* -------------------------------------------------------------------------- */

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Versione attualmente valida. Le altre restano consultabili. */
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('quotes_opportunity_idx').on(table.opportunityId)],
)

/**
 * Stato di una versione di preventivo.
 *
 * `bozza` e' l'unico stato modificabile. Da `inviato` in poi la versione e'
 * immutabile (ADR-008): una modifica genera la versione successiva.
 */
export const quoteVersionStatus = pgEnum('quote_version_status', [
  'bozza',
  'in_approvazione',
  'approvato',
  'inviato',
  'accettato',
  'rifiutato',
  'scaduto',
])

export const quoteVersions = pgTable(
  'quote_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    status: quoteVersionStatus('status').notNull().default('bozza'),

    /** Sconto sul totale, in percentuale. Ripartito sulle righe al calcolo. */
    globalDiscountPct: numeric('global_discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),

    /* Totali calcolati esclusivamente lato server (§8.4). */
    revenueNet: numeric('revenue_net', { precision: 14, scale: 2 }).notNull().default('0.00'),
    costTotal: numeric('cost_total', { precision: 14, scale: 2 }).notNull().default('0.00'),
    marginAmount: numeric('margin_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    /** Null quando l'imponibile e' zero: non e' "margine zero", non ha margine. */
    marginPct: numeric('margin_pct', { precision: 7, scale: 2 }),
    vatAmount: numeric('vat_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    grossTotal: numeric('gross_total', { precision: 14, scale: 2 }).notNull().default('0.00'),
    vatBreakdown: jsonb('vat_breakdown'),

    validUntil: timestamp('valid_until', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    /**
     * Congela listino, aliquote e soglia vigenti al momento dell'invio.
     * Un preventivo inviato deve essere ricostruibile identico anche dopo che il
     * catalogo e' cambiato: e' un problema contrattuale, non tecnico (ADR-008).
     */
    snapshot: jsonb('snapshot'),

    notes: text('notes'),
    termsAndConditions: text('terms_and_conditions'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('quote_versions_quote_no_idx').on(table.quoteId, table.versionNo),
    index('quote_versions_status_idx').on(table.status),
  ],
)

export const quoteLines = pgTable(
  'quote_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),

    /** Null per righe libere non a catalogo. */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    unit: text('unit').notNull().default('pz'),

    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }).notNull().default('0.0000'),
    unitPrice: numeric('unit_price', { precision: 14, scale: 4 }).notNull().default('0.0000'),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0.00'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('10.00'),

    /* Totali di riga, ricalcolati dal server a ogni modifica. */
    lineNet: numeric('line_net', { precision: 14, scale: 2 }).notNull().default('0.00'),
    lineCost: numeric('line_cost', { precision: 14, scale: 2 }).notNull().default('0.00'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('quote_lines_version_idx').on(table.quoteVersionId, table.sortOrder)],
)

/* -------------------------------------------------------------------------- */
/*  Approvazioni                                                               */
/* -------------------------------------------------------------------------- */

export const approvalStatus = pgEnum('approval_status', [
  'richiesta',
  'approvata',
  'respinta',
  'annullata',
])

/**
 * Richieste di approvazione, generiche per entita'.
 *
 * Oggi serve solo ai preventivi sotto soglia di marginalita', ma varianti,
 * sconti straordinari e note di credito seguiranno lo stesso percorso: tenere
 * la tabella generica evita di riscriverlo tre volte.
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    reason: text('reason').notNull(),
    /** Contesto oggettivo al momento della richiesta: margine, soglia, importo. */
    context: jsonb('context'),

    status: approvalStatus('status').notNull().default('richiesta'),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
  },
  (table) => [
    index('approvals_entity_idx').on(table.entityType, table.entityId),
    index('approvals_status_idx').on(table.status),
    // Una sola richiesta pendente per entita': evita code di approvazione
    // duplicate generate da doppi click o da rilanci dell'automazione.
    uniqueIndex('approvals_one_pending_idx')
      .on(table.entityType, table.entityId)
      .where(sql`${table.status} = 'richiesta'`),
  ],
)

/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect

export type Company = typeof companies.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
export type Site = typeof sites.$inferSelect
export type LeadSource = typeof leadSources.$inferSelect
export type InboundSubmission = typeof inboundSubmissions.$inferSelect
export type PipelineStage = typeof pipelineStages.$inferSelect
export type Opportunity = typeof opportunities.$inferSelect
export type NewOpportunity = typeof opportunities.$inferInsert
export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert

export type Product = typeof products.$inferSelect
export type SurveyTemplate = typeof surveyTemplates.$inferSelect
export type Survey = typeof surveys.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type QuoteVersion = typeof quoteVersions.$inferSelect
export type QuoteLine = typeof quoteLines.$inferSelect
export type NewQuoteLine = typeof quoteLines.$inferInsert
export type Approval = typeof approvals.$inferSelect
