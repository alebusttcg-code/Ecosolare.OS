/**
 * Inserisce 3 lead di prova per vedere /metriche senza cancellare dati esistenti.
 *
 *   npm run prova:metriche
 *
 * I lead hanno cognome «Test Metriche …» e codice OPP che contiene «TEST-M».
 * Per rimuoverli: cancella manualmente da Lead o lasciali (non influenzano l'uso reale).
 */
import { and, desc, eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { proteggiScript } from '../src/db/ambiente'
import {
  activities,
  contacts,
  leadSources,
  opportunities,
  opportunityStatusHistory,
  pipelineStages,
  quoteVersions,
  quotes,
  users,
} from '../src/db/schema'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL non impostata.')
  process.exit(1)
}

proteggiScript('npm run prova:metriche')

const client = postgres(url, { max: 1, prepare: false })
const db = drizzle(client)

const PREFISSO = 'TEST-METRICHE'
const giorniFa = (n: number) => new Date(Date.now() - n * 86_400_000)
const fraGiorni = (n: number) => new Date(Date.now() + n * 86_400_000)

async function prossimoCodice(anno: number): Promise<string> {
  const prefisso = `OPP-${anno}-TEST-M`
  const [ultima] = await db
    .select({ code: opportunities.code })
    .from(opportunities)
    .where(like(opportunities.code, `${prefisso}%`))
    .orderBy(desc(opportunities.code))
    .limit(1)
  const seq = ultima ? Number.parseInt(ultima.code.slice(-3), 10) + 1 : 1
  return `${prefisso}${String(seq).padStart(3, '0')}`
}

