import { describe, expect, it } from 'vitest'
import { elencoComuni, elencoProvince, elencoRegioni } from './italia'
import { componeIndirizzo, scomponiIndirizzo } from './tipi-via'

describe('geo italia', () => {
  it('compone indirizzo con tipo, nome e civico', () => {
    expect(componeIndirizzo({ tipoVia: 'Via', nomeVia: 'Roma', civico: '12' })).toBe(
      'Via Roma, 12',
    )
  })

  it('scompone un indirizzo composto', () => {
    expect(scomponiIndirizzo('Via Roma, 12')).toEqual({
      tipoVia: 'Via',
      nomeVia: 'Roma',
      civico: '12',
    })
  })

  it('ha le 20 regioni e le province collegate', () => {
    expect(elencoRegioni()).toHaveLength(20)
    const lombardia = elencoRegioni().find((r) => r.nome === 'Lombardia')
    expect(lombardia).toBeTruthy()
    const province = elencoProvince(lombardia!.codice)
    expect(province.some((p) => p.sigla === 'MI')).toBe(true)
    expect(elencoComuni('MI').some((c) => c.n === 'Milano')).toBe(true)
  })
})
