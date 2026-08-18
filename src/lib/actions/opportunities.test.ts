import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activities,
  contacts,
  opportunities,
  opportunityStatusHistory,
  users,
} from '@/db/schema'
import { preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Creazione del lead e movimenti di pipeline, contro un PostgreSQL vero.
 *
 * Sono le due porte da cui entra ogni pratica: il lead nasce con la sua
 * anagrafica, la prima azione e lo storico in un colpo solo, e il dedup
 * **propone** un duplicato invece di fonderlo (US-02.2). Il cambio di stato ha
 * un invariante che vale soldi: «Contratto firmato» non si mette a mano, si
 * raggiunge solo firmando il preventivo.
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

const { createOpportunity, changeStage, updateLead } = await import('./opportunities')

describe('lead e pipeline', () => {
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

  let commercialeId: string

  beforeEach(async () => {
    await db.delete(opportunities)
    await db.delete(contacts)
    await db.delete(users)
    await preparaConfigurazione(db)

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
    utenteFinto.id = commercialeId
  })

  function inputLead(patch: Record<string, unknown> = {}) {
    return {
      firstName: 'Giulia',
      lastName: 'Bianchi',
      phone: '3331234567',
      businessLine: 'fotovoltaico' as const,
      title: 'Impianto 6 kW',
      ownerId: commercialeId,
      ...patch,
    }
  }

  describe('createOpportunity', () => {
    it('crea contatto, opportunità, prima azione e storico in una volta', async () => {
      const esito = await createOpportunity(inputLead())
      expect(esito.ok).toBe(true)
      if (!esito.ok || !('data' in esito)) return
      expect(esito.data.code).toMatch(/^OPP-\d{4}-0001$/)

      const [opp] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, esito.data.id))
      expect(opp!.stage).toBe('nuovo')

      // Il contatto è nato con l'opportunità.
      const contatti = await db.select().from(contacts)
      expect(contatti).toHaveLength(1)
      expect(contatti[0]!.lastName).toBe('Bianchi')

      // La prima azione è marcata come "prossima azione".
      const azioni = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.opportunityId, esito.data.id),
            eq(activities.isNextAction, true),
          ),
        )
      expect(azioni.length).toBeGreaterThanOrEqual(1)

      // Lo storico registra l'ingresso nello stato iniziale.
      const storico = await db
        .select()
        .from(opportunityStatusHistory)
        .where(eq(opportunityStatusHistory.opportunityId, esito.data.id))
      expect(storico.some((s) => s.toStage === 'nuovo')).toBe(true)
    })

    it('numera le opportunità in progressione', async () => {
      const primo = await createOpportunity(inputLead({ confermaNonDuplicato: true }))
      const secondo = await createOpportunity(
        inputLead({ phone: '3339998888', confermaNonDuplicato: true }),
      )
      expect(primo.ok && secondo.ok).toBe(true)
      if (!primo.ok || !secondo.ok) return
      expect(primo.data.code).toMatch(/-0001$/)
      expect(secondo.data.code).toMatch(/-0002$/)
    })

    it('propone il duplicato invece di crearne un secondo (stesso telefono)', async () => {
      const primo = await createOpportunity(inputLead())
      expect(primo.ok).toBe(true)

      // Stesso telefono, cognome diverso: il dedup lo segnala comunque.
      const secondo = await createOpportunity(
        inputLead({ firstName: 'Marco', lastName: 'Verdi' }),
      )
      expect(secondo.ok).toBe(false)
      if (secondo.ok) return
      expect('duplicati' in secondo && secondo.duplicati.length).toBeGreaterThan(0)

      // Non ha creato un secondo contatto.
      const contatti = await db.select().from(contacts)
      expect(contatti).toHaveLength(1)
    })

    it('con conferma esplicita crea comunque, duplicato o no', async () => {
      await createOpportunity(inputLead())
      const secondo = await createOpportunity(
        inputLead({ firstName: 'Marco', lastName: 'Verdi', confermaNonDuplicato: true }),
      )
      expect(secondo.ok).toBe(true)

      const contatti = await db.select().from(contacts)
      expect(contatti).toHaveLength(2)
    })

    it('rifiuta un responsabile che non è un commerciale attivo', async () => {
      const [ammin] = await db
        .insert(users)
        .values({
          email: 'ammin@prova.it',
          name: 'Ammin',
          role: 'amministratore',
          mustChangePassword: false,
        })
        .returning({ id: users.id })

      const esito = await createOpportunity(inputLead({ ownerId: ammin!.id }))
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect('errors' in esito && esito.errors.ownerId).toBeTruthy()
    })
  })

  describe('changeStage', () => {
    async function creaLead() {
      const esito = await createOpportunity(inputLead({ confermaNonDuplicato: true }))
      if (!esito.ok) throw new Error('setup lead fallito')
      return esito.data.id
    }

    it('non lascia mettere a mano lo stato «Contratto firmato»', async () => {
      const oppId = await creaLead()
      const esito = await changeStage({ opportunityId: oppId, toStage: 'vinto' })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors.toStage).toContain('firma')

      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId))
      expect(opp!.stage).toBe('nuovo')
    })

    it('esegue una transizione valida e ne scrive lo storico', async () => {
      const oppId = await creaLead()
      const esito = await changeStage({
        opportunityId: oppId,
        toStage: 'negoziazione',
        nextActionDueAt: new Date(Date.now() + 2 * 86_400_000),
      })
      expect(esito.ok).toBe(true)

      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId))
      expect(opp!.stage).toBe('negoziazione')

      const storico = await db
        .select()
        .from(opportunityStatusHistory)
        .where(eq(opportunityStatusHistory.opportunityId, oppId))
      expect(storico.some((s) => s.toStage === 'negoziazione')).toBe(true)
    })
  })

  describe('updateLead', () => {
    it('aggiorna l’anagrafica del lead senza toccare lo stato', async () => {
      const creato = await createOpportunity(inputLead({ confermaNonDuplicato: true }))
      if (!creato.ok) throw new Error('setup lead fallito')

      const esito = await updateLead({
        opportunityId: creato.data.id,
        firstName: 'Giulia',
        lastName: 'Bianchi',
        phone: '3331234567',
        email: 'giulia@esempio.it',
        businessLine: 'fotovoltaico',
        title: 'Impianto 6 kW aggiornato',
        ownerId: commercialeId,
      })
      expect(esito.ok).toBe(true)

      const [opp] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, creato.data.id))
      expect(opp!.title).toBe('Impianto 6 kW aggiornato')
      expect(opp!.stage).toBe('nuovo')

      const [contatto] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, opp!.contactId))
      expect(contatto!.email).toBe('giulia@esempio.it')
    })
  })
})