async function main(): Promise<void> {
  const [commerciale] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'commerciale'), eq(users.isActive, true)))
    .limit(1)

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'amministratore'), eq(users.isActive, true)))
    .limit(1)

  const ownerId = commerciale?.id ?? admin?.id
  if (!ownerId) {
    console.error('Serve almeno un utente commerciale o amministratore attivo.')
    process.exit(1)
  }

  const [fonte] = await db.select({ id: leadSources.id }).from(leadSources).limit(1)
  const [statoNuovo] = await db
    .select({ code: pipelineStages.code, defaultProbability: pipelineStages.defaultProbability })
    .from(pipelineStages)
    .where(eq(pipelineStages.code, 'nuovo'))
    .limit(1)

  if (!statoNuovo) {
    console.error('Pipeline non configurata. Esegui: npm run db:seed')
    process.exit(1)
  }

  const esistenti = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(like(contacts.lastName, `${PREFISSO}%`))
    .limit(1)

  if (esistenti.length > 0) {
    console.log('Lead di prova già presenti. Apri http://localhost:3000/metriche')
    console.log('Periodo consigliato: «Ultimi 30 giorni».\n')
    await client.end()
    return
  }

  const anno = new Date().getFullYear()

  /* Lead 1 — appena arrivato, prima risposta già fatta (speed-to-lead ~4 h) */
  const creato1 = giorniFa(2)
  const risposta1 = new Date(creato1.getTime() + 4 * 3_600_000)
  const [c1] = await db
    .insert(contacts)
    .values({
      firstName: 'Anna',
      lastName: `${PREFISSO} Bianchi`,
      email: 'test-metriche-1@invalid.example',
      emailNormalized: 'test-metriche-1@invalid.example',
      phone: '+393331112222',
      phoneE164: '+393331112222',
      sourceId: fonte?.id ?? null,
    })
    .returning({ id: contacts.id })

  const code1 = await prossimoCodice(anno)
  const [o1] = await db
    .insert(opportunities)
    .values({
      code: code1,
      contactId: c1!.id,
      businessLine: 'fotovoltaico',
      title: 'Impianto 6 kW — prova metriche',
      stage: 'qualificato',
      stageSince: giorniFa(1),
      ownerId,
      sourceId: fonte?.id ?? null,
      estimatedValue: '12000.00',
      probability: 25,
      nextActionDueAt: fraGiorni(1),
      firstResponseAt: risposta1,
      createdAt: creato1,
    })
    .returning({ id: opportunities.id, code: opportunities.code })

  await db.insert(activities).values({
    kind: 'chiamata',
    subject: 'Inviare preventivo indicativo',
    opportunityId: o1!.id,
    contactId: c1!.id,
    assignedTo: ownerId,
    dueAt: fraGiorni(1),
    isNextAction: true,
  })

  /* Lead 2 — preventivo inviato, ancora aperto */
  const creato2 = giorniFa(18)
  const risposta2 = giorniFa(17)
  const [c2] = await db
    .insert(contacts)
    .values({
      firstName: 'Luca',
      lastName: `${PREFISSO} Verdi`,
      email: 'test-metriche-2@invalid.example',
      emailNormalized: 'test-metriche-2@invalid.example',
    })
    .returning({ id: contacts.id })

  const code2 = await prossimoCodice(anno)
  const [o2] = await db
    .insert(opportunities)
    .values({
      code: code2,
      contactId: c2!.id,
      businessLine: 'fotovoltaico',
      title: 'Fotovoltaico 4 kW — prova metriche',
      stage: 'preventivo_inviato',
      stageSince: giorniFa(8),
      ownerId,
      sourceId: fonte?.id ?? null,
      estimatedValue: '8500.00',
      probability: 55,
      nextActionDueAt: fraGiorni(2),
      firstResponseAt: risposta2,
      createdAt: creato2,
    })
    .returning({ id: opportunities.id, code: opportunities.code })

  const [q2] = await db
    .insert(quotes)
    .values({ code: `PRV-${anno}-TEST-M001`, opportunityId: o2!.id, title: 'Fotovoltaico 4 kW — prova metriche' })
    .returning({ id: quotes.id })
  const inviato2 = giorniFa(8)
  const [v2] = await db
    .insert(quoteVersions)
    .values({
      quoteId: q2!.id,
      versionNo: 1,
      status: 'inviato',
      sentAt: inviato2,
      revenueNet: '8200.00',
      costTotal: '5400.00',
      marginAmount: '2800.00',
      marginPct: '34.15',
      vatAmount: '902.00',
      grossTotal: '9102.00',
    })
    .returning({ id: quoteVersions.id })
  await db.update(quotes).set({ currentVersionId: v2!.id }).where(eq(quotes.id, q2!.id))

  await db.insert(activities).values({
    kind: 'chiamata',
    subject: 'Follow-up preventivo',
    opportunityId: o2!.id,
    contactId: c2!.id,
    assignedTo: ownerId,
    dueAt: fraGiorni(2),
    isNextAction: true,
  })

  /* Lead 3 — perso (per conversione) */
  const creato3 = giorniFa(25)
  const risposta3 = giorniFa(24)
  const perso3 = giorniFa(10)
  const [c3] = await db
    .insert(contacts)
    .values({
      firstName: 'Marco',
      lastName: `${PREFISSO} Neri`,
      email: 'test-metriche-3@invalid.example',
      emailNormalized: 'test-metriche-3@invalid.example',
    })
    .returning({ id: contacts.id })

  const code3 = await prossimoCodice(anno)
  const [o3] = await db
    .insert(opportunities)
    .values({
      code: code3,
      contactId: c3!.id,
      businessLine: 'fv_pdc',
      title: 'Adeguamento quadro — prova metriche',
      stage: 'perso',
      stageSince: perso3,
      ownerId,
      sourceId: fonte?.id ?? null,
      estimatedValue: '2800.00',
      probability: 0,
      lostReason: 'silenzio',
      closedAt: perso3,
      firstResponseAt: risposta3,
      createdAt: creato3,
    })
    .returning({ id: opportunities.id, code: opportunities.code })

  await db.insert(opportunityStatusHistory).values({
    opportunityId: o3!.id,
    toStage: 'perso',
    changedAt: perso3,
  })

  console.log(`
✓ 3 lead di prova creati (non cancellano dati esistenti).

  ${o1!.code}  → qualificato, speed-to-lead ~4 ore
  ${o2!.code}  → preventivo inviato
  ${o3!.code}  → perso (silenzio)

Apri nel browser (con npm run dev attivo):

  http://localhost:3000/metriche?periodo=30g

Se non vedi nulla, prova «Ultimi 90 giorni».

Per un percorso manuale passo passo: docs/03-baseline-kpi.md (sezione «Prova locale»).
`)

  await client.end()
}

main().catch((errore: unknown) => {
  console.error(errore)
  void client.end()
  process.exit(1)
})
