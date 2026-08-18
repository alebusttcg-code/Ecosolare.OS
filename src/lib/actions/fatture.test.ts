import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { contacts, invoices, paymentMilestones, users } from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Le server action della fatturazione contro un PostgreSQL vero.
 *
 * Le proprietà che contano — numerazione gapless, immutabilità della fattura
 * emessa, storno come nota di credito — dipendono da transazioni e vincoli: un
 * finto database proverebbe soltanto il finto. Le dipendenze da Next e dalla
 * sessione sono sostituite; il database no.
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'fatture@prova.it',
  name: 'Amministratore',
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

const { signContractAndOpenProject } = await import('./projects')
const { creaBozzaFattura, emettiFattura, stornaFattura } = await import('./fatture')

describe('fatture — server action', () => {
  let db: TestDatabase
  let close: () => Promise<void>

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
  })

  afterAll(async () => {
    await close()
  })

  /** Una commessa firmata con la sua prima milestone, opzionalmente con CF sul cliente. */
  async function commessaConMilestone(suffisso: string, conCodiceFiscale: boolean) {
    const dati = await creaPreventivoFirmabile(db, { stato: 'accettato', suffisso })
    if (conCodiceFiscale) {
      await db
        .update(contacts)
        .set({ taxCode: 'RSSMRA80A01H501U' })
        .where(eq(contacts.id, dati.contactId))
    }
    const esito = await signContractAndOpenProject({
      quoteVersionId: dati.versionId,
      signedAt: new Date('2026-08-01T10:00:00Z'),
      signatureMethod: 'cartacea',
    })
    if (!esito.ok) throw new Error('firma fallita nel setup')
    const [ms] = await db
      .select()
      .from(paymentMilestones)
      .where(eq(paymentMilestones.projectId, esito.data.projectId))
      .orderBy(asc(paymentMilestones.sortOrder))
      .limit(1)
    return { milestoneId: ms!.id, projectId: esito.data.projectId }
  }

  it('crea una bozza dall’importo della milestone, senza numero', async () => {
    const { milestoneId } = await commessaConMilestone('f1', true)
    const r = await creaBozzaFattura(milestoneId)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, r.data.invoiceId))
    expect(inv!.status).toBe('bozza')
    expect(inv!.number).toBeNull()
    const imponibile = Number.parseFloat(inv!.imponibile)
    expect(imponibile).toBeGreaterThan(0)
    // Totale = imponibile + 10% IVA.
    expect(Number.parseFloat(inv!.totale)).toBeCloseTo(imponibile * 1.1, 1)
  })

  it('senza codice fiscale né P.IVA la fattura non si emette', async () => {
    const { milestoneId } = await commessaConMilestone('f2', false)
    const b = await creaBozzaFattura(milestoneId)
    if (!b.ok) throw new Error('bozza non creata')
    const e = await emettiFattura(b.data.invoiceId)
    expect(e.ok).toBe(false)
  })

  it('emette con numero, congela e valorizza la milestone; non si riemette', async () => {
    const { milestoneId } = await commessaConMilestone('f3', true)
    const b = await creaBozzaFattura(milestoneId)
    if (!b.ok) throw new Error('bozza non creata')

    const e = await emettiFattura(b.data.invoiceId)
    expect(e.ok).toBe(true)
    if (!e.ok) return
    expect(e.data.displayNumber).toMatch(/^\d{4}\/\d{4}$/)

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, b.data.invoiceId))
    expect(inv!.status).toBe('emessa')
    expect(inv!.number).not.toBeNull()

    const [ms] = await db
      .select()
      .from(paymentMilestones)
      .where(eq(paymentMilestones.id, milestoneId))
    expect(ms!.invoicedAt).not.toBeNull()

    // Immutabilità: una fattura emessa non si riemette.
    const rie = await emettiFattura(b.data.invoiceId)
    expect(rie.ok).toBe(false)
  })

  it('storna con una nota di credito in negativo; l’originale passa a stornata', async () => {
    const { milestoneId } = await commessaConMilestone('f4', true)
    const b = await creaBozzaFattura(milestoneId)
    if (!b.ok) throw new Error('bozza non creata')
    const e = await emettiFattura(b.data.invoiceId)
    if (!e.ok) throw new Error('emissione fallita')

    const s = await stornaFattura(b.data.invoiceId)
    expect(s.ok).toBe(true)
    if (!s.ok) return

    const [nota] = await db.select().from(invoices).where(eq(invoices.id, s.data.notaId))
    expect(nota!.type).toBe('nota_credito')
    expect(nota!.correggeInvoiceId).toBe(b.data.invoiceId)
    expect(Number.parseFloat(nota!.totale)).toBeLessThan(0)

    const [orig] = await db.select().from(invoices).where(eq(invoices.id, b.data.invoiceId))
    expect(orig!.status).toBe('stornata')
  })
})
