import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contracts,
  paymentMilestones,
  paymentReceipts,
  projectStages,
  projects,
} from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Controllo amministrativo dei pagamenti, contro un PostgreSQL vero.
 *
 * Il nodo che questi test sorvegliano: l'OK amministrativo — il via libera al
 * cantiere — **si fonda sulla contabile del cliente**. Senza contabile non si
 * concede; e la contabile, una volta che l'OK è dato, non si butta finché l'OK
 * non è revocato (D-017: cestino, non cancellazione).
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'contabile@prova.it',
  name: 'Contabile Prova',
  role: 'contabilita' as const,
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
vi.mock('@/lib/readiness', () => ({ ricalcolaReadiness: async () => {} }))
vi.mock('@/lib/drive/avvia-outbox', () => ({ avviaSmaltimentoOutbox: () => {} }))
vi.mock('@/lib/auth/session', () => ({
  guard: async () => utenteFinto,
  requireUser: async () => utenteFinto,
  getCurrentUser: async () => utenteFinto,
}))

const { concediOkAmministrativo, revocaOkAmministrativo, deleteContabile } =
  await import('./banca')

describe('controllo amministrativo dei pagamenti', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let stageIniziale: string

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
    await preparaConfigurazione(db)
    const [stage] = await db.select().from(projectStages).limit(1)
    stageIniziale = stage!.code
  })

  /**
   * Costruisce la catena minima fino a una scadenza di pagamento:
   * preventivo → contratto → commessa → scadenza. Con `conContabile` aggiunge
   * anche una contabile non cestinata.
   */
  async function scenarioScadenza(
    suffisso: string,
    opzioni: { conContabile?: boolean } = {},
  ) {
    const p = await creaPreventivoFirmabile(db, { stato: 'accettato', suffisso })
    utenteFinto.id = p.userId

    const [contratto] = await db
      .insert(contracts)
      .values({
        code: `CON-2026-${suffisso}`,
        opportunityId: p.opportunityId,
        quoteVersionId: p.versionId,
        signedAt: new Date(),
        amountNet: '10000.00',
        createdBy: p.userId,
      })
      .returning({ id: contracts.id })

    const [commessa] = await db
      .insert(projects)
      .values({
        code: `CAN-2026-${suffisso}`,
        contractId: contratto!.id,
        contactId: p.contactId,
        businessLine: 'fotovoltaico',
        title: 'Cantiere di prova',
        stage: stageIniziale,
        ownerId: p.userId,
        revenueNet: '10000.00',
      })
      .returning({ id: projects.id })

    const [scadenza] = await db
      .insert(paymentMilestones)
      .values({
        projectId: commessa!.id,
        label: 'Acconto 30%',
        amountNet: '3000.00',
      })
      .returning({ id: paymentMilestones.id })

    let receiptId: string | undefined
    if (opzioni.conContabile) {
      const [ric] = await db
        .insert(paymentReceipts)
        .values({
          milestoneId: scadenza!.id,
          storageKey: `contabili/${commessa!.id}/prova.pdf`,
          filename: 'contabile.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
          uploadedBy: p.userId,
        })
        .returning({ id: paymentReceipts.id })
      receiptId = ric!.id
    }

    return { projectId: commessa!.id, milestoneId: scadenza!.id, receiptId }
  }

  describe('concediOkAmministrativo', () => {
    it('non concede l’OK se manca la contabile', async () => {
      const { milestoneId } = await scenarioScadenza('nok')

      const esito = await concediOkAmministrativo({ milestoneId })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors._).toContain('contabile')

      const [scadenza] = await db
        .select()
        .from(paymentMilestones)
        .where(eq(paymentMilestones.id, milestoneId))
      expect(scadenza!.adminOkAt).toBeNull()
    })

    it('concede l’OK quando la contabile c’è', async () => {
      const { milestoneId } = await scenarioScadenza('ok', { conContabile: true })

      const esito = await concediOkAmministrativo({ milestoneId, nota: 'Bonifico ricevuto' })
      expect(esito.ok).toBe(true)

      const [scadenza] = await db
        .select()
        .from(paymentMilestones)
        .where(eq(paymentMilestones.id, milestoneId))
      expect(scadenza!.adminOkAt).not.toBeNull()
      expect(scadenza!.adminOkBy).toBe(utenteFinto.id)
    })

    it('una contabile nel cestino non vale come contabile presente', async () => {
      const { milestoneId, receiptId } = await scenarioScadenza('cest', { conContabile: true })
      // Cestino la contabile prima di chiedere l'OK.
      await db
        .update(paymentReceipts)
        .set({ deletedAt: new Date() })
        .where(eq(paymentReceipts.id, receiptId!))

      const esito = await concediOkAmministrativo({ milestoneId })
      expect(esito.ok).toBe(false)
    })
  })

  describe('revocaOkAmministrativo', () => {
    it('azzera il via libera', async () => {
      const { milestoneId } = await scenarioScadenza('rev', { conContabile: true })
      await concediOkAmministrativo({ milestoneId })

      const esito = await revocaOkAmministrativo(milestoneId)
      expect(esito.ok).toBe(true)

      const [scadenza] = await db
        .select()
        .from(paymentMilestones)
        .where(eq(paymentMilestones.id, milestoneId))
      expect(scadenza!.adminOkAt).toBeNull()
    })
  })

  describe('deleteContabile', () => {
    it('cestina invece di cancellare: la riga resta, con deletedAt', async () => {
      const { receiptId } = await scenarioScadenza('del', { conContabile: true })

      const esito = await deleteContabile(receiptId!)
      expect(esito.ok).toBe(true)

      const [ric] = await db
        .select()
        .from(paymentReceipts)
        .where(eq(paymentReceipts.id, receiptId!))
      // La riga c'è ancora: è la prova di un incasso (D-017).
      expect(ric).toBeDefined()
      expect(ric!.deletedAt).not.toBeNull()
    })

    it('non si cestina la contabile finché l’OK amministrativo è attivo', async () => {
      const { milestoneId, receiptId } = await scenarioScadenza('del2', { conContabile: true })
      await concediOkAmministrativo({ milestoneId })

      const esito = await deleteContabile(receiptId!)
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors._).toContain('Revoca prima')

      const [ric] = await db
        .select()
        .from(paymentReceipts)
        .where(eq(paymentReceipts.id, receiptId!))
      expect(ric!.deletedAt).toBeNull()
    })
  })
})
