import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { products, users } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * I dati tecnici del catalogo, contro un PostgreSQL vero.
 *
 * Le colonne esistono dalla migrazione 0021 e fino a oggi nessuno poteva
 * compilarle: su ogni prodotto in archivio erano tutte nulle, e il preventivo
 * girava sui ripieghi che leggono la descrizione. Questi test sorvegliano che
 * il valore scritto qui arrivi davvero nella colonna che i calcoli leggono.
 */

const utenteFinto = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'amministratore@prova.it',
  name: 'Amministratore Prova',
  role: 'amministratore' as const,
  canViewCosts: true,
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
vi.mock('@/lib/auth/session', () => ({
  guard: async () => utenteFinto,
  requireUser: async () => utenteFinto,
  getCurrentUser: async () => utenteFinto,
}))

const { aggiornaDatiTecniciProdotto } = await import('./catalogo')

function modulo(campi: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [chiave, valore] of Object.entries(campi)) formData.set(chiave, valore)
  return formData
}

describe('dati tecnici del catalogo', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let productId: string

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    contenitore.db = db
    await db.insert(users).values({
      id: utenteFinto.id,
      email: utenteFinto.email,
      name: utenteFinto.name,
      role: utenteFinto.role,
      mustChangePassword: false,
    })
  })

  afterAll(async () => {
    await close()
  })

  beforeEach(async () => {
    await db.delete(products)
    const [prodotto] = await db
      .insert(products)
      .values({ code: 'PDC-8', name: 'Pompa di calore 8 kW', type: 'materiale', unit: 'pz' })
      .returning({ id: products.id })
    productId = prodotto!.id
  })

  const leggi = async () =>
    db.query.products.findFirst({ where: eq(products.id, productId) })

  it('salva ruolo, marca e SCOP dove i calcoli li cercano', async () => {
    const esito = await aggiornaDatiTecniciProdotto(
      modulo({
        productId,
        componentRole: 'pompa_calore',
        brand: 'Viessmann',
        model: 'Vitocal 250-A',
        ratedPowerW: '',
        acPowerKw: '',
        capacityKwh: '',
        scop: '4,2',
      }),
    )

    expect(esito.ok).toBe(true)
    const salvato = await leggi()
    expect(salvato?.componentRole).toBe('pompa_calore')
    expect(salvato?.brand).toBe('Viessmann')
    // I numerici di Postgres tornano come stringhe: 4,2 → «4.20».
    expect(Number(salvato?.scop)).toBe(4.2)
  })

  it('accetta la virgola, che è come si scrivono i decimali qui', async () => {
    await aggiornaDatiTecniciProdotto(
      modulo({
        productId,
        componentRole: 'accumulo',
        brand: '',
        model: '',
        ratedPowerW: '',
        acPowerKw: '',
        capacityKwh: '10,5',
        scop: '',
      }),
    )
    expect(Number((await leggi())?.capacityKwh)).toBe(10.5)
  })

  it('un campo vuoto azzera invece di lasciare il valore vecchio', async () => {
    // Se svuotare non cancellasse, un dato sbagliato resterebbe per sempre.
    await aggiornaDatiTecniciProdotto(
      modulo({
        productId, componentRole: 'pompa_calore', brand: 'X', model: '',
        ratedPowerW: '', acPowerKw: '', capacityKwh: '', scop: '4',
      }),
    )
    await aggiornaDatiTecniciProdotto(
      modulo({
        productId, componentRole: 'pompa_calore', brand: '', model: '',
        ratedPowerW: '', acPowerKw: '', capacityKwh: '', scop: '',
      }),
    )
    const salvato = await leggi()
    expect(salvato?.brand).toBeNull()
    expect(salvato?.scop).toBeNull()
  })

  it('rifiuta uno SCOP che non esiste', async () => {
    const troppo = await aggiornaDatiTecniciProdotto(
      modulo({
        productId, componentRole: 'pompa_calore', brand: '', model: '',
        ratedPowerW: '', acPowerKw: '', capacityKwh: '', scop: '12',
      }),
    )
    expect(troppo.ok).toBe(false)

    const troppoPoco = await aggiornaDatiTecniciProdotto(
      modulo({
        productId, componentRole: 'pompa_calore', brand: '', model: '',
        ratedPowerW: '', acPowerKw: '', capacityKwh: '', scop: '0,4',
      }),
    )
    expect(troppoPoco.ok).toBe(false)
  })

  it('rifiuta un numero che non è un numero', async () => {
    const esito = await aggiornaDatiTecniciProdotto(
      modulo({
        productId, componentRole: 'modulo', brand: '', model: '',
        ratedPowerW: 'cinquecento', acPowerKw: '', capacityKwh: '', scop: '',
      }),
    )
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.errors.ratedPowerW).toBeDefined()
  })

  it('non scrive su un prodotto che non esiste', async () => {
    const esito = await aggiornaDatiTecniciProdotto(
      modulo({
        productId: '11111111-1111-1111-1111-111111111111',
        componentRole: 'modulo', brand: '', model: '',
        ratedPowerW: '', acPowerKw: '', capacityKwh: '', scop: '',
      }),
    )
    expect(esito.ok).toBe(false)
  })
})
