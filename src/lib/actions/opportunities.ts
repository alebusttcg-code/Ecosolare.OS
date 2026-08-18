'use server'

import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Esecutore } from '@/db'
import {
  activities,
  contacts,
  opportunities,
  opportunityStatusHistory,
  pipelineStages,
  sites,
  users,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { authorize } from '@/lib/auth/policy'
import { findDuplicates, type DedupSubject } from '@/lib/domain/dedup'
import { normalizeEmail, normalizePhone } from '@/lib/domain/phone'
import { planStageChange } from '@/lib/domain/pipeline'
import { componeIndirizzo } from '@/lib/geo/tipi-via'
import { creaFollowUpPre } from '@/lib/follow-up'
import { getStages } from '@/lib/queries/pipeline'
import { CHIAVI, getSetting } from '@/lib/settings'

const STATO_INIZIALE = 'nuovo'

/**
 * Numerazione leggibile delle opportunita': OPP-2026-0001.
 *
 * La sequenza deriva dal massimo esistente dell'anno. In teoria due creazioni
 * simultanee possono collidere; in pratica l'indice univoco su `code` lo
 * impedisce e il chiamante ritenta. Ai volumi previsti (§3 A3) la collisione e'
 * un evento raro, e questa soluzione evita di introdurre una sequenza dedicata
 * per ogni prefisso. Se la numerazione dovra' allinearsi al gestionale contabile
 * (D-004), questo e' il punto da cambiare.
 */
async function prossimoCodice(db: Esecutore, anno: number): Promise<string> {
  const prefisso = `OPP-${anno}-`
  const [ultima] = await db
    .select({ code: opportunities.code })
    .from(opportunities)
    .where(like(opportunities.code, `${prefisso}%`))
    .orderBy(desc(opportunities.code))
    .limit(1)

  const progressivo = ultima ? Number.parseInt(ultima.code.slice(prefisso.length), 10) + 1 : 1
  return `${prefisso}${String(progressivo).padStart(4, '0')}`
}

/**
 * Nuovo lead = anagrafica + pratica commerciale in un colpo solo.
 *
 * L'operatore non sceglie un cliente da una tendina: scrive nome, cognome e
 * telefono (obbligatori) e il sistema crea il contatto insieme al lead. I campi
 * opzionali si possono lasciare vuoti e completare dopo. Se emerge un possibile
 * duplicato, si propone: riusarlo oppure creare comunque.
 */
const leadSchema = z
  .object({
    /** Se valorizzato, si riusa un contatto esistente (scelta dopo dedup o da scheda cliente). */
    contactId: z.uuid().optional(),

    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(160).optional(),
    taxCode: z.string().trim().max(16).optional(),
    preferredChannel: z.enum(['telefono', 'email', 'whatsapp']).optional(),
    marketingConsent: z.boolean().default(false),
    confermaNonDuplicato: z.boolean().default(false),

    streetType: z.string().trim().max(40).optional(),
    streetName: z.string().trim().max(120).optional(),
    houseNumber: z.string().trim().max(20).optional(),
    city: z.string().trim().max(80).optional(),
    province: z.string().trim().max(4).optional(),
    postalCode: z.string().trim().max(10).optional(),

    businessLine: z.enum(['fotovoltaico', 'elettrico', 'idraulico']),
    title: z.string().trim().min(1, 'Indicare una descrizione').max(160),
    sourceId: z.uuid().optional(),
    /** Solo utenti con ruolo commerciale: è chi prende in carico il lead. */
    ownerId: z.uuid('Selezionare un responsabile commerciale'),
    nextActionDueAt: z.date().optional(),
    nextActionSubject: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((dati, ctx) => {
    if (dati.contactId) return
    if (!dati.firstName?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Il nome è obbligatorio.' })
    }
    if (!dati.lastName?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Il cognome è obbligatorio.' })
    }
    if (!dati.phone?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Il telefono è obbligatorio: senza non si richiama nessuno.',
      })
    }
  })

export type OpportunityInput = z.input<typeof leadSchema>

export interface DuplicatoLead {
  readonly id: string
  readonly nome: string
  readonly telefono: string | null
  readonly score: number
  readonly motivi: readonly string[]
}

export type ActionResult<T = undefined> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errors: Record<string, string> }

export type CreateLeadResult =
  | { readonly ok: true; readonly data: { id: string; code: string } }
  | { readonly ok: false; readonly errors: Record<string, string> }
  | { readonly ok: false; readonly duplicati: readonly DuplicatoLead[] }

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

