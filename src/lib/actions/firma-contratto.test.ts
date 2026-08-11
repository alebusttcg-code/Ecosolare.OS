import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contracts,
  documentRequirements,
  opportunities,
  outboxEvents,
  paymentMilestones,
  projectMaterials,
  projectTasks,
  projects,
  quoteVersions,
} from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * La firma del contratto, contro un PostgreSQL vero.
 *
 * È l'operazione più densa del sistema: in una sola transazione nascono il
 * contratto, la commessa, la distinta materiali, i requisiti documentali, le
 * pratiche, i task e il piano pagamenti, e l'opportunità passa a «vinto».
 * Se qualcosa qui va storto, va storto sui soldi — ed era l'unico pezzo di
 * questa dimensione senza un solo test.
 *
 * Le dipendenze da Next e dalla sessione sono sostituite; il database no.
 * Provare questa funzione con un finto database proverebbe soltanto il finto.
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'responsabile@prova.it',
  name: 'Responsabile Prova',
  role: 'amministratore' as const,
  canViewCosts: true,
  isFieldOnly: false,
  isActive: true,
  mustChangePassword: false,
  mfaAttiva: true,
}

const contenitore: { db?: TestDatabase } = {}

vi.mock('@/db', async () => {
  const reale = await vi.importActual<typeof import('@/db')>('@/db')
  return { ...reale, getDb: () => contenitore.db }
})

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

// `after()` di Next esiste solo dentro una richiesta: fuori solleva.
vi.mock('@/lib/drive/avvia-outbox', () => ({ avviaSmaltimentoOutbox: () => {} }))

vi.mock('@/lib/auth/session', () => ({
  guard: async () => utenteFinto,
  requireUser: async () => utenteFinto,
  getCurrentUser: async () => utenteFinto,
}))

const { signContractAndOpenProject } = await import('./projects')

