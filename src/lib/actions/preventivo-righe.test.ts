import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { approvals, appSettings, quoteLines, quoteVersions } from '@/db/schema'
import { creaPreventivoFirmabile, preparaConfigurazione } from '@/db/fixture'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Salvataggio righe e invio del preventivo, contro un PostgreSQL vero.
 *
 * Il caso che questo file esiste per sorvegliare è scritto nel commento di
 * `risolviCosto`: un commerciale senza `can_view_costs` non riceve i costi nel
 * browser, quindi non può rimandarli indietro. Se il server non li
 * ricostruisse, ogni suo salvataggio azzererebbe i costi e il margine
 * risulterebbe pari al fatturato — **un errore che sembra un ottimo
 * risultato**, e che nessuno andrebbe a cercare.
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'commerciale@prova.it',
  name: 'Commerciale Prova',
  role: 'commerciale' as const,
  canViewCosts: false,
  isFieldOnly: false,
  isActive: true,
  mustChangePassword: false,
  mfaAttiva: false,
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

const { saveQuoteLines, sendQuote } = await import('./quotes')

describe('righe e invio del preventivo', () => {
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
    await db.delete(approvals)
    await preparaConfigurazione(db)
    // Soglia esplicita: senza, il valore predefinito potrebbe cambiare e i
    // test comincerebbero a fallire per una ragione che non è loro.
    await db
      .insert(appSettings)
      .values({ key: 'preventivi.soglia_margine_pct', value: '20' })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: '20' } })
  })

  /**
   * `vedeCosti` cambia il significato di ciò che il browser manda: con la
   * capacità il costo inviato viene usato, senza viene ignorato e ricostruito.
   * È la differenza che questo file esiste per provare.
   */
  async function scenario(suffisso: string, vedeCosti = false) {
    const dati = await creaPreventivoFirmabile(db, { stato: 'bozza', suffisso })
    utenteFinto.id = dati.userId
    utenteFinto.canViewCosts = vedeCosti
    return dati
  }

  it('ricalcola i totali dal server, ignorando ciò che manda il browser', async () => {
    const dati = await scenario('a', true)

    const esito = await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        {
          description: 'Modulo fotovoltaico 450 W',
          unit: 'pz',
          quantity: 10,
          unitPrice: 150,
          unitCost: 90,
          discountPct: 0,
          vatRate: 10,
        },
      ],
    })

    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))

    expect(versione!.revenueNet).toBe('1500.00')
    expect(versione!.costTotal).toBe('900.00')
    expect(versione!.marginAmount).toBe('600.00')
    // 600 / 1500 = 40%
    expect(Number(versione!.marginPct)).toBeCloseTo(40, 1)
  })

  it('NON azzera i costi quando chi salva non può vederli', async () => {
    // Il cuore di questo file. L'utente è `canViewCosts: false`, quindi manda
    // le righe senza `unitCost`: il server deve recuperarlo dal catalogo.
    const dati = await scenario('b')
    const [modulo] = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteVersionId, dati.versionId))

    const esito = await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        {
          productId: modulo!.productId!,
          description: 'Modulo fotovoltaico 450 W',
          unit: 'pz',
          quantity: 10,
          unitPrice: 150,
          // unitCost assente: è esattamente ciò che manda un commerciale.
          discountPct: 0,
          vatRate: 10,
        },
      ],
    })

    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))

    // Costo dal catalogo: 92 €/pz × 10.
    expect(versione!.costTotal).toBe('920.00')
    expect(versione!.costTotal).not.toBe('0.00')
    // E quindi un margine credibile, non il 100%.
    expect(Number(versione!.marginPct)).toBeLessThan(50)
  })

  it('chi non vede i costi non può nemmeno iniettarli', async () => {
    // L'altra faccia della stessa regola: se il costo inviato da un
    // commerciale venisse accettato, basterebbe un browser modificato per far
    // sembrare buono qualunque preventivo.
    const dati = await scenario('b2')
    const [modulo] = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteVersionId, dati.versionId))

    await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        {
          productId: modulo!.productId!,
          description: 'Modulo fotovoltaico 450 W',
          unit: 'pz',
          quantity: 10,
          unitPrice: 150,
          // Costo ridicolo inviato di proposito: deve essere ignorato.
          unitCost: 1,
          discountPct: 0,
          vatRate: 10,
        },
      ],
    })

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))

    expect(versione!.costTotal).toBe('920.00')
    expect(versione!.costTotal).not.toBe('10.00')
  })

  it('applica lo sconto globale al netto', async () => {
    const dati = await scenario('c', true)

    await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 10,
      righe: [
        {
          description: 'Voce',
          unit: 'pz',
          quantity: 1,
          unitPrice: 1000,
          unitCost: 500,
          discountPct: 0,
          vatRate: 10,
        },
      ],
    })

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))
    expect(versione!.revenueNet).toBe('900.00')
  })

  it('sostituisce le righe invece di accumularle', async () => {
    const dati = await scenario('d')

    await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        { description: 'Unica', unit: 'pz', quantity: 1, unitPrice: 100, unitCost: 50, discountPct: 0, vatRate: 10 },
      ],
    })

    const righe = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteVersionId, dati.versionId))
    expect(righe).toHaveLength(1)
    expect(righe[0]!.description).toBe('Unica')
  })

  it('rifiuta il salvataggio su una versione già inviata', async () => {
    // Immutabilità economica (ADR-008): dopo l'invio si crea una versione nuova.
    const dati = await creaPreventivoFirmabile(db, { stato: 'inviato', suffisso: 'e' })
    utenteFinto.id = dati.userId

    const esito = await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        { description: 'Modifica', unit: 'pz', quantity: 1, unitPrice: 1, unitCost: 1, discountPct: 0, vatRate: 10 },
      ],
    })

    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.errors._).toContain('non è modificabile')
  })

  it('sotto soglia non invia: apre una richiesta di approvazione', async () => {
    const dati = await scenario('f', true)

    // Margine 10%, sotto la soglia del 20%.
    await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        { description: 'Voce', unit: 'pz', quantity: 1, unitPrice: 1000, unitCost: 900, discountPct: 0, vatRate: 10 },
      ],
    })

    const esito = await sendQuote(dati.versionId)
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.data.inviato).toBe(false)

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))
    expect(versione!.status).toBe('in_approvazione')

    const richieste = await db.select().from(approvals)
    expect(richieste).toHaveLength(1)
    expect(richieste[0]!.entityId).toBe(dati.versionId)
  })

  it('sopra soglia invia davvero', async () => {
    const dati = await scenario('g', true)

    await saveQuoteLines({
      versionId: dati.versionId,
      globalDiscountPct: 0,
      righe: [
        { description: 'Voce', unit: 'pz', quantity: 1, unitPrice: 1000, unitCost: 500, discountPct: 0, vatRate: 10 },
      ],
    })

    const esito = await sendQuote(dati.versionId)
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.data.inviato).toBe(true)

    const [versione] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, dati.versionId))
    expect(versione!.status).toBe('inviato')
    expect(await db.select().from(approvals)).toHaveLength(0)
  })

  it('non invia un preventivo senza righe', async () => {
    const dati = await scenario('h')

    await saveQuoteLines({ versionId: dati.versionId, globalDiscountPct: 0, righe: [] })
    const esito = await sendQuote(dati.versionId)

    expect(esito.ok).toBe(false)
  })
})