async function cercaDuplicatiContatto(soggetto: DedupSubject) {
  const condizioni = [eq(contacts.lastName, soggetto.lastName)]
  if (soggetto.phoneE164) condizioni.push(eq(contacts.phoneE164, soggetto.phoneE164))
  if (soggetto.emailNormalized) {
    condizioni.push(eq(contacts.emailNormalized, soggetto.emailNormalized))
  }
  if (soggetto.taxCode) condizioni.push(eq(contacts.taxCode, soggetto.taxCode))

  const candidati = await getDb()
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      phoneE164: contacts.phoneE164,
      emailNormalized: contacts.emailNormalized,
      taxCode: contacts.taxCode,
    })
    .from(contacts)
    .where(and(or(...condizioni), isNull(contacts.deletedAt)))
    .limit(50)

  return findDuplicates(
    soggetto,
    candidati.map((c) => ({ ...c, city: null })),
  ).map((d) => {
    const riga = candidati.find((c) => c.id === d.record.id)
    return {
      id: d.record.id,
      nome: [d.record.firstName, d.record.lastName].filter(Boolean).join(' '),
      telefono: riga?.phone ?? null,
      score: d.result.score,
      motivi: d.result.reasons,
    }
  })
}

/**
 * Crea un lead con la sua anagrafica e la prima azione, nella stessa transazione.
 */
