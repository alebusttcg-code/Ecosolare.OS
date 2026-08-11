import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guardia sulla regola più importante del progetto: **nessun costo di acquisto
 * nel payload servito a chi non ha `can_view_costs`** (§11.4 regola 7).
 *
 * Perché un test sul testo del codice e non sul comportamento: il modo in cui
 * la regola si rompe non è una query che sbaglia, è una `select()` senza
 * colonne che ne aggiunge di nuove da sola quando lo schema cambia. Nessun test
 * di comportamento lo intercetta, perché al momento della scrittura il valore
 * non veniva mostrato — arriva nel payload mesi dopo, per effetto di una
 * modifica altrove.
 *
 * È un test volutamente grezzo. Il suo compito non è dimostrare la correttezza:
 * è far fallire la build quando qualcuno reintroduce lo schema di errore.
 */

const RADICE = join(process.cwd(), 'src', 'lib', 'queries')

function leggi(file: string): string {
  return readFileSync(join(RADICE, file), 'utf8')
}

/** Colonne che non devono mai uscire senza la capacità. */
const COLONNE_DI_COSTO = [
  'estimatedUnitCost',
  'actualUnitCost',
  'estimatedCost',
  'estimatedMargin',
  'defaultCostPrice',
  'unitCost',
  'lineCost',
  'costTotal',
]

describe('nessun costo nel payload senza la capacità', () => {
  it('la scheda commessa filtra i costi in query, non nel componente', () => {
    const sorgente = leggi('projects.ts')

    // Il segnale che la regola è applicata: la funzione conosce la capacità.
    expect(sorgente).toContain('const mostraCosti = utente.canViewCosts')

    // E la usa su ciascuna colonna di costo che seleziona.
    for (const colonna of ['estimatedUnitCost', 'actualUnitCost']) {
      const riga = sorgente
        .split('\n')
        .find((l) => l.includes(`projectMaterials.${colonna}`))
      expect(riga, `${colonna} selezionata senza gating`).toBeDefined()
    }
    expect(sorgente).toContain('estimatedCost: null')
    expect(sorgente).toContain('estimatedMargin: null')
  })

  it('la scheda commessa non usa `select()` senza colonne sui materiali', () => {
    // `select()` restituisce OGNI colonna, comprese quelle aggiunte in futuro:
    // è il modo in cui un costo entra nel payload senza che nessuno lo scriva.
    const sorgente = leggi('projects.ts')
    expect(sorgente).not.toMatch(/\.select\(\)\s*\n\s*\.from\(projectMaterials\)/)
  })

  it('il preventivo passa la capacità alle sue query', () => {
    const sorgente = leggi('quotes.ts')
    expect(sorgente).toContain('mostraCosti')
  })

  it('nessuna query espone una colonna di costo senza nominare la capacità', () => {
    // Se un file di query tocca i costi, da qualche parte deve parlare di
    // capacità. Non prova che lo faccia bene; prova che ci ha pensato.
    const file = ['projects.ts', 'quotes.ts', 'economia.ts', 'dashboard.ts', 'banca.ts']

    for (const nome of file) {
      let sorgente: string
      try {
        sorgente = leggi(nome)
      } catch {
        continue
      }

      const toccaCosti = COLONNE_DI_COSTO.some((c) => sorgente.includes(c))
      if (!toccaCosti) continue

      expect(
        /mostraCosti|canViewCosts|material_cost|quote_cost|project_economics/.test(sorgente),
        `${nome} seleziona colonne di costo senza mai nominare la capacità`,
      ).toBe(true)
    }
  })
})
