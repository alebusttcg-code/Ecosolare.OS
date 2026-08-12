import { timingSafeEqual } from 'node:crypto'
import { and, asc, desc, eq, isNull, like, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb, type Esecutore } from '@/db'
import {
  activities,
  contacts,
  inboundSubmissions,
  leadSources,
  opportunities,
  opportunityStatusHistory,
  users,
} from '@/db/schema'
import { env } from '@/env'
import { recordAudit } from '@/lib/audit'
import { findDuplicates } from '@/lib/domain/dedup'
import { parseIntakePayload, SOGLIA_COLLEGAMENTO } from '@/lib/domain/intake'
import { consumaLimite } from '@/lib/limiti/contatore'
import { indirizzoChiamante } from '@/lib/limiti/indirizzo'
import {
  LIMITE_GLOBALE,
  LIMITE_PER_IP,
  LIMITE_TOKEN_ERRATO,
  type EsitoLimite,
} from '@/lib/limiti/politica'
import { CHIAVI, getSetting } from '@/lib/settings'

/**
 * Ricezione dei lead dai form del sito e dalle landing page.
 *
 * Tre proprieta' che questo endpoint deve avere, in ordine di importanza:
 *
 *  1. **Non perdere mai un lead.** Il payload grezzo viene salvato PRIMA di
 *     qualunque interpretazione. Se il resto fallisce, la richiesta e' comunque
 *     recuperabile a mano: e' esattamente il problema che il sistema deve
 *     eliminare (§2 del blueprint).
 *  2. **Essere idempotente.** Lo stesso invio ripetuto — perche' il form ritenta,
 *     perche' l'utente ha premuto due volte — non deve creare due opportunita'.
 *  3. **Non diventare un canale di ingresso.** Risponde solo con un token
 *     condiviso valido, e non restituisce mai dati di altri contatti.
 *  4. **Reggere anche se il token esce.** Il segreto e' condiviso con i form
 *     del sito: se una di quelle integrazioni lo mette in una pagina, il token
 *     e' pubblico e nessuno se ne accorge. Da solo non basta, quindi c'e' un
 *     limite di frequenza sopra — per indirizzo, complessivo, e uno piu' stretto
 *     per chi il token lo sta cercando.
 */

function troppoFrequente(esito: EsitoLimite, motivo: string): NextResponse {
  // 429 e non 403: al modulo del sito si sta dicendo «più tardi», non «mai»,
  // e `Retry-After` è l'unica parte della risposta che un client automatico
  // legge davvero.
  return NextResponse.json(
    { errore: motivo, riprovaTra: esito.riprovaTraSecondi },
    { status: 429, headers: { 'Retry-After': String(esito.riprovaTraSecondi) } },
  )
}

