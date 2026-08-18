import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contracts,
  projectStages,
  projects,
  users,
  workOrderAssignments,
  workOrders,
  workers,
} from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Operativo di campo (Fase 4): anagrafica operai e pianificazione del cantiere,
 * contro un PostgreSQL vero.
 *
 * Gli invarianti che contano: non si pianifica una commessa non ancora
 * pianificabile (documenti, materiali e via libera devono esserci), non si
 * assegnano operai disattivati, e non si crea una seconda pianificazione se ce
 * n'è già una attiva.
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
vi.mock('@/lib/auth/session', () => ({
  guard: async () => utenteFinto,
  requireUser: async () => utenteFinto,
  getCurrentUser: async () => utenteFinto,
}))

const {
  creaOperaio,
  aggiornaOperaio,
  disattivaOperaio,
  riattivaOperaio,
  pianificaCantiere,
} = await import('./schedule')

describe('operai e pianificazione cantiere', () => {
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

    // Un utente reale per il `created_by` di operai e work order: la FK lo esige.
    const [base] = await db
      .insert(users)
      .values({
        email: `admin-${Date.now()}-${Math.random()}@prova.it`,
        name: 'Admin Prova',
        role: 'amministratore',
        mustChangePassword: false,
      })
      .returning({ id: users.id })
    utenteFinto.id = base!.id
  })

  async function nuovoOperaio(suffisso: string) {
    const esito = await creaOperaio({ firstName: 'Luca', lastName: `Operaio ${suffisso}` })
    if (!esito.ok) throw new Error('creazione operaio fallita')
    return esito.data.id
  }

  /** Commessa pronta alla pianificazione (readiness pianificabile). */
  async function commessaPianificabile(suffisso: string, pianificabile = true) {
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
        readinessState: pianificabile ? 'pianificabile' : 'non_pianificabile',
      })
      .returning({ id: projects.id })

    return commessa!.id
  }

  describe('anagrafica operai', () => {
    it('crea un operaio attivo', async () => {
      const id = await nuovoOperaio('a')
      const [op] = await db.select().from(workers).where(eq(workers.id, id))
      expect(op!.isActive).toBe(true)
      expect(op!.lastName).toBe('Operaio a')
    })

    it('disattiva e riattiva', async () => {
      const id = await nuovoOperaio('b')

      expect((await disattivaOperaio({ id })).ok).toBe(true)
      let [op] = await db.select().from(workers).where(eq(workers.id, id))
      expect(op!.isActive).toBe(false)

      expect((await riattivaOperaio({ id })).ok).toBe(true)
      ;[op] = await db.select().from(workers).where(eq(workers.id, id))
      expect(op!.isActive).toBe(true)
    })

    it('aggiorna nome e cognome', async () => {
      const id = await nuovoOperaio('c')
      const esito = await aggiornaOperaio({ id, firstName: 'Marco', lastName: 'Bianchi' })
      expect(esito.ok).toBe(true)

      const [op] = await db.select().from(workers).where(eq(workers.id, id))
      expect(op!.firstName).toBe('Marco')
      expect(op!.lastName).toBe('Bianchi')
    })
  })

  describe('pianificaCantiere', () => {
    it('pianifica: crea il work order con la squadra e avanza lo stato', async () => {
      const operaioId = await nuovoOperaio('p1')
      const projectId = await commessaPianificabile('p1')

      const esito = await pianificaCantiere({
        projectId,
        scheduledOn: '2026-09-01',
        workerIds: [operaioId],
      })
      expect(esito.ok).toBe(true)
      if (!esito.ok) return

      const [wo] = await db
        .select()
        .from(workOrders)
        .where(eq(workOrders.id, esito.data.workOrderId))
      expect(wo!.status).toBe('pianificato')

      const assegnazioni = await db
        .select()
        .from(workOrderAssignments)
        .where(eq(workOrderAssignments.workOrderId, esito.data.workOrderId))
      expect(assegnazioni).toHaveLength(1)

      // La data del cantiere è finita sulla commessa.
      const [commessa] = await db.select().from(projects).where(eq(projects.id, projectId))
      expect(commessa!.plannedStartAt).not.toBeNull()
    })

    it('non pianifica una commessa non ancora pianificabile', async () => {
      const operaioId = await nuovoOperaio('p2')
      const projectId = await commessaPianificabile('p2', false)

      const esito = await pianificaCantiere({
        projectId,
        scheduledOn: '2026-09-01',
        workerIds: [operaioId],
      })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors._).toContain('pianificabile')

      const wo = await db.select().from(workOrders).where(eq(workOrders.projectId, projectId))
      expect(wo).toHaveLength(0)
    })

    it('non assegna operai disattivati', async () => {
      const operaioId = await nuovoOperaio('p3')
      await disattivaOperaio({ id: operaioId })
      const projectId = await commessaPianificabile('p3')

      const esito = await pianificaCantiere({
        projectId,
        scheduledOn: '2026-09-01',
        workerIds: [operaioId],
      })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors.workerIds).toContain('disattivati')
    })

    it('non crea una seconda pianificazione se ce n’è già una attiva', async () => {
      const operaioId = await nuovoOperaio('p4')
      const projectId = await commessaPianificabile('p4')

      const primo = await pianificaCantiere({
        projectId,
        scheduledOn: '2026-09-01',
        workerIds: [operaioId],
      })
      expect(primo.ok).toBe(true)

      const secondo = await pianificaCantiere({
        projectId,
        scheduledOn: '2026-09-08',
        workerIds: [operaioId],
      })
      expect(secondo.ok).toBe(false)
      if (secondo.ok) return
      expect(secondo.errors._).toContain('ripianifica')
    })
  })
})