export async function createOpportunity(input: OpportunityInput): Promise<CreateLeadResult> {
  const utente = await guard('create', 'opportunity')

  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  // Un secondo `guard` rileggerebbe sessione e utente dal DB: sulla latenza del
  // pooler remoto sono due round-trip evitabili. Stesso utente, controllo puro.
  if (!dati.contactId) {
    try {
      authorize(utente, 'create', 'contact')
    } catch {
      return { ok: false, errors: { _: 'Non sei autorizzato a creare anagrafiche.' } }
    }
  }

  const db = getDb()
  const ownerId = dati.ownerId

  // Letture indipendenti in parallelo: in serie su Supabase (Irlanda) ognuna
  // costa decine di ms di rete, e prima erano quattro andate consecutive.
  const [responsabile, iniziale, giorniDefault] = await Promise.all([
    db.query.users.findFirst({
      where: and(
        eq(users.id, ownerId),
        eq(users.role, 'commerciale'),
        eq(users.isActive, true),
      ),
      columns: { id: true },
    }),
    db.query.pipelineStages.findFirst({
      where: eq(pipelineStages.code, STATO_INIZIALE),
      columns: { code: true, defaultProbability: true },
    }),
    dati.nextActionDueAt
      ? Promise.resolve(2)
      : getSetting(CHIAVI.giorniDefaultProssimaAzione, 2),
  ])

  if (!responsabile) {
    return {
      ok: false,
      errors: { ownerId: 'Il responsabile deve essere un utente commerciale attivo.' },
    }
  }
  if (!iniziale) {
    return {
      ok: false,
      errors: { _: 'Stati della pipeline non configurati. Eseguire il seed.' },
    }
  }

  const scadenza =
    dati.nextActionDueAt ?? new Date(Date.now() + giorniDefault * 86_400_000)

  // Contatto già scelto (scheda cliente o conferma duplicato): solo il lead.
  if (dati.contactId) {
    const esistente = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, dati.contactId), isNull(contacts.deletedAt)),
      columns: { id: true },
    })
    if (!esistente) return { ok: false, errors: { contactId: 'Cliente non trovato.' } }

    const creata = await creaLeadSuContatto({
      contactId: dati.contactId,
      siteId: null,
      dati,
      ownerId,
      utenteId: utente.id,
      utenteEmail: utente.email,
      scadenza,
      probabilita: iniziale.defaultProbability,
    })
    return { ok: true, data: creata }
  }

  const telefono = normalizePhone(dati.phone)
  const email = normalizeEmail(dati.email)
  const soggetto: DedupSubject = {
    phoneE164: telefono.e164,
    emailNormalized: email,
    taxCode: dati.taxCode?.toUpperCase() ?? null,
    lastName: dati.lastName!,
    firstName: dati.firstName ?? null,
    city: dati.city ?? null,
  }

  if (!dati.confermaNonDuplicato) {
    const duplicati = await cercaDuplicatiContatto(soggetto)
    if (duplicati.length > 0) return { ok: false, duplicati }
  }

  const creato = await db.transaction(async (tx) => {
    // L'indirizzo entra due volte, di proposito: sul contatto è l'indirizzo di
    // fatturazione (del soggetto fiscale), sul sito è dove si installa. Per il
    // residenziale coincidono, ma restano concetti diversi.
    const addressLine = componeIndirizzo({
      tipoVia: dati.streetType,
      nomeVia: dati.streetName,
      civico: dati.houseNumber,
    })
    const [contatto] = await tx
      .insert(contacts)
      .values({
        firstName: dati.firstName!.trim(),
        lastName: dati.lastName!.trim(),
        email: dati.email?.trim() || null,
        emailNormalized: email,
        phone: telefono.raw || null,
        phoneE164: telefono.e164,
        taxCode: dati.taxCode?.toUpperCase() || null,
        addressLine: addressLine || null,
        city: dati.city?.trim() || null,
        province: dati.province?.toUpperCase() || null,
        postalCode: dati.postalCode?.trim() || null,
        preferredChannel: dati.preferredChannel ?? null,
        marketingConsent: dati.marketingConsent,
        marketingConsentAt: dati.marketingConsent ? new Date() : null,
        marketingConsentSource: dati.marketingConsent ? 'inserimento lead' : null,
        sourceId: dati.sourceId ?? null,
        createdBy: utente.id,
        updatedBy: utente.id,
      })
      .returning({ id: contacts.id })

    if (!contatto) throw new Error('Inserimento contatto non riuscito')

    let sitoId: string | null = null
    if (dati.city?.trim() && addressLine) {
      const [sito] = await tx
        .insert(sites)
        .values({
          label: 'Sito intervento',
          contactId: contatto.id,
          addressLine,
          city: dati.city.trim(),
          province: dati.province?.toUpperCase() || null,
          postalCode: dati.postalCode?.trim() || null,
          createdBy: utente.id,
        })
        .returning({ id: sites.id })
      sitoId = sito?.id ?? null
    }

    const code = await prossimoCodice(tx, new Date().getFullYear())
    const [opp] = await tx
      .insert(opportunities)
      .values({
        code,
        contactId: contatto.id,
        siteId: sitoId,
        businessLine: dati.businessLine,
        title: dati.title,
        stage: STATO_INIZIALE,
        ownerId,
        sourceId: dati.sourceId ?? null,
        estimatedValue: null,
        probability: iniziale.defaultProbability,
        nextActionDueAt: scadenza,
        notes: dati.notes ?? null,
        createdBy: utente.id,
        updatedBy: utente.id,
      })
      .returning({ id: opportunities.id, code: opportunities.code })

    if (!opp) throw new Error('Inserimento opportunita non riuscito')

    const acquisizione = new Date()

    await tx.insert(activities).values({
      kind: 'chiamata',
      subject: dati.nextActionSubject?.trim() || 'Primo contatto',
      opportunityId: opp.id,
      contactId: contatto.id,
      assignedTo: ownerId,
      dueAt: scadenza,
      isNextAction: true,
      createdBy: utente.id,
    })

    await creaFollowUpPre(tx, {
      opportunityId: opp.id,
      contactId: contatto.id,
      ownerId,
      createdBy: utente.id,
      acquisizione,
    })

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: opp.id,
      fromStage: null,
      toStage: STATO_INIZIALE,
      changedBy: utente.id,
    })

    return { contattoId: contatto.id, opp }
  })

  // L'audit non deve ritardare la risposta: se fallisce, logga e basta.
  void recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'contact',
    entityId: creato.contattoId,
  })
  void recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'opportunity',
    entityId: creato.opp.id,
  })

  revalidatePath('/lead')
  return { ok: true, data: creato.opp }
}

