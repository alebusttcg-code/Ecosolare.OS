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
     * Accesso con email e password (D-003a rivista).
     *
     * `password_hash` è nullo finché un amministratore non assegna la password
     * iniziale: un utente senza impronta non può entrare in nessun modo, il che
     * rende innocua la riga creata ma non ancora consegnata alla persona.
     */
    passwordHash: text('password_hash'),
    passwordUpdatedAt: timestamp('password_updated_at', { withTimezone: true }),
    /**
     * La password iniziale la conosce anche chi l'ha generata: finché non viene
     * cambiata non identifica la persona, quindi il sistema costringe a
     * cambiarla prima di mostrare qualunque dato.
     */
    mustChangePassword: boolean('must_change_password').notNull().default(true),

    /**
     * Blocco progressivo dei tentativi. Sul database e non in memoria perché
     * l'applicazione gira su più istanze: un contatore per processo si
     * azzererebbe cambiando istanza, cioè non conterebbe nulla.
     */
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

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

    /**
     * Chat Telegram per reminder follow-up (D-015). Nulla = nessun invio.
     * Si associa con `/start <codice>` sul bot, non a mano.
     */
    telegramChatId: text('telegram_chat_id'),
    telegramLinkCode: text('telegram_link_code'),
    telegramLinkExpiresAt: timestamp('telegram_link_expires_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    index('users_role_idx').on(table.role),
    uniqueIndex('users_telegram_chat_id_idx')
      .on(table.telegramChatId)
      .where(sql`${table.telegramChatId} is not null`),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Sessioni e identità federate                                               */
/* -------------------------------------------------------------------------- */

/**
 * Identità presso un provider esterno (Google e simili).
 *
 * Oggi non è usata: l'accesso avviene con email e password. Resta in schema
 * perché il ritorno al login federato è previsto, e ricreare la tabella
 * costerebbe una migrazione in più senza alcun beneficio.
 */
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
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

/**
 * Sessioni attive.
 *
 * `session_token` contiene l'IMPRONTA SHA-256 del valore nel cookie, non il
 * valore. Chi ottenesse una copia in sola lettura del database — un backup, un
 * dump, un log di query — non potrebbe impersonare nessuno.
 *
 * Sessioni sul database e non JWT: la disattivazione di un utente deve avere
 * effetto immediato, non alla scadenza di un token che non possiamo revocare.
 */
export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Servono a riconoscere una sessione da revocare guardando l'elenco. */
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
)

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
/*  Outbox transazionale — ADR-005                                             */
/* -------------------------------------------------------------------------- */

export const outboxStatus = pgEnum('outbox_status', [
  'in_attesa',
  'in_corso',
  'completato',
  'fallito',
])

/**
 * Effetti da produrre fuori dal database.
 *
 * Il problema che risolve: chiamare Google Drive dentro la firma di un
 * contratto lega la riuscita della firma alla disponibilita' di Drive. Se Drive
 * e' lento, la firma e' lenta; se Drive e' giu', la firma fallisce. E se la
 * chiamata riesce ma la transazione poi va in errore, la cartella resta creata
 * senza contratto che la giustifichi.
 *
 * Qui la riga si scrive NELLA STESSA TRANSAZIONE del fatto che la genera: o
 * esistono entrambi, o nessuno dei due. L'effetto arriva poco dopo, e se non
 * arriva resta scritto che doveva arrivare — che e' l'unica differenza
 * importante rispetto a una chiamata perduta nel nulla.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Es. `drive.cartella_cliente`, `drive.copia_documento`. */
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),

    /**
     * Chiave di deduplica: rende l'accodamento idempotente. Senza, due firme
     * ravvicinate o un tentativo ripetuto creerebbero due cartelle per lo
     * stesso cliente, e nessuna delle due sarebbe «quella giusta».
     */
    dedupKey: text('dedup_key'),

    status: outboxStatus('status').notNull().default('in_attesa'),
    attempts: integer('attempts').notNull().default(0),
    /** Non prima di questo momento: e' cio' che realizza l'attesa crescente. */
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    index('outbox_da_fare_idx').on(table.status, table.availableAt),
    uniqueIndex('outbox_dedup_idx').on(table.dedupKey),
  ],
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

    /**
     * Cartella del cliente su Google Drive (D-011).
     *
     * Nulla finche' il contatto e' un lead: la cartella nasce alla firma del
     * contratto, quando il lead diventa cliente. Averla qui e non sui progetti
     * e' cio' che tiene insieme i documenti di un cliente con piu' commesse.
     */
    driveFolderId: text('drive_folder_id'),

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

    /**
     * Sequenza follow-up commerciale (D-014): null = attività normale.
     * `pre_sopralluogo` | `post_sopralluogo` + step 1|2.
     */
    followUpPhase: text('follow_up_phase'),
    followUpStep: integer('follow_up_step'),

    /** Reminder Telegram inviato (D-015); message_id per matchare la reply. */
    telegramRemindedAt: timestamp('telegram_reminded_at', { withTimezone: true }),
    telegramReminderMessageId: text('telegram_reminder_message_id'),

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
    // Idempotenza dei passi di sequenza: un solo step per fase sul lead.
    uniqueIndex('activities_follow_up_step_idx')
      .on(table.opportunityId, table.followUpPhase, table.followUpStep)
      .where(sql`${table.followUpPhase} is not null`),
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

