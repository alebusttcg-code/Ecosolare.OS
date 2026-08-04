/**
 * Policy layer — punto unico di verita' per le autorizzazioni (ADR-006).
 *
 * Questo modulo e' deliberatamente PURO: nessun accesso al database, nessuna
 * dipendenza da Next.js. Cosi' e' interamente testabile e non ci sono scorciatoie
 * possibili ("qui controllo dopo", "qui il dato ce l'ho gia'").
 *
 * La matrice qui sotto e' la trascrizione fedele della §11.2 del blueprint.
 * Se una cambia, deve cambiare l'altra: il documento e' la specifica, questo
 * file e' l'implementazione, e i test verificano che coincidano.
 */

export type Role = 'amministratore' | 'contabilita' | 'commerciale' | 'cantiere'

export type Action = 'read' | 'create' | 'update' | 'delete' | 'approve'

/**
 * Le risorse corrispondono alle righe della matrice §11.2. Sono piu' granulari
 * delle entita' del modello dati perche' i costi vanno separati dal resto:
 * `quote` e `quote_cost` sono la stessa tabella, ma non lo stesso permesso.
 */
export type Resource =
  // Fase 1–2 — MVP
  | 'contact'
  | 'customer_timeline'
  | 'lead_intake'
  | 'opportunity'
  | 'prequalification'
  | 'activity'
  | 'survey'
  | 'quote'
  | 'quote_cost'
  | 'quote_approval'
  | 'contract'
  | 'document'
  | 'practice'
  | 'project'
  // Fase 3–4
  | 'material'
  | 'material_cost'
  | 'schedule'
  | 'time_entry'
  // Fase 5–6
  | 'project_economics'
  | 'invoice'
  | 'ticket'
  // Trasversali
  | 'dashboard'
  | 'settings'
  | 'user'
  | 'audit_log'
  | 'integration'

/**
 * Livelli della matrice del blueprint:
 *   none  = "—"  ·  read = "L"  ·  write = "S"  ·  full = "T"
 *   cost-gated    = visibile solo se l'utente ha la capacita' `canViewCosts`
 */
type Level = 'none' | 'read' | 'write' | 'full' | 'cost-gated'

const ACTIONS_BY_LEVEL = {
  none: [],
  read: ['read'],
  write: ['read', 'create', 'update'],
  full: ['read', 'create', 'update', 'delete', 'approve'],
} as const satisfies Record<Exclude<Level, 'cost-gated'>, readonly Action[]>

/** Utente minimo necessario a decidere. Non serve altro, e non va passato altro. */
export interface PolicySubject {
  readonly role: Role
  readonly canViewCosts: boolean
  readonly isFieldOnly: boolean
  readonly isActive: boolean
}

/* -------------------------------------------------------------------------- */
/*  Matrice permessi — trascrizione della §11.2 del blueprint                  */
/* -------------------------------------------------------------------------- */

const MATRIX: Record<Role, Record<Resource, Level>> = {
  amministratore: {
    contact: 'full',
    customer_timeline: 'full',
    lead_intake: 'full',
    opportunity: 'full',
    prequalification: 'full',
    activity: 'full',
    survey: 'full',
    quote: 'full',
    quote_cost: 'full',
    quote_approval: 'full',
    contract: 'full',
    document: 'full',
    practice: 'full',
    project: 'full',
    material: 'full',
    material_cost: 'full',
    schedule: 'full',
    time_entry: 'full',
    project_economics: 'full',
    invoice: 'full',
    ticket: 'full',
    dashboard: 'full',
    settings: 'full',
    user: 'full',
    audit_log: 'read', // nemmeno l'amministratore modifica l'audit log
    integration: 'full',
  },

  contabilita: {
    contact: 'write',
    customer_timeline: 'read',
    lead_intake: 'none',
    opportunity: 'read',
    prequalification: 'none',
    activity: 'write',
    survey: 'read',
    quote: 'read',
    quote_cost: 'full',
    quote_approval: 'none',
    contract: 'write',
    document: 'full',
    practice: 'full',
    project: 'write',
    material: 'read',
    material_cost: 'full',
    schedule: 'read',
    time_entry: 'read',
    project_economics: 'full',
    invoice: 'full',
    ticket: 'read',
    dashboard: 'read',
    settings: 'none',
    user: 'none',
    audit_log: 'none',
    integration: 'none',
  },

  commerciale: {
    contact: 'write',
    customer_timeline: 'read',
    lead_intake: 'write',
    opportunity: 'write',
    prequalification: 'write',
    activity: 'write',
    survey: 'write',
    quote: 'write',
    quote_cost: 'cost-gated', // vede margine % e soglia, non i prezzi d'acquisto
    quote_approval: 'none',
    contract: 'read',
    document: 'write',
    practice: 'read',
    project: 'read',
    material: 'none',
    material_cost: 'none',
    schedule: 'read',
    time_entry: 'none',
    project_economics: 'none',
    invoice: 'read', // solo stato di incasso, mai importi di costo
    ticket: 'write',
    dashboard: 'read',
    settings: 'none',
    user: 'none',
    audit_log: 'none',
    integration: 'none',
  },

  cantiere: {
    contact: 'read',
    customer_timeline: 'read',
    lead_intake: 'none',
    opportunity: 'none',
    prequalification: 'read',
    activity: 'write',
    survey: 'write',
    quote: 'read',
    quote_cost: 'cost-gated',
    quote_approval: 'none',
    contract: 'none',
    document: 'read',
    practice: 'write',
    project: 'write',
    material: 'write',
    material_cost: 'cost-gated',
    schedule: 'write',
    time_entry: 'write',
    project_economics: 'cost-gated',
    invoice: 'none',
    ticket: 'write',
    dashboard: 'read',
    settings: 'none',
    user: 'none',
    audit_log: 'none',
    integration: 'none',
  },
}