describe('firma del contratto', () => {
  let db: TestDatabase
  let close: () => Promise<void>

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    contenitore.db = db
  })

  afterAll(async () => {
    await close()
  })

  beforeEach(async () => {
    // Ordine inverso alle dipendenze: le chiavi esterne non perdonano.
    await db.delete(outboxEvents)
    await db.delete(projects)
    await db.delete(contracts)
    await preparaConfigurazione(db)
  })

  /** L'azione legge l'utente da `guard`, quindi deve esistere davvero. */
  async function scenario(opzioni: Parameters<typeof creaPreventivoFirmabile>[1] = {}) {
    const dati = await creaPreventivoFirmabile(db, opzioni)
    utenteFinto.id = dati.userId
    return dati
  }

  it('crea contratto, commessa e storico in un colpo solo', async () => {
    const dati = await scenario({ suffisso: 'a' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01T10:00:00Z'),
      signatureMethod: 'cartacea',
    })

    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const [commessa] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, esito.data.projectId))

    expect(commessa!.code).toMatch(/^COM-\d{4}-\d{4}$/)
    expect(commessa!.stage).toBe('contratto_ricevuto')
    expect(commessa!.contactId).toBe(dati.contactId)

    const [contratto] = await db.select().from(contracts)
    expect(contratto!.code).toMatch(/^CTR-\d{4}-\d{4}$/)
    expect(contratto!.quoteVersionId).toBe(dati.versionId)
  })

  it('congela i valori economici del preventivo', async () => {
    // Sono il termine di paragone del consuntivo: se cambiassero con il
    // preventivo, lo scostamento non significherebbe più niente (ADR-008).
    const dati = await scenario({ suffisso: 'b' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const [commessa] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, esito.data.projectId))

    expect(commessa!.revenueNet).toBe('10000.00')
    expect(commessa!.estimatedCost).toBe('6000.00')
    expect(commessa!.estimatedMargin).toBe('4000.00')
  })

  it('porta in distinta i materiali e lascia fuori la manodopera', async () => {
    // La manodopera non si ordina: in distinta sarebbe una riga che nessuno
    // può smarcare, e la commessa resterebbe non pianificabile per sempre.
    const dati = await scenario({ suffisso: 'c' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const materiali = await db
      .select()
      .from(projectMaterials)
      .where(eq(projectMaterials.projectId, esito.data.projectId))

    expect(materiali).toHaveLength(1)
    expect(materiali[0]!.description).toContain('Modulo')
    expect(materiali[0]!.estimatedUnitCost).toBe('92.0000')
  })

  it('genera requisiti documentali, task e piano pagamenti', async () => {
    const dati = await scenario({ suffisso: 'd' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const [documenti, task, pagamenti] = [
      await db
        .select()
        .from(documentRequirements)
        .where(eq(documentRequirements.projectId, esito.data.projectId)),
      await db
        .select()
        .from(projectTasks)
        .where(eq(projectTasks.projectId, esito.data.projectId)),
      await db
        .select()
        .from(paymentMilestones)
        .where(eq(paymentMilestones.projectId, esito.data.projectId)),
    ]

    expect(documenti.length).toBeGreaterThan(0)
    expect(task.length).toBeGreaterThan(0)

    // Il piano pagamenti deve coprire l'intero imponibile: se le percentuali
    // non fanno cento, manca un incasso che nessuno andrà mai a cercare.
    const totale = pagamenti.reduce((somma, p) => somma + Number(p.amountNet), 0)
    expect(totale).toBeCloseTo(10000, 2)
  })

  it('porta l’opportunità a «vinto» e accetta la versione firmata', async () => {
    const dati = await scenario({ suffisso: 'e' })

    await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })

    const [opportunita] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, dati.opportunityId))
    expect(opportunita!.stage).toBe('vinto')
    expect(opportunita!.closedAt).not.toBeNull()
    expect(opportunita!.nextActionDueAt).toBeNull()

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))
    expect(versione!.status).toBe('accettato')
  })

  it('accoda la cartella su Drive nella stessa transazione', async () => {
    // È il punto dell'ADR-005: o esistono la commessa e l'intenzione di creare
    // la cartella, o nessuna delle due.
    const dati = await scenario({ suffisso: 'f' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const eventi = await db.select().from(outboxEvents)
    expect(eventi).toHaveLength(1)
    expect(eventi[0]!.type).toBe('drive.cartella_cliente')
    expect(eventi[0]!.payload).toEqual({ projectId: esito.data.projectId })
  })

  it('rifiuta una versione ancora in bozza', async () => {
    // Si firma ciò che il cliente ha ricevuto, non una bozza interna.
    const dati = await scenario({ suffisso: 'g', stato: 'bozza' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })

    expect(esito.ok).toBe(false)
    expect(await db.select().from(projects)).toHaveLength(0)
    expect(await db.select().from(contracts)).toHaveLength(0)
  })

  it('non genera due contratti dalla stessa versione', async () => {
    // Doppio clic, ritentativo di rete, due persone sullo stesso preventivo:
    // il secondo tentativo deve fallire, non creare una seconda commessa.
    const dati = await scenario({ suffisso: 'h' })

    const primo = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    const secondo = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })

    expect(primo.ok).toBe(true)
    expect(secondo.ok).toBe(false)
    expect(await db.select().from(projects)).toHaveLength(1)
  })

  it('rifiuta una versione inesistente senza lasciare tracce', async () => {
    await scenario({ suffisso: 'i' })

    const esito = await signContractAndOpenProject({
      quoteVersionId: '11111111-1111-1111-1111-111111111111',
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })

    expect(esito.ok).toBe(false)
    expect(await db.select().from(contracts)).toHaveLength(0)
  })

  it('numera contratti e commesse in progressione', async () => {
    const primo = await scenario({ suffisso: 'l' })
    const secondo = await scenario({ suffisso: 'm' })

    const a = await signContractAndOpenProject({
      quoteVersionId: primo.versionId,
      signedAt: new Date('2026-08-01'),
      signatureMethod: 'cartacea',
    })
    const b = await signContractAndOpenProject({
      quoteVersionId: secondo.versionId,
      signedAt: new Date('2026-08-02'),
      signatureMethod: 'cartacea',
    })

    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const codici = (await db.select({ code: projects.code }).from(projects)).map((p) => p.code)
    expect(new Set(codici).size).toBe(2)
    expect(a.data.projectCode).not.toBe(b.data.projectCode)
  })
})