/**
 * Fotografie allegate a un sopralluogo (ADR-004).
 *
 * I byte restano nell'object storage; in `surveys.answers` compaiono solo gli
 * id. Un campo foto puo' avere piu' immagini (angolazioni diverse del tetto).
 */
export const surveyFiles = pgTable(
  'survey_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    fieldCode: text('field_code').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),

    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksum: text('checksum'),

    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('survey_files_survey_idx').on(table.surveyId),
    index('survey_files_survey_field_idx').on(table.surveyId, table.fieldCode),
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

/* ========================================================================== */
/*  FASE 3 — Contratto, commessa, documenti, materiali                         */
/* ========================================================================== */

export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'restrict' }),
    /** La versione di preventivo accettata: il contratto non nasce dal nulla. */
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id, { onDelete: 'restrict' }),

    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    /** Come è stata raccolta la firma: elettronica, cartacea, scansione. */
    signatureMethod: text('signature_method').notNull().default('cartacea'),
    amountNet: numeric('amount_net', { precision: 14, scale: 2 }).notNull(),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('contracts_opportunity_idx').on(table.opportunityId)],
)

/**
 * Stati della commessa, configurabili come quelli della pipeline (§5.10).
 *
 * `requiresReadiness` marca gli stati in cui il cantiere sta per partire: da lì
 * in poi la pianificabilità non è più un'informazione, è un prerequisito.
 */
export const projectStages = pgTable('project_stages', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull(),
  requiresReadiness: boolean('requires_readiness').notNull().default(false),
  isClosed: boolean('is_closed').notNull().default(false),
  isSuspended: boolean('is_suspended').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
})

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),

    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'restrict' })
      .unique(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    businessLine: businessLine('business_line').notNull(),
    title: text('title').notNull(),

    stage: text('stage')
      .notNull()
      .references(() => projectStages.code),
    stageSince: timestamp('stage_since', { withTimezone: true }).notNull().defaultNow(),

    /** Responsabile della commessa: senza, nessuno la porta avanti. */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    /* Valori congelati alla firma: il consuntivo si confronta con questi. */
    revenueNet: numeric('revenue_net', { precision: 14, scale: 2 }).notNull(),
    estimatedCost: numeric('estimated_cost', { precision: 14, scale: 2 }),
    estimatedMargin: numeric('estimated_margin', { precision: 14, scale: 2 }),

    /* Pianificabilità, ricalcolata a ogni evento e conservata per gli elenchi. */
    readinessState: text('readiness_state').notNull().default('non_pianificabile'),
    readinessBlockers: jsonb('readiness_blockers'),
    readinessComputedAt: timestamp('readiness_computed_at', { withTimezone: true }),
    /** Da quando la commessa è ferma: alimenta il KPI «giorni di blocco». */
    blockedSince: timestamp('blocked_since', { withTimezone: true }),

    /** Sottocartella della commessa dentro quella del cliente (D-011). */
    driveFolderId: text('drive_folder_id'),

    technicalCheckDoneAt: timestamp('technical_check_done_at', { withTimezone: true }),
    /** Momento in cui è stata registrata la conferma del cliente (audit). */
    clientConfirmedAt: timestamp('client_confirmed_at', { withTimezone: true }),

    /** Data di installazione concordata col cliente (giorno del cantiere). */
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('projects_stage_idx').on(table.stage),
    index('projects_readiness_idx').on(table.readinessState),
    index('projects_owner_idx').on(table.ownerId),
    index('projects_contact_idx').on(table.contactId),
  ],
)

