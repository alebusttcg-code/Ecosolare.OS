import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
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

/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect
