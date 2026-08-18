import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  appSettings,
  invoices,
  opportunities,
  paymentMilestones,
  projects,
  siteStudies,
  users,
} from '@/db/schema'
import { preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Il cuore del prodotto, ripercorso per intero con le azioni vere:
 *
 *   lead → studio → preventivo → invio → accettazione → firma → cantiere → fattura
 *
 * Ogni tappa è la server action che gira in produzione, non un mock, contro un
 * PostgreSQL vero (PGlite). È l'unico test che prova che i pezzi — coperti
 * singolarmente altrove — si incastrano davvero, e che i soldi arrivano fino a
 * una fattura emessa con numero progressivo.
 *
 * L'unica scorciatoia è lo studio tetto, inserito già «completo»: il laboratorio
 * è coperto a parte e non è ciò che questo test vuole provare.
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'admin@prova.it',
  name: 'Admin Prova',
  role: 'amministratore' as const,
  canViewCosts: true,
  isFieldOnly: false,
  isActive: true,
  mustChangePassword: false,
}

const contenitore: { db?: TestDatabase } = {}

vi.mock('@/db', async () => {
  const reale = await vi.importActual<typeof import('@/db')>('@/db')
  return { ...reale, getDb: () => contenitore.db }
})
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/drive/avvia-outbox', () => ({ avviaSmaltimentoOutbox: () => {} }))
vi.mock('@/lib/auth/session', () => ({
  guard: async () => utenteFinto,
  requireUser: async () => utenteFinto,
  getCurrentUser: async () => utenteFinto,
}))

const { createOpportunity } = await import('./opportunities')
const { createQuote, saveQuoteLines, sendQuote, recordQuoteOutcome } = await import('./quotes')
const { signContractAndOpenProject } = await import('./projects')
const { creaBozzaFattura, emettiFattura } = await import('./fatture')

describe('flusso completo lead → fattura', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let commercialeId: string

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    contenitore.db = db

    await db.insert(users).values({
      id: utenteFinto.id,
      email: utenteFinto.email,
      name: utenteFinto.name,
      role: 'amministratore',
      canViewCosts: true,
      mustChangePassword: false,
    })
    await preparaConfigurazione(db)
    // Soglia esplicita: il preventivo del test è ampiamente sopra (50%).
    await db
      .insert(appSettings)
      .values({ key: 'preventivi.soglia_margine_pct', value: 20 })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: 20 } })

    const [commerciale] = await db
      .insert(users)
      .values({
        email: 'commerciale@prova.it',
        name: 'Commerciale Prova',
        role: 'commerciale',
        canViewCosts: false,
        mustChangePassword: false,
      })
      .returning({ id: users.id })
    commercialeId = commerciale!.id
  })

  afterAll(async () => {
    await close()
  })

  it('porta un lead fino a una fattura emessa, passando per ogni azione reale', async () => {
    /* 1. LEAD — nasce il contatto e l'opportunità, con il codice fiscale che
       servirà all'emissione della fattura. */
    const lead = await createOpportunity({
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '3331234567',
      taxCode: 'RSSMRA80A01H501U',
      businessLine: 'fotovoltaico',
      title: 'Impianto 6 kW',
      ownerId: commercialeId,
    })
    expect(lead.ok).toBe(true)
    if (!lead.ok) return
    const opportunityId = lead.data.id

    /* 2. STUDIO — inserito già completo (il laboratorio è coperto altrove). */
    const [studio] = await db
      .insert(siteStudies)
      .values({
        opportunityId,
        status: 'completo',
        title: 'Studio tetto',
        moduliCount: 15,
        powerKwp: '6.000',
        produzioneKwh: '7800.0',
        consumoKwh: '4200.0',
        formattedAddress: 'Via Prova 1, La Spezia',
        completedAt: new Date(),
      })
      .returning({ id: siteStudies.id })

    /* 3. PREVENTIVO — l'azione vera, che esige lo studio completo. */
    const preventivo = await createQuote({
      opportunityId,
      siteStudyId: studio!.id,
      title: 'Impianto fotovoltaico 6 kW',
    })
    expect(preventivo.ok).toBe(true)
    if (!preventivo.ok) return
    const versionId = preventivo.data.versionId

    /* 4. RIGHE — margine 50%, ben sopra la soglia. */
    const righe = await saveQuoteLines({
      versionId,
      lockVersion: 0,
      globalDiscountPct: 0,
      righe: [
        {
          description: 'Impianto fotovoltaico chiavi in mano',
          unit: 'pz',
          quantity: 10,
          unitPrice: 1000,
          unitCost: 500,
          discountPct: 0,
          vatRate: 10,
        },
      ],
    })
    expect(righe.ok).toBe(true)
    if (!righe.ok) return
    expect(righe.data.sottoSoglia).toBe(false)

    /* 5. INVIO — sopra soglia, va davvero al cliente (niente approvazione). */
    const invio = await sendQuote(versionId)
    expect(invio.ok).toBe(true)
    if (!invio.ok) return
    expect(invio.data.inviato).toBe(true)

    /* 6. ACCETTAZIONE — il cliente dice sì. */
    const esito = await recordQuoteOutcome({ versionId, esito: 'accettato' })
    expect(esito.ok).toBe(true)

    /* 7. FIRMA — nasce il contratto e si apre il cantiere; il lead va a «vinto». */
    const firma = await signContractAndOpenProject({
      quoteVersionId: versionId,
      signedAt: new Date('2026-08-18T10:00:00Z'),
      signatureMethod: 'cartacea',
    })
    expect(firma.ok).toBe(true)
    if (!firma.ok) return
    const projectId = firma.data.projectId

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId))
    expect(opp!.stage).toBe('vinto')

    const [commessa] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(commessa!.revenueNet).toBe('10000.00')

    /* 8. FATTURA — bozza dalla prima scadenza del piano pagamenti, poi emissione
       con numero progressivo. */
    const [scadenza] = await db
      .select()
      .from(paymentMilestones)
      .where(eq(paymentMilestones.projectId, projectId))
      .orderBy(asc(paymentMilestones.sortOrder))
      .limit(1)
    expect(scadenza).toBeDefined()

    const bozza = await creaBozzaFattura(scadenza!.id)
    expect(bozza.ok).toBe(true)
    if (!bozza.ok) return

    const emissione = await emettiFattura(bozza.data.invoiceId)
    expect(emissione.ok).toBe(true)
    if (!emissione.ok) return
    // Numero fiscale progressivo: NNNN/AAAA.
    expect(emissione.data.displayNumber).toMatch(/^\d{4}\/\d{4}$/)

    const [fattura] = await db.select().from(invoices).where(eq(invoices.id, bozza.data.invoiceId))
    expect(fattura!.status).toBe('emessa')
    expect(fattura!.number).not.toBeNull()

    // La scadenza risulta fatturata: il ciclo del denaro si è chiuso.
    const [msFatturata] = await db
      .select()
      .from(paymentMilestones)
      .where(eq(paymentMilestones.id, scadenza!.id))
    expect(msFatturata!.invoicedAt).not.toBeNull()
  })
})