export const projectStatusHistory = pgTable(
  'project_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromStage: text('from_stage'),
    toStage: text('to_stage').notNull(),
    daysInPreviousStage: integer('days_in_previous_stage'),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('project_history_project_idx').on(table.projectId)],
)

/* -------------------------------------------------------------------------- */
/*  Task e checklist                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Modelli di task creati all'apertura di una commessa.
 *
 * In tabella e non nel codice: l'elenco vero uscirà dall'audit, e cambiarlo
 * dev'essere una riga da modificare, non un rilascio.
 */
export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessLine: businessLine('business_line'),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  /** Ruolo a cui assegnarlo, se non è indicata una persona. */
  defaultRole: userRole('default_role'),
  /** Giorni dalla firma entro cui va completato. */
  dueDaysFromStart: integer('due_days_from_start'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('project_tasks_project_idx').on(table.projectId, table.sortOrder)],
)

/* -------------------------------------------------------------------------- */
/*  Documenti                                                                  */
/* -------------------------------------------------------------------------- */

export const documentStatus = pgEnum('document_status', [
  'richiesto',
  'caricato',
  'da_verificare',
  'approvato',
  'respinto',
  'scaduto',
  'non_necessario',
])

/** Modelli di checklist documentale, per linea di business. */
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessLine: businessLine('business_line'),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  mandatory: boolean('mandatory').notNull().default(true),
  /** Chi deve procurarlo: il cliente o l'azienda. */
  providedByClient: boolean('provided_by_client').notNull().default(false),
  defaultRole: userRole('default_role'),
  dueDaysFromStart: integer('due_days_from_start'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

/**
 * Requisito documentale su una commessa.
 *
 * Il requisito esiste anche quando il file non c'è: è proprio questo che
 * permette di rispondere a «quali documenti mancano» (§5.9). Basare la
 * checklist sui file presenti direbbe solo cosa è già arrivato.
 */
export const documentRequirements = pgTable(
  'document_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => documentTemplates.id, {
      onDelete: 'set null',
    }),

    code: text('code').notNull(),
    label: text('label').notNull(),
    mandatory: boolean('mandatory').notNull().default(true),
    providedByClient: boolean('provided_by_client').notNull().default(false),

    status: documentStatus('status').notNull().default('richiesto'),
    /** Da quando è in questo stato: alimenta i giorni di blocco. */
    statusSince: timestamp('status_since', { withTimezone: true }).notNull().defaultNow(),

    responsibleId: uuid('responsible_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    rejectionReason: text('rejection_reason'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),

    lastRemindedAt: timestamp('last_reminded_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('doc_req_project_idx').on(table.projectId, table.sortOrder),
    index('doc_req_status_idx').on(table.status),
    uniqueIndex('doc_req_project_code_idx').on(table.projectId, table.code),
  ],
)

/**
 * File caricati a fronte di un requisito.
 *
 * Metadati strutturati, mai il solo nome del file (§5.9). Il file vive
 * nell'object storage; qui resta la chiave e tutto ciò che serve a capirlo.
 */
export const documentFiles = pgTable(
  'document_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requirementId: uuid('requirement_id')
      .notNull()
      .references(() => documentRequirements.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull().default(1),

    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksum: text('checksum'),

    /**
     * Copia su Drive (D-011). Nullo significa «non ancora copiato»: la copia
     * avviene in coda, quindi c'e' sempre una finestra in cui il file esiste
     * nell'archivio ma non su Drive. L'archivio resta la fonte di verita'.
     */
    driveFileId: text('drive_file_id'),

    /** Chi l'ha caricato: interno, cliente via link firmato, automazione. */
    source: text('source').notNull().default('interno'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('doc_files_req_version_idx').on(table.requirementId, table.versionNo),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Pratiche                                                                   */
/* -------------------------------------------------------------------------- */

export const practiceStatus = pgEnum('practice_status', [
  'da_preparare',
  'in_preparazione',
  'inviata',
  'approvata',
  'respinta',
])

export const projectPractices = pgTable(
  'project_practices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    /** Se true, dev'essere almeno inviata perché il cantiere possa partire. */
    blocking: boolean('blocking').notNull().default(false),
    /** Gestita internamente o da un consulente esterno (domanda B10). */
    handledExternally: boolean('handled_externally').notNull().default(false),

    status: practiceStatus('status').notNull().default('da_preparare'),
    statusSince: timestamp('status_since', { withTimezone: true }).notNull().defaultNow(),
    responsibleId: uuid('responsible_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    referenceNumber: text('reference_number'),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('practices_project_idx').on(table.projectId)],
)

/* -------------------------------------------------------------------------- */
/*  Fornitori e materiali                                                      */
/* -------------------------------------------------------------------------- */

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  vatNumber: text('vat_number'),
  email: text('email'),
  phone: text('phone'),
  /** Giorni medi fra ordine e consegna: serve a capire quando ordinare. */
  leadTimeDays: integer('lead_time_days'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const materialStatus = pgEnum('material_status', [
  'da_ordinare',
  'ordinato',
  'parzialmente_consegnato',
  'consegnato',
  'non_disponibile',
])

/**
 * Distinta materiali della commessa.
 *
 * Nasce dalle righe del preventivo accettato, poi vive di vita propria: quello
 * che si ordina non coincide sempre con quello che si è preventivato, ed è
 * proprio quella differenza che erode il margine.
 */
export const projectMaterials = pgTable(
  'project_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    unit: text('unit').notNull().default('pz'),

    quantityPlanned: numeric('quantity_planned', { precision: 12, scale: 3 }).notNull(),
    quantityOrdered: numeric('quantity_ordered', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    quantityReceived: numeric('quantity_received', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),

    /** Senza questo il cantiere non parte. Lo decide l'ufficio tecnico. */
    critical: boolean('critical').notNull().default(false),

    status: materialStatus('status').notNull().default('da_ordinare'),
    statusSince: timestamp('status_since', { withTimezone: true }).notNull().defaultNow(),

    /* Costo previsto congelato dal preventivo, costo reale dagli ordini. */
    estimatedUnitCost: numeric('estimated_unit_cost', { precision: 14, scale: 4 }),
    actualUnitCost: numeric('actual_unit_cost', { precision: 14, scale: 4 }),

    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    responsibleId: uuid('responsible_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('project_materials_project_idx').on(table.projectId),
    index('project_materials_status_idx').on(table.status),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Piano pagamenti                                                            */
/* -------------------------------------------------------------------------- */

export const paymentMilestoneStatus = pgEnum('payment_milestone_status', [
  'previsto',
  'fatturato',
  'incassato',
  'insoluto',
])

export const paymentMilestones = pgTable(
  'payment_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Percentuale dell'imponibile, se la scadenza è definita in quota. */
    percentage: numeric('percentage', { precision: 5, scale: 2 }),
    amountNet: numeric('amount_net', { precision: 14, scale: 2 }).notNull(),

    /** Se true, il suo mancato incasso può bloccare la partenza del cantiere. */
    blocksStart: boolean('blocks_start').notNull().default(false),

    status: paymentMilestoneStatus('status').notNull().default('previsto'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    invoicedAt: timestamp('invoiced_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /**
     * OK amministrativo: il via libera al cantiere.
     *
     * Si concede alla ricezione della contabile del cliente. NON coincide con
     * l'incasso verificato: la contabile dice cosa il cliente afferma di aver
     * fatto, l'estratto conto dice cosa e' successo. La riconciliazione serve
     * proprio a confrontare i due.
     */
    adminOkAt: timestamp('admin_ok_at', { withTimezone: true }),
    adminOkBy: uuid('admin_ok_by').references(() => users.id, { onDelete: 'set null' }),
    adminOkNote: text('admin_ok_note'),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payment_milestones_project_idx').on(table.projectId, table.sortOrder)],
)

/* ========================================================================== */
/*  Controllo amministrativo e riconciliazione bancaria                        */
/* ========================================================================== */

/**
 * Contabile di pagamento ricevuta dal cliente.
 *
 * È il documento che fa scattare l'OK amministrativo. Resta agli atti perché
 * quando l'estratto conto non conferma l'incasso, la prima domanda è «cosa ci
 * aveva mandato il cliente».
 */
export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milestoneId: uuid('milestone_id')
      .notNull()
      .references(() => paymentMilestones.id, { onDelete: 'cascade' }),

    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksum: text('checksum'),
    /** Copia su Drive della cartella commessa (ADR-005 / D-011). */
    driveFileId: text('drive_file_id'),

    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payment_receipts_milestone_idx').on(table.milestoneId)],
)

/** Estratto conto caricato per il controllo periodico. */
export const bankStatements = pgTable(
  'bank_statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),

    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),

    periodFrom: timestamp('period_from', { withTimezone: true }),
    periodTo: timestamp('period_to', { withTimezone: true }),

    /** Quante righe sono state lette e quante scartate: si dichiara sempre. */
    importedRows: integer('imported_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    /** Colonne riconosciute ed elenco delle righe scartate, con il motivo. */
    parseReport: jsonb('parse_report'),

    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('bank_statements_uploaded_idx').on(table.uploadedAt)],
)

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    statementId: uuid('statement_id')
      .notNull()
      .references(() => bankStatements.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    valueDate: timestamp('value_date', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    /** Positivo in entrata, negativo in uscita. */
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index('bank_tx_statement_idx').on(table.statementId),
    index('bank_tx_date_idx').on(table.valueDate),
  ],
)

export const reconciliationOutcome = pgEnum('reconciliation_outcome', [
  'abbinato',
  'importo_diverso',
  'solo_importo',
  'non_trovato',
])

/**
 * Esito del confronto fra un OK amministrativo e l'estratto conto.
 *
 * Si conserva invece di ricalcolarlo ogni volta perché serve a ricordare cosa
 * è già stato verificato a mano: senza, ogni caricamento riproporrebbe gli
 * stessi allarmi già chiariti.
 */
export const reconciliationChecks = pgTable(
  'reconciliation_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    statementId: uuid('statement_id')
      .notNull()
      .references(() => bankStatements.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id')
      .notNull()
      .references(() => paymentMilestones.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id').references(() => bankTransactions.id, {
      onDelete: 'set null',
    }),

    outcome: reconciliationOutcome('outcome').notNull(),
    nameMatch: text('name_match').notNull(),
    /** Centesimi: positivo se in banca è arrivato di più dell'atteso. */
    difference: numeric('difference', { precision: 14, scale: 2 }),

    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reconciliation_statement_idx').on(table.statementId),
    index('reconciliation_outcome_idx').on(table.outcome),
    uniqueIndex('reconciliation_unico_idx').on(table.statementId, table.milestoneId),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Pianificazione cantieri (Fase 4)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Personale senza login (operai e simili), in Amministrazione → Impostazioni.
 *
 * Non sono utenti del gestionale (quelli stanno in `users`): li si assegna al
 * cantiere in pianificazione. Disattivare invece di cancellare conserva lo
 * storico sulle assegnazioni già fatte.
 */
export const workers = pgTable(
  'workers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('workers_active_idx').on(table.isActive)],
)

/**
 * Work order: giorno operativo + squadra su una commessa.
 *
 * Al più un work order attivo (`pianificato` | `in_corso`) per progetto
 * (vincolo parziale in migrazione). `completato` / `annullato` restano in storico.
 */
export const workOrders = pgTable(
  'work_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Giorno del cantiere (mezzogiorno UTC della data locale scelta). */
    scheduledOn: timestamp('scheduled_on', { withTimezone: true }).notNull(),
    notes: text('notes'),
    status: text('status').notNull().default('pianificato'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('work_orders_project_idx').on(table.projectId),
    index('work_orders_scheduled_idx').on(table.scheduledOn),
    index('work_orders_status_idx').on(table.status),
  ],
)

export const workOrderAssignments = pgTable(
  'work_order_assignments',
  {
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'restrict' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workOrderId, table.workerId] }),
    index('work_order_assignments_worker_idx').on(table.workerId),
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
export type SurveyFile = typeof surveyFiles.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type QuoteVersion = typeof quoteVersions.$inferSelect
export type QuoteLine = typeof quoteLines.$inferSelect
export type NewQuoteLine = typeof quoteLines.$inferInsert
export type Approval = typeof approvals.$inferSelect

export type Contract = typeof contracts.$inferSelect
export type ProjectStage = typeof projectStages.$inferSelect
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type ProjectTask = typeof projectTasks.$inferSelect
export type DocumentRequirement = typeof documentRequirements.$inferSelect
export type DocumentFile = typeof documentFiles.$inferSelect
export type ProjectPractice = typeof projectPractices.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type ProjectMaterial = typeof projectMaterials.$inferSelect
export type PaymentMilestone = typeof paymentMilestones.$inferSelect
export type PaymentReceipt = typeof paymentReceipts.$inferSelect
export type BankStatement = typeof bankStatements.$inferSelect
export type BankTransaction = typeof bankTransactions.$inferSelect
export type ReconciliationCheck = typeof reconciliationChecks.$inferSelect
export type OutboxEvent = typeof outboxEvents.$inferSelect
export type NewOutboxEvent = typeof outboxEvents.$inferInsert
export type Worker = typeof workers.$inferSelect
export type NewWorker = typeof workers.$inferInsert
export type WorkOrder = typeof workOrders.$inferSelect
export type WorkOrderAssignment = typeof workOrderAssignments.$inferSelect