async function creaLeadSuContatto(params: {
  contactId: string
  siteId: string | null
  dati: z.infer<typeof leadSchema>
  ownerId: string
  utenteId: string
  utenteEmail: string
  scadenza: Date
  probabilita: number
}): Promise<{ id: string; code: string }> {
  const { contactId, siteId, dati, ownerId, utenteId, utenteEmail, scadenza, probabilita } =
    params

  const creata = await getDb().transaction(async (tx) => {
    const code = await prossimoCodice(tx, new Date().getFullYear())

    const [opp] = await tx
      .insert(opportunities)
      .values({
        code,
        contactId,
        siteId,
        businessLine: dati.businessLine,
        title: dati.title,
        stage: STATO_INIZIALE,
        ownerId,
        sourceId: dati.sourceId ?? null,
        estimatedValue: null,
        probability: probabilita,
        nextActionDueAt: scadenza,
        notes: dati.notes ?? null,
        createdBy: utenteId,
        updatedBy: utenteId,
      })
      .returning({ id: opportunities.id, code: opportunities.code })

    if (!opp) throw new Error('Inserimento opportunita non riuscito')

    const acquisizione = new Date()

    await tx.insert(activities).values({
      kind: 'chiamata',
      subject: dati.nextActionSubject?.trim() || 'Primo contatto',
      opportunityId: opp.id,
      contactId,
      assignedTo: ownerId,
      dueAt: scadenza,
      isNextAction: true,
      createdBy: utenteId,
    })

    await creaFollowUpPre(tx, {
      opportunityId: opp.id,
      contactId,
      ownerId,
      createdBy: utenteId,
      acquisizione,
    })

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: opp.id,
      fromStage: null,
      toStage: STATO_INIZIALE,
      changedBy: utenteId,
    })

    return opp
  })

  void recordEntityChange({
    actorId: utenteId,
    actorLabel: utenteEmail,
    action: 'create',
    entityType: 'opportunity',
    entityId: creata.id,
  })

  revalidatePath('/lead')
  return creata
}

const stageChangeSchema = z.object({
  opportunityId: z.uuid(),
  toStage: z.string().trim().min(1),
  nextActionDueAt: z.date().optional(),
  lostReason: z.string().trim().max(400).optional(),
  note: z.string().trim().max(400).optional(),
})

/** Cambia lo stato di un'opportunita', applicando gli invarianti di pipeline. */
export async function changeStage(
  input: z.input<typeof stageChangeSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'opportunity')

  const parsed = stageChangeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const corrente = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, dati.opportunityId),
  })
  if (!corrente) return { ok: false, errors: { _: 'Opportunità non trovata.' } }

  const stages = await getStages()
  const destinazione = stages.find((s) => s.code === dati.toStage)
  // Stage vinto solo via «Conferma e apri cantiere» (firma → contratto + progetto).
  if (destinazione?.isWon) {
    return {
      ok: false,
      errors: {
        toStage:
          'Lo stato «Contratto firmato» si raggiunge solo registrando la firma sul preventivo.',
      },
    }
  }

  const esito = planStageChange(
    {
      current: {
        stage: corrente.stage,
        stageSince: corrente.stageSince,
        probability: corrente.probability,
        nextActionDueAt: corrente.nextActionDueAt,
        lostReason: corrente.lostReason,
        closedAt: corrente.closedAt,
      },
      toStage: dati.toStage,
      nextActionDueAt: dati.nextActionDueAt ?? null,
      lostReason: dati.lostReason ?? null,
      note: dati.note ?? null,
      now: new Date(),
    },
    stages,
  )

  if (!esito.ok) {
    const out: Record<string, string> = {}
    for (const v of esito.violations) out[v.field] ??= v.message
    return { ok: false, errors: out }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({ ...esito.patch, updatedAt: new Date(), updatedBy: utente.id })
      .where(eq(opportunities.id, dati.opportunityId))

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: dati.opportunityId,
      fromStage: esito.history.fromStage,
      toStage: esito.history.toStage,
      daysInPreviousStage: esito.history.daysInPreviousStage,
      note: esito.history.note,
      changedBy: utente.id,
    })

    // Chiudendo l'opportunita' le attivita' aperte non hanno piu' ragione di
    // comparire fra le cose da fare di qualcuno.
    if (esito.patch.closedAt) {
      await tx
        .update(activities)
        .set({ isNextAction: false })
        .where(
          and(
            eq(activities.opportunityId, dati.opportunityId),
            eq(activities.isNextAction, true),
            sql`${activities.completedAt} is null`,
          ),
        )
    }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'opportunity',
    entityId: dati.opportunityId,
    before: {
      stage: corrente.stage,
      probability: corrente.probability,
      lostReason: corrente.lostReason,
      closedAt: corrente.closedAt,
    },
    after: {
      stage: esito.patch.stage,
      probability: esito.patch.probability,
      lostReason: esito.patch.lostReason,
      closedAt: esito.patch.closedAt,
    },
  })

  revalidatePath('/lead')
  revalidatePath(`/lead/${dati.opportunityId}`)
  return { ok: true, data: undefined }
}

