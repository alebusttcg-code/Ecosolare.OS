import { PDFDocument } from 'pdf-lib'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { productDocuments, products, users } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

/**
 * Il caricamento delle schede tecniche, contro un PostgreSQL vero.
 *
 * Quello che questo file sorveglia è il momento in cui l'errore diventa
 * costoso: un PDF illeggibile o una selezione di pagine sbagliata non fanno
 * rumore al caricamento, fanno rumore mesi dopo, quando il preventivo non esce
 * mentre il cliente è al telefono — o peggio, quando esce con la pagina
 * sbagliata allegata e nessuno lo nota.
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
}

const contenitore: { db?: TestDatabase } = {}
const archiviati = new Map<string, Uint8Array>()

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
vi.mock('@/lib/storage', () => ({
  getArchivio: () => ({
    async salva({ contenuto }: { contenuto: Uint8Array }) {
      const chiave = `prova/${archiviati.size + 1}.pdf`
      archiviati.set(chiave, contenuto)
      return { chiave, dimensione: contenuto.byteLength, checksum: 'finto' }
    },
    async leggi(chiave: string) {
      return archiviati.get(chiave) ?? null
    },
    async elimina(chiave: string) {
      archiviati.delete(chiave)
    },
  }),
}))

const { caricaSchedaTecnica, ripristinaSchedaTecnica, ritiraSchedaTecnica } = await import(
  './schede-tecniche'
)

async function pdfDiProva(pagine: number): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  for (let indice = 0; indice < pagine; indice += 1) documento.addPage([595, 842])
  return documento.save()
}

function modulo(campi: Record<string, string>, file?: File): FormData {
  const formData = new FormData()
  for (const [chiave, valore] of Object.entries(campi)) formData.set(chiave, valore)
  if (file) formData.set('file', file)
  return formData
}

async function fileDiProva(pagine: number, nome = 'scheda.pdf'): Promise<File> {
  const bytes = await pdfDiProva(pagine)
  return new File([Buffer.from(bytes)], nome, { type: 'application/pdf' })
}

describe('schede tecniche di prodotto', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let productId: string

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    contenitore.db = db

    // `created_by` è una chiave esterna vera: l'utente finto della sessione
    // deve esistere anche nella tabella, o l'inserimento non arriva in fondo.
    await db.insert(users).values({
      id: utenteFinto.id,
      email: utenteFinto.email,
      name: utenteFinto.name,
      role: utenteFinto.role,
      canViewCosts: true,
      mustChangePassword: false,
    })
  })

  afterAll(async () => {
    await close()
  })

  beforeEach(async () => {
    archiviati.clear()
    await db.delete(productDocuments)
    await db.delete(products)
    const [prodotto] = await db
      .insert(products)
      .values({
        code: 'MOD-TEST',
        name: 'Modulo fotovoltaico 500 W',
        type: 'materiale',
        unit: 'pz',
      })
      .returning({ id: products.id })
    productId = prodotto!.id
  })

  const base = () => ({
    productId,
    title: 'Modulo fotovoltaico 500 W',
    versionLabel: 'rev. 2026-03',
    category: 'scheda_tecnica',
    sortOrder: '0',
    includedPages: '',
  })

  it('archivia il PDF e registra la scheda con tutte le pagine', async () => {
    const esito = await caricaSchedaTecnica(modulo(base(), await fileDiProva(4)))

    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.data.pagine).toBe(4)

    const salvata = await db.query.productDocuments.findFirst({
      where: eq(productDocuments.id, esito.data.id),
    })
    expect(salvata?.includedPages).toBeNull()
    expect(salvata?.isActive).toBe(true)
    expect(archiviati.has(salvata!.storageKey)).toBe(true)
  })

  it('conserva la selezione di pagine quando è indicata', async () => {
    const esito = await caricaSchedaTecnica(
      modulo({ ...base(), includedPages: '2-3' }, await fileDiProva(6)),
    )

    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.data.pagine).toBe(2)

    const salvata = await db.query.productDocuments.findFirst({
      where: eq(productDocuments.id, esito.data.id),
    })
    expect(salvata?.includedPages).toEqual([2, 3])
  })

  it('rifiuta le pagine che il documento non ha', async () => {
    const esito = await caricaSchedaTecnica(
      modulo({ ...base(), includedPages: '1,9' }, await fileDiProva(3)),
    )

    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.errors.includedPages).toContain('3 pagine')
    // Nulla deve restare in archivio: un file orfano è un costo senza padrone.
    expect(archiviati.size).toBe(0)
  })

  it('rifiuta un file che si dichiara PDF ma non lo è', async () => {
    const finto = new File([new TextEncoder().encode('non sono un pdf')], 'scheda.pdf', {
      type: 'application/pdf',
    })
    const esito = await caricaSchedaTecnica(modulo(base(), finto))

    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.errors.file).toBeDefined()
  })

  it('non accetta due volte la stessa revisione dello stesso prodotto', async () => {
    expect((await caricaSchedaTecnica(modulo(base(), await fileDiProva(2)))).ok).toBe(true)
    const secondo = await caricaSchedaTecnica(modulo(base(), await fileDiProva(2)))

    expect(secondo.ok).toBe(false)
    if (secondo.ok) return
    expect(secondo.errors.versionLabel).toContain('già')
  })

  it('la stessa revisione vale per categorie diverse', async () => {
    expect((await caricaSchedaTecnica(modulo(base(), await fileDiProva(2)))).ok).toBe(true)
    const garanzia = await caricaSchedaTecnica(
      modulo({ ...base(), category: 'garanzia' }, await fileDiProva(2)),
    )
    expect(garanzia.ok).toBe(true)
  })

  it('ritirare non cancella: la riga resta, esce solo dai preventivi futuri', async () => {
    const caricata = await caricaSchedaTecnica(modulo(base(), await fileDiProva(2)))
    expect(caricata.ok).toBe(true)
    if (!caricata.ok) return

    expect((await ritiraSchedaTecnica(caricata.data.id)).ok).toBe(true)

    const dopo = await db.query.productDocuments.findFirst({
      where: eq(productDocuments.id, caricata.data.id),
    })
    expect(dopo?.isActive).toBe(false)
    // Il file resta leggibile: i preventivi già inviati lo citano nello snapshot.
    expect(archiviati.has(dopo!.storageKey)).toBe(true)

    expect((await ritiraSchedaTecnica(caricata.data.id)).ok).toBe(false)
    expect((await ripristinaSchedaTecnica(caricata.data.id)).ok).toBe(true)
  })
})