/* -------------------------------------------------------------------------- */
/*  Capacita' is_field_only — Fase 4                                           */
/* -------------------------------------------------------------------------- */

/**
 * L'installatore in campo. Non e' un ruolo (D-007): e' una restrizione applicata
 * sopra il ruolo `cantiere`, che sostituisce integralmente la riga di matrice.
 *
 * Tutto cio' che non e' elencato qui e' negato. Whitelist, non blacklist:
 * una risorsa nuova nasce inaccessibile e va abilitata consapevolmente.
 */
const FIELD_ONLY_MATRIX: Partial<Record<Resource, Level>> = {
  contact: 'read', // nome, indirizzo e telefono servono per arrivare e citofonare
  project: 'read',
  document: 'read',
  survey: 'write',
  schedule: 'read',
  time_entry: 'write',
  ticket: 'write',
  activity: 'write',
}

/* -------------------------------------------------------------------------- */
/*  Decisione                                                                  */
/* -------------------------------------------------------------------------- */

function levelFor(subject: PolicySubject, resource: Resource): Level {
  if (subject.isFieldOnly) {
    return FIELD_ONLY_MATRIX[resource] ?? 'none'
  }
  return MATRIX[subject.role][resource]
}

/**
 * Puo' questo utente compiere questa azione su questo tipo di risorsa?
 *
 * Attenzione: risponde sul TIPO di risorsa, non sulla singola riga. Il filtro
 * per riga e' `scopeFor()`, e va applicato nella query (§11.4 regola 2).
 */
export function can(subject: PolicySubject, action: Action, resource: Resource): boolean {
  // Un utente disattivato non puo' nulla, in nessun caso, indipendentemente dal ruolo.
  if (!subject.isActive) return false

  const level = levelFor(subject, resource)

  if (level === 'cost-gated') {
    // I dati di costo si leggono soltanto, mai si scrivono da qui:
    // la scrittura passa dalle risorse non gated (quote, material, ...).
    return action === 'read' && subject.canViewCosts
  }

  const allowed: readonly Action[] = ACTIONS_BY_LEVEL[level]
  return allowed.includes(action)
}

/* -------------------------------------------------------------------------- */
/*  Scope per riga                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Quali righe puo' vedere, fra quelle del tipo consentito.
 *
 *  - `all`      : tutte. E' il default per i ruoli da scrivania: §11.5 stabilisce
 *                 che non c'e' siloing interno al ruolo, perche' con 1–3 persone
 *                 per area crea piu' attrito di quanto protegga.
 *  - `assigned` : solo quelle collegate a lavori assegnati all'utente.
 *  - `none`     : nessuna.
 *
 * Il filtro corrispondente va applicato NELLA QUERY. Questa funzione dice
 * quale filtro serve; non lo applica, e non puo' applicarlo al posto di chi
 * scrive la query. Da Fase 4, quando esistono i work order, `assigned` avra'
 * una join concreta; oggi vale come contratto esplicito.
 */
export type Scope = 'none' | 'assigned' | 'all'

export function scopeFor(subject: PolicySubject, resource: Resource): Scope {
  if (!can(subject, 'read', resource)) return 'none'
  return subject.isFieldOnly ? 'assigned' : 'all'
}

/* -------------------------------------------------------------------------- */
/*  Errore e helper per gli endpoint                                           */
/* -------------------------------------------------------------------------- */

export class AuthorizationError extends Error {
  readonly action: Action
  readonly resource: Resource

  constructor(action: Action, resource: Resource) {
    // Il messaggio non rivela se la risorsa esiste ne' perche' e' negata.
    super('Accesso non consentito')
    this.name = 'AuthorizationError'
    this.action = action
    this.resource = resource
  }
}

/**
 * Da usare in ogni endpoint e server action prima di toccare i dati.
 * Solleva invece di restituire un booleano: un `if` dimenticato passa
 * inosservato, un throw no.
 *
 * La registrazione del diniego (§11.4 regola 6) avviene nel chiamante lato
 * server, che ha accesso al database: questo modulo resta puro.
 */
export function authorize(
  subject: PolicySubject,
  action: Action,
  resource: Resource,
): void {
  if (!can(subject, action, resource)) {
    throw new AuthorizationError(action, resource)
  }
}

/** Elenco esaustivo, usato dai test per garantire che la matrice sia completa. */
export const ALL_ROLES: readonly Role[] = [
  'amministratore',
  'contabilita',
  'commerciale',
  'cantiere',
]

export const ALL_ACTIONS: readonly Action[] = [
  'read',
  'create',
  'update',
  'delete',
  'approve',
]

export const ALL_RESOURCES: readonly Resource[] = Object.keys(
  MATRIX.amministratore,
) as Resource[]
