import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { approvals, quoteLines, quoteVersions, quotes, users } from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Il resto del ciclo di vita del preventivo, oltre al salvataggio righe
 * (coperto da `preventivo-righe.test.ts`): nuova versione, esito del cliente,
 * eliminazione e — il passaggio delicato — l'approvazione del sotto soglia.
 *
 * Sono le server action che spostano stato e, con esso, la possibilità di
 * firmare un contratto: le prove stanno contro un PostgreSQL vero (PGlite),
 * non su mock, perché è nella transazione che i difetti si nascondono.
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

const { newQuoteVersion, recordQuoteOutcome, deleteQuote, decideApproval } =
  await import('./quotes')

describe('ciclo di vita del preventivo', () => {
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
    await preparaConfigurazione(db)
  })

  describe('newQuoteVersion', () => {
    it('crea la versione successiva in bozza, copiando righe e totali', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'nv' })
      utenteFinto.id = dati.userId

      const esito = await newQuoteVersion(dati.quoteId)
      expect(esito.ok).toBe(true)
      if (!esito.ok) return
      expect(esito.data.versionNo).toBe(2)

      const [nuova] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, esito.data.versionId))
      // Nasce modificabile: è il senso di fare una nuova versione.
      expect(nuova!.status).toBe('bozza')
      // I totali si ereditano finché le righe non cambiano.
      expect(nuova!.revenueNet).toBe('10000.00')
      expect(nuova!.marginAmount).toBe('4000.00')

      const righe = await db
        .select()
        .from(quoteLines)
        .where(eq(quoteLines.quoteVersionId, esito.data.versionId))
      expect(righe).toHaveLength(2)

      // La corrente del preventivo punta ora alla nuova versione.
      const [preventivo] = await db.select().from(quotes).where(eq(quotes.id, dati.quoteId))
      expect(preventivo!.currentVersionId).toBe(esito.data.versionId)

      // La versione inviata resta intatta: immutabilità (ADR-008).
      const [vecchia] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(vecchia!.status).toBe('inviato')
    })
  })

  describe('recordQuoteOutcome', () => {
    it('registra l’accettazione di una versione inviata', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'ok' })
      utenteFinto.id = dati.userId

      const esito = await recordQuoteOutcome({ versionId: dati.versionId, esito: 'accettato' })
      expect(esito.ok).toBe(true)

      const [versione] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(versione!.status).toBe('accettato')
      expect(versione!.decidedAt).not.toBeNull()
    })

    it('rifiuta senza motivo non è ammesso', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'ko1' })
      utenteFinto.id = dati.userId

      const esito = await recordQuoteOutcome({ versionId: dati.versionId, esito: 'rifiutato' })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      // Il motivo è obbligatorio: senza, non si capisce dove si perde.
      expect(esito.errors.motivoRifiuto).toBeTruthy()

      const [versione] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(versione!.status).toBe('inviato')
    })

    it('registra il rifiuto con il suo motivo', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'ko2' })
      utenteFinto.id = dati.userId

      const esito = await recordQuoteOutcome({
        versionId: dati.versionId,
        esito: 'rifiutato',
        motivoRifiuto: 'Prezzo troppo alto rispetto a un concorrente',
      })
      expect(esito.ok).toBe(true)

      const [versione] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(versione!.status).toBe('rifiutato')
      expect(versione!.rejectionReason).toContain('concorrente')
    })

    it('non si registra un esito su una bozza mai inviata', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'bozza', suffisso: 'ko3' })
      utenteFinto.id = dati.userId

      const esito = await recordQuoteOutcome({ versionId: dati.versionId, esito: 'accettato' })
      expect(esito.ok).toBe(false)
    })
  })

  describe('deleteQuote', () => {
    it('elimina un preventivo mai inviato', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'bozza', suffisso: 'del' })
      utenteFinto.id = dati.userId

      const esito = await deleteQuote(dati.quoteId)
      expect(esito.ok).toBe(true)
      if (!esito.ok) return
      expect(esito.data.opportunityId).toBe(dati.opportunityId)

      const rimasti = await db.select().from(quotes).where(eq(quotes.id, dati.quoteId))
      expect(rimasti).toHaveLength(0)
    })

    it('non elimina un preventivo già inviato al cliente (ADR-008)', async () => {
      const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'del2' })
      // La fixture non valorizza sentAt: lo mettiamo, è ciò che il metodo guarda.
      await db
        .update(quoteVersions)
        .set({ sentAt: new Date() })
        .where(eq(quoteVersions.id, dati.versionId))
      utenteFinto.id = dati.userId

      const esito = await deleteQuote(dati.quoteId)
      expect(esito.ok).toBe(false)

      const rimasti = await db.select().from(quotes).where(eq(quotes.id, dati.quoteId))
      expect(rimasti).toHaveLength(1)
    })
  })

  describe('decideApproval', () => {
    /**
     * Prepara una richiesta di approvazione su una versione in approvazione,
     * chiesta da un secondo utente (il commerciale), così l'amministratore che
     * decide è una persona diversa — il senso del passaggio.
     */
    async function conRichiesta(suffisso: string) {
      const dati = await creaPreventivoFirmabile(db, { stato: 'bozza', suffisso })
      await db
        .update(quoteVersions)
        .set({ status: 'in_approvazione' })
        .where(eq(quoteVersions.id, dati.versionId))

      const [richiedente] = await db
        .insert(users)
        .values({
          email: `commerciale-${suffisso}@prova.it`,
          name: 'Commerciale Prova',
          role: 'commerciale',
          canViewCosts: false,
          mustChangePassword: false,
        })
        .returning({ id: users.id })

      const [richiesta] = await db
        .insert(approvals)
        .values({
          entityType: 'quote_version',
          entityId: dati.versionId,
          reason: 'Margine sotto la soglia minima',
          requestedBy: richiedente!.id,
        })
        .returning({ id: approvals.id })

      return { dati, richiedenteId: richiedente!.id, approvalId: richiesta!.id }
    }

    it('approva: la versione diventa approvata e la richiesta è decisa', async () => {
      const { dati, approvalId } = await conRichiesta('app')
      // L'amministratore che decide è diverso dal richiedente.
      utenteFinto.id = dati.userId

      const esito = await decideApproval({ approvalId, approva: true })
      expect(esito.ok).toBe(true)

      const [richiesta] = await db.select().from(approvals).where(eq(approvals.id, approvalId))
      expect(richiesta!.status).toBe('approvata')

      const [versione] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(versione!.status).toBe('approvato')
    })

    it('respinge: la versione torna in bozza per rivedere i numeri', async () => {
      const { dati, approvalId } = await conRichiesta('resp')
      utenteFinto.id = dati.userId

      const esito = await decideApproval({ approvalId, approva: false, nota: 'Margine troppo basso' })
      expect(esito.ok).toBe(true)

      const [richiesta] = await db.select().from(approvals).where(eq(approvals.id, approvalId))
      expect(richiesta!.status).toBe('respinta')

      const [versione] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, dati.versionId))
      expect(versione!.status).toBe('bozza')
    })

    it('chi ha chiesto l’approvazione non può concedersela da solo', async () => {
      const { richiedenteId, approvalId } = await conRichiesta('self')
      // Stavolta a decidere è lo stesso utente che ha chiesto.
      utenteFinto.id = richiedenteId

      const esito = await decideApproval({ approvalId, approva: true })
      expect(esito.ok).toBe(false)
      if (esito.ok) return
      expect(esito.errors._).toContain('presentato tu')

      // Nulla è cambiato: la richiesta resta da decidere.
      const [richiesta] = await db.select().from(approvals).where(eq(approvals.id, approvalId))
      expect(richiesta!.status).toBe('richiesta')
    })

    it('una richiesta già decisa non si decide una seconda volta', async () => {
      const { dati, approvalId } = await conRichiesta('due')
      utenteFinto.id = dati.userId

      const primo = await decideApproval({ approvalId, approva: true })
      expect(primo.ok).toBe(true)

      const secondo = await decideApproval({ approvalId, approva: false })
      expect(secondo.ok).toBe(false)
      if (secondo.ok) return
      expect(secondo.errors._).toContain('già decisa')
    })
  })
})