const aggiornaLeadSchema = z.object({
  opportunityId: z.uuid(),
  firstName: z.string().trim().min(1, 'Il nome è obbligatorio.').max(80),
  lastName: z.string().trim().min(1, 'Il cognome è obbligatorio.').max(80),
  phone: z.string().trim().min(1, 'Il telefono è obbligatorio.').max(40),
  email: z.string().trim().max(160).optional(),
  taxCode: z.string().trim().max(16).optional(),
  preferredChannel: z.enum(['telefono', 'email', 'whatsapp']).optional(),
  marketingConsent: z.boolean().default(false),

  streetType: z.string().trim().max(40).optional(),
  streetName: z.string().trim().max(120).optional(),
  houseNumber: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  province: z.string().trim().max(4).optional(),
  postalCode: z.string().trim().max(10).optional(),

  businessLine: z.enum(['fotovoltaico', 'elettrico', 'idraulico']),
  title: z.string().trim().min(1, 'Indicare una descrizione').max(160),
  sourceId: z.uuid().optional(),
  ownerId: z.uuid('Selezionare un responsabile commerciale'),
  notes: z.string().trim().max(2000).optional(),
})

export type AggiornaLeadInput = z.input<typeof aggiornaLeadSchema>

/**
 * Aggiorna anagrafica, indirizzo e dati commerciali di un lead già aperto.
 *
 * Non tocca lo stato della pipeline: quello resta su `changeStage`, perché è
 * un passaggio con regole e storico propri.
 */
export async function updateLead(input: AggiornaLeadInput): Promise<ActionResult> {
  const utente = await guard('update', 'opportunity')

  const parsed = aggiornaLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const responsabile = await getDb().query.users.findFirst({
    where: and(
      eq(users.id, dati.ownerId),
      eq(users.role, 'commerciale'),
      eq(users.isActive, true),
    ),
    columns: { id: true },
  })
  if (!responsabile) {
    return {
      ok: false,
      errors: { ownerId: 'Il responsabile deve essere un utente commerciale attivo.' },
    }
  }

  const db = getDb()
  const corrente = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, dati.opportunityId),
  })
  if (!corrente) return { ok: false, errors: { _: 'Lead non trovato.' } }

  const telefono = normalizePhone(dati.phone)
  const email = normalizeEmail(dati.email)
  const addressLine = componeIndirizzo({
    tipoVia: dati.streetType,
    nomeVia: dati.streetName,
    civico: dati.houseNumber,
  })

  await db.transaction(async (tx) => {
    await tx
      .update(contacts)
      .set({
        firstName: dati.firstName,
        lastName: dati.lastName,
        email: dati.email?.trim() || null,
        emailNormalized: email,
        phone: telefono.raw || null,
        phoneE164: telefono.e164,
        taxCode: dati.taxCode?.toUpperCase() || null,
        preferredChannel: dati.preferredChannel ?? null,
        marketingConsent: dati.marketingConsent,
        marketingConsentAt: dati.marketingConsent ? new Date() : null,
        marketingConsentSource: dati.marketingConsent ? 'modifica lead' : null,
        sourceId: dati.sourceId ?? null,
        updatedAt: new Date(),
        updatedBy: utente.id,
      })
      .where(eq(contacts.id, corrente.contactId))

    let siteId = corrente.siteId

    if (dati.city?.trim() && addressLine) {
      const campiSito = {
        addressLine,
        city: dati.city.trim(),
        province: dati.province?.toUpperCase() || null,
        postalCode: dati.postalCode?.trim() || null,
        updatedAt: new Date(),
        updatedBy: utente.id,
      }

      if (siteId) {
        await tx.update(sites).set(campiSito).where(eq(sites.id, siteId))
      } else {
        const [sito] = await tx
          .insert(sites)
          .values({
            label: 'Sito intervento',
            contactId: corrente.contactId,
            ...campiSito,
            createdBy: utente.id,
          })
          .returning({ id: sites.id })
        siteId = sito?.id ?? null
      }
    }

    await tx
      .update(opportunities)
      .set({
        title: dati.title,
        businessLine: dati.businessLine,
        sourceId: dati.sourceId ?? null,
        ownerId: dati.ownerId,
        siteId,
        notes: dati.notes ?? null,
        updatedAt: new Date(),
        updatedBy: utente.id,
      })
      .where(eq(opportunities.id, dati.opportunityId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'opportunity',
    entityId: dati.opportunityId,
    before: {
      title: corrente.title,
      ownerId: corrente.ownerId,
      businessLine: corrente.businessLine,
    },
    after: {
      title: dati.title,
      ownerId: dati.ownerId,
      businessLine: dati.businessLine,
    },
  })

  revalidatePath('/lead')
  revalidatePath(`/lead/${dati.opportunityId}`)
  revalidatePath(`/clienti/${corrente.contactId}`)
  return { ok: true, data: undefined }
}