function confrontoSicuro(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

/**
 * A chi assegnare il lead.
 *
 * Regola provvisoria, in attesa delle risposte dell'audit (B4): si usa il
 * proprietario configurato, altrimenti il primo commerciale attivo, altrimenti
 * un amministratore. Le vere regole di assegnazione — per zona, per turno, per
 * linea di business — sono una configurazione da definire con l'azienda.
 */
async function scegliProprietario(): Promise<string | null> {
  const db = getDb()

  const emailConfigurata = await getSetting<string>('intake.proprietario_default_email', '')
  if (emailConfigurata) {
    const scelto = await db.query.users.findFirst({
      where: and(eq(users.email, emailConfigurata.toLowerCase()), eq(users.isActive, true)),
      columns: { id: true },
    })
    if (scelto) return scelto.id
  }

  const commerciale = await db.query.users.findFirst({
    where: and(eq(users.role, 'commerciale'), eq(users.isActive, true)),
    columns: { id: true },
    orderBy: asc(users.createdAt),
  })
  if (commerciale) return commerciale.id

  const amministratore = await db.query.users.findFirst({
    where: and(eq(users.role, 'amministratore'), eq(users.isActive, true)),
    columns: { id: true },
    orderBy: asc(users.createdAt),
  })
  return amministratore?.id ?? null
}

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

export async function POST(request: Request): Promise<NextResponse> {
  const configurazione = env()
  const atteso = configurazione.INTAKE_TOKEN

  // Endpoint disattivato finche' non e' configurato un segreto: meglio non
  // funzionante che aperto a chiunque.
  if (!atteso) {
    return NextResponse.json({ errore: 'Intake non configurato.' }, { status: 503 })
  }

  const db = getDb()
  const indirizzo = indirizzoChiamante(request.headers)

  /*
   * I limiti si applicano prima di leggere il corpo: chi sta inondando
   * l'endpoint non deve poterci far allocare megabyte di JSON per scoprire
   * poi che la richiesta andava rifiutata.
   *
   * Prima quello globale, perché è l'unico che non dipende da un'intestazione
   * che il chiamante può scrivere come vuole.
   */
  const globale = await consumaLimite(db, {
    bucket: 'intake:globale',
    chiave: 'tutti',
    finestra: LIMITE_GLOBALE,
  })
  if (!globale.consentito) {
    return troppoFrequente(globale, 'Troppe richieste verso questo endpoint.')
  }

  const perIndirizzo = await consumaLimite(db, {
    bucket: 'intake:ip',
    chiave: indirizzo,
    finestra: LIMITE_PER_IP,
  })
  if (!perIndirizzo.consentito) {
    return troppoFrequente(perIndirizzo, 'Troppe richieste da questo indirizzo.')
  }

  const fornito = request.headers.get('x-intake-token') ?? ''
  if (!confrontoSicuro(fornito, atteso)) {
    /*
     * Il tentativo con token sbagliato ha un contatore suo, molto più stretto:
     * qui non c'è alcun uso legittimo da proteggere, e senza questo il limite
     * per indirizzo lascerebbe comunque venti tentativi all'ora a chi prova a
     * indovinare il segreto.
     */
    const tentativi = await consumaLimite(db, {
      bucket: 'intake:token',
      chiave: indirizzo,
      finestra: LIMITE_TOKEN_ERRATO,
    })
    if (!tentativi.consentito) {
      // Vale la pena registrarlo: è il segnale che qualcuno sta cercando il
      // token, e senza traccia nessuno lo saprebbe mai.
      await recordAudit({
        actorType: 'system',
        actorLabel: 'intake-web',
        action: 'access_denied',
        entityType: 'lead_intake',
        context: { motivo: 'token_errato', tentativiStimati: tentativi.usate },
        ipAddress: indirizzo,
      })
      return troppoFrequente(tentativi, 'Troppi tentativi non autorizzati.')
    }
    return NextResponse.json({ errore: 'Non autorizzato.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ errore: 'Corpo della richiesta non valido.' }, { status: 400 })
  }

  const canale = 'sito' as const
  const interpretato = parseIntakePayload(payload)
  const externalId = interpretato.ok ? interpretato.lead.externalId : null

  // Idempotenza: se questo invio e' gia' stato ricevuto, si restituisce l'esito
  // precedente senza creare nulla di nuovo.
  if (externalId) {
    const gia = await db.query.inboundSubmissions.findFirst({
      where: and(
        eq(inboundSubmissions.channel, canale),
        eq(inboundSubmissions.externalId, externalId),
      ),
      columns: { id: true, opportunityId: true, contactId: true },
    })
    if (gia) {
      return NextResponse.json(
        { esito: 'gia_ricevuto', submissionId: gia.id, opportunitaId: gia.opportunityId },
        { status: 200 },
      )
    }
  }

  // Il grezzo si salva sempre, anche quando non e' interpretabile.
  const [ricezione] = await db
    .insert(inboundSubmissions)
    .values({
      channel: canale,
      payload: payload as object,
      externalId,
      error: interpretato.ok ? null : interpretato.motivo,
    })
    .returning({ id: inboundSubmissions.id })

  if (!ricezione) {
    return NextResponse.json({ errore: 'Ricezione non riuscita.' }, { status: 500 })
  }

  if (!interpretato.ok) {
    // 202: la richiesta e' stata presa in carico e conservata, ma non ha potuto
    // generare un'opportunita'. Non si restituisce 4xx per non innescare i
    // rinvii automatici di alcuni form: il dato e' comunque al sicuro.
    return NextResponse.json(
      { esito: 'ricevuto_non_interpretabile', submissionId: ricezione.id, motivo: interpretato.motivo },
      { status: 202 },
    )
  }

  const lead = interpretato.lead

  const proprietarioId = await scegliProprietario()
  if (!proprietarioId) {
    await db
      .update(inboundSubmissions)
      .set({ error: 'Nessun utente attivo a cui assegnare il lead.' })
      .where(eq(inboundSubmissions.id, ricezione.id))
    return NextResponse.json(
      { esito: 'ricevuto_non_assegnato', submissionId: ricezione.id },
      { status: 202 },
    )
  }

  // Riconoscimento di un contatto gia' presente. Non e' una fusione: due record
  // esistenti non vengono mai uniti (US-02.2). Qui si evita solo di creare una
  // seconda anagrafica per una persona identificata da telefono, email o codice
  // fiscale IDENTICI.
  const filtri = [eq(contacts.lastName, lead.lastName)]
  if (lead.phoneE164) filtri.push(eq(contacts.phoneE164, lead.phoneE164))
  if (lead.emailNormalized) filtri.push(eq(contacts.emailNormalized, lead.emailNormalized))

  const candidati = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phoneE164: contacts.phoneE164,
      emailNormalized: contacts.emailNormalized,
      taxCode: contacts.taxCode,
    })
    .from(contacts)
    .where(and(or(...filtri), isNull(contacts.deletedAt)))
    .limit(50)

  const duplicati = findDuplicates(
    { ...lead, taxCode: null, city: lead.city ?? null },
    candidati.map((c) => ({ ...c, city: null })),
  )
  const collegabile = duplicati.find((d) => d.result.score >= SOGLIA_COLLEGAMENTO)

  const fonte = lead.sourceCode
    ? await db.query.leadSources.findFirst({
        where: eq(leadSources.code, lead.sourceCode),
        columns: { id: true },
      })
    : await db.query.leadSources.findFirst({
        where: eq(leadSources.code, 'sito'),
        columns: { id: true },
      })

  const giorni = await getSetting(CHIAVI.giorniDefaultProssimaAzione, 2)
  const scadenza = new Date(Date.now() + giorni * 86_400_000)

  const risultato = await db.transaction(async (tx) => {
    let contactId = collegabile?.record.id

    if (!contactId) {
      const [nuovo] = await tx
        .insert(contacts)
        .values({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          emailNormalized: lead.emailNormalized,
          phone: lead.phone,
          phoneE164: lead.phoneE164,
          sourceId: fonte?.id ?? null,
          notes: lead.message,
        })
        .returning({ id: contacts.id })
      contactId = nuovo!.id
    }

    const code = await prossimoCodice(tx, new Date().getFullYear())
    const [opp] = await tx
      .insert(opportunities)
      .values({
        code,
        contactId,
        businessLine: lead.businessLine,
        title: lead.message?.slice(0, 120) || `Richiesta ${lead.businessLine}`,
        stage: 'nuovo',
        ownerId: proprietarioId,
        sourceId: fonte?.id ?? null,
        probability: 5,
        nextActionDueAt: scadenza,
        notes: lead.message,
      })
      .returning({ id: opportunities.id, code: opportunities.code })

    await tx.insert(activities).values({
      kind: 'chiamata',
      subject: 'Primo contatto',
      opportunityId: opp!.id,
      contactId,
      assignedTo: proprietarioId,
      dueAt: scadenza,
      isNextAction: true,
    })

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: opp!.id,
      toStage: 'nuovo',
    })

    await tx
      .update(inboundSubmissions)
      .set({
        processedAt: new Date(),
        contactId,
        opportunityId: opp!.id,
        dedupStatus: collegabile
          ? 'confermato_duplicato'
          : duplicati.length > 0
            ? 'possibile_duplicato'
            : 'nessun_duplicato',
        dedupCandidates: duplicati.length > 0 ? duplicati.map((d) => ({
          contactId: d.record.id,
          score: d.result.score,
          motivi: d.result.reasons,
        })) : null,
      })
      .where(eq(inboundSubmissions.id, ricezione.id))

    return { contactId, opportunityId: opp!.id, code: opp!.code }
  })

  await recordAudit({
    actorType: 'automation',
    actorLabel: 'intake-web',
    action: 'create',
    entityType: 'opportunity',
    entityId: risultato.opportunityId,
    context: {
      submissionId: ricezione.id,
      contattoEsistente: Boolean(collegabile),
      duplicatiSegnalati: duplicati.length,
    },
  })

  // La risposta non espone dati del contatto: conferma soltanto la ricezione.
  return NextResponse.json(
    { esito: 'creato', opportunita: risultato.code, submissionId: ricezione.id },
    { status: 201 },
  )
}
