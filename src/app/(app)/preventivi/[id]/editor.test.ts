import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

/**
 * L'avviso «il termico non entra nel piano economico», reso davvero.
 *
 * La logica sta in `diagnostica-termico` ed è coperta lì; qui si verifica il
 * pezzo che quei test non vedono — che l'avviso compaia sullo schermo, con
 * dentro le parole giuste, nei casi in cui il motore salterebbe il calcolo.
 *
 * `saveQuoteLines` è una server action: importarla in un test tirerebbe dentro
 * database e cache di Next, che qui non servono a niente.
 */
vi.mock('@/lib/actions/quotes', () => ({ saveQuoteLines: async () => ({ ok: true }) }))

const { EditorPreventivo } = await import('./editor')

const RIGA_POMPA = {
  id: 'r1',
  productId: 'p1',
  description: 'Pompa di calore 8 kW',
  unit: 'pz',
  quantity: 1,
  unitPrice: 7000,
  discountPct: 0,
  vatRate: 10,
  componentRole: 'pompa_calore',
  scop: null as number | null,
}

const DOSSIER_TERMICO = {
  termico: {
    presente: true,
    tipo: 'pdc' as const,
    descrizione: 'Pompa di calore aria-acqua',
    prezzoLordoEur: 7700,
    detrazionePct: 50,
    incentivo: 'detrazione' as const,
    contoTermicoEur: null,
    scop: null,
    prezzoGasEurSmc: null,
    anniDetrazione: null,
    anniContoTermico: null,
  },
}

function rendi(opzioni: {
  scopCatalogo?: number | null
  consumoGasAnnuoSmc?: number | null
  prezzoGasPredefinito?: number | null
}): string {
  return renderToStaticMarkup(
    createElement(EditorPreventivo, {
      versionId: '00000000-0000-0000-0000-000000000001',
      lockVersioneIniziale: 0,
      righeIniziali: [{ ...RIGA_POMPA, scop: opzioni.scopCatalogo ?? null }],
      scontoIniziale: 0,
      modificabile: true,
      mostraCosti: false,
      catalogo: [],
      sogliaMarginePct: 20,
      dossierIniziale: DOSSIER_TERMICO,
      consumoGasAnnuoSmc: opzioni.consumoGasAnnuoSmc ?? null,
      prezzoGasPredefinito: opzioni.prezzoGasPredefinito ?? null,
    }),
  )
}

describe('avviso sul termico che non entra nel piano', () => {
  it('elenca tutto ciò che manca, e dove si compila', () => {
    const html = rendi({})
    expect(html).toContain('Il risparmio sul riscaldamento non entra nel piano economico')
    expect(html).toContain('gas consumato')
    expect(html).toContain('studio tetto')
    expect(html).toContain('SCOP')
    expect(html).toContain('catalogo')
  })

  it('con tutti i dati a posto dice che il risparmio entra', () => {
    const html = rendi({
      scopCatalogo: 4.2,
      consumoGasAnnuoSmc: 1200,
      prezzoGasPredefinito: 1.1,
    })
    expect(html).not.toContain('non entra nel piano economico')
    expect(html).toContain('entra nel piano economico insieme')
  })

  /*
   * Le voci mancanti si cercano nella loro forma in grassetto: «SCOP della
   * pompa di calore» e «prezzo del gas» compaiono anche come etichetta di
   * campo e nel testo d'aiuto, e cercarle nude direbbe sempre di sì.
   */
  const voceMancante = (cosa: string) => `<b style="color:var(--testo)">${cosa}</b>`

  it('lo SCOP dal catalogo toglie il suo avviso senza toccare il preventivo', () => {
    // È il punto 5: il dato è una proprietà della macchina, non del preventivo.
    const senza = rendi({ consumoGasAnnuoSmc: 1200, prezzoGasPredefinito: 1.1 })
    expect(senza).toContain(voceMancante('lo SCOP della pompa di calore'))

    const con = rendi({
      scopCatalogo: 4.2,
      consumoGasAnnuoSmc: 1200,
      prezzoGasPredefinito: 1.1,
    })
    expect(con).not.toContain(voceMancante('lo SCOP della pompa di calore'))
  })

  it('il prezzo del gas configurato copre il campo lasciato vuoto', () => {
    const senzaPredefinito = rendi({ scopCatalogo: 4, consumoGasAnnuoSmc: 1200 })
    expect(senzaPredefinito).toContain(voceMancante('il prezzo del gas'))

    const conPredefinito = rendi({
      scopCatalogo: 4,
      consumoGasAnnuoSmc: 1200,
      prezzoGasPredefinito: 1.1,
    })
    expect(conPredefinito).not.toContain(voceMancante('il prezzo del gas'))
  })

  it('mostra il prezzo termico dedotto dalle righe, non un campo da riempire', () => {
    // Punto 4: 7.000 € imponibile + 10% = 7.700 € lordi.
    expect(rendi({})).toContain('7.700')
  })
})
