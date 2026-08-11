import { describe, expect, it } from 'vitest'
import { creaPianoPaginePremium } from './registro-pagine'

describe('registro pagine preventivo premium', () => {
  it('produce le 22 pagine del caso Walter senza cambiare l’ordine commerciale', () => {
    const documenti = Array.from({ length: 8 }, (_, indice) => ({
      id: `tecnica-${indice + 1}`,
      titolo: `Scheda tecnica ${indice + 1}`,
      documentoId: indice < 4 ? 'viessmann' : 'daikin',
      paginaDocumento: (indice % 4) + 1,
    }))

    const piano = creaPianoPaginePremium(documenti)

    expect(piano).toHaveLength(22)
    expect(piano[0]?.id).toBe('sintesi')
    expect(piano.slice(4, 8).map((pagina) => pagina.tipo)).toEqual([
      'fissa',
      'fissa',
      'fissa',
      'fissa',
    ])
    expect(piano[8]?.id).toBe('spesa')
    expect(piano.slice(9, 14).map((pagina) => pagina.tipo)).toEqual([
      'report',
      'report',
      'report',
      'report',
      'report',
    ])
    expect(piano[14]?.tipo).toBe('tecnica')
  })
})
