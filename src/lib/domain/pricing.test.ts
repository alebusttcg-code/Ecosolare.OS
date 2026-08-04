import { describe, expect, it } from 'vitest'
import {
  importoAStringa,
  percentualeDaNumero,
  prezzoDaEuro,
  quantitaDaNumero,
} from './money'
import { calcolaPreventivo, calcolaRiga, valutaSoglia, type RigaCalcolo } from './pricing'

function riga(
  quantita: number,
  prezzo: number,
  costo: number,
  scontoPct = 0,
  iva = 10,
): RigaCalcolo {
  return {
    quantita: quantitaDaNumero(quantita),
    prezzoUnitario: prezzoDaEuro(prezzo),
    costoUnitario: prezzoDaEuro(costo),
    scontoPct: percentualeDaNumero(scontoPct),
    aliquotaIva: percentualeDaNumero(iva),
  }
}

describe('calcolaRiga', () => {
  it('calcola imponibile, costo e margine di una riga semplice', () => {
    const r = calcolaRiga(riga(10, 250, 180))
    expect(r.imponibile).toBe(250_000) // 2.500,00 euro in centesimi
    expect(r.costo).toBe(180_000)
    expect(r.margine).toBe(70_000)
    expect(r.iva).toBe(25_000) // 10%
  })

  it('gestisce prezzi con quattro decimali, come euro/Watt', () => {
    // 6.480 W a 0,4523 euro/W = 2.930,90 euro
    const r = calcolaRiga(riga(6480, 0.4523, 0.31))
    expect(importoAStringa(r.imponibile)).toBe('2930.90')
    expect(importoAStringa(r.costo)).toBe('2008.80')
  })

  it('applica lo sconto al ricavo ma non al costo', () => {
    const r = calcolaRiga(riga(10, 250, 180, 10))
    expect(r.imponibile).toBe(225_000)
    // Il costo non cambia: e' esattamente qui che il margine si assottiglia.
    expect(r.costo).toBe(180_000)
    expect(r.margine).toBe(45_000)
  })

  it('produce margine negativo quando si vende sotto costo', () => {
    const r = calcolaRiga(riga(1, 100, 150))
    expect(r.margine).toBe(-5_000)
  })

  it('arrotonda a centesimi in modo commerciale', () => {
    // 3 x 33,335 = 100,005 -> 100,01 (half away from zero)
    const r = calcolaRiga(riga(3, 33.335, 0))
    expect(importoAStringa(r.imponibile)).toBe('100.01')
  })

  it('gestisce quantita frazionarie', () => {
    const r = calcolaRiga(riga(2.5, 40, 30))
    expect(r.imponibile).toBe(10_000)
    expect(r.costo).toBe(7_500)
  })
})

describe('calcolaPreventivo', () => {
  const righeTipiche = [
    riga(1, 4800, 3200, 0, 10), // moduli
    riga(1, 1600, 1050, 0, 10), // inverter
    riga(1, 3200, 2400, 0, 10), // accumulo
    riga(24, 38, 25, 0, 22), // manodopera, IVA ordinaria
  ]

  it('somma imponibile, costi e margine', () => {
    const t = calcolaPreventivo(righeTipiche)
    expect(importoAStringa(t.imponibile)).toBe('10512.00')
    expect(importoAStringa(t.costoTotale)).toBe('7250.00')
    expect(importoAStringa(t.margine)).toBe('3262.00')
  })

  it('calcola la percentuale di margine sul ricavo', () => {
    const t = calcolaPreventivo([riga(1, 1000, 750)])
    expect(t.marginePct).toBe(2500) // 25,00%
  })

  it('restituisce null invece di zero su un preventivo vuoto', () => {
    // Un preventivo senza righe non ha "margine zero": non ha margine.
    expect(calcolaPreventivo([]).marginePct).toBeNull()
    expect(calcolaPreventivo([riga(0, 100, 0)]).marginePct).toBeNull()
  })

  it('ripartisce l IVA per aliquota', () => {
    const t = calcolaPreventivo(righeTipiche)
    expect(t.ripartizioneIva).toHaveLength(2)

    const iva10 = t.ripartizioneIva.find((r) => r.aliquota === 1000)
    const iva22 = t.ripartizioneIva.find((r) => r.aliquota === 2200)
    expect(importoAStringa(iva10!.imponibile)).toBe('9600.00')
    expect(importoAStringa(iva10!.imposta)).toBe('960.00')
    expect(importoAStringa(iva22!.imponibile)).toBe('912.00')
    expect(importoAStringa(iva22!.imposta)).toBe('200.64')
  })

  it('somma il totale come imponibile piu imposta', () => {
    const t = calcolaPreventivo(righeTipiche)
    expect(t.totale).toBe(t.imponibile + t.imposta)
    expect(importoAStringa(t.totale)).toBe('11672.64')
  })

  it('compone lo sconto globale con quello di riga in modo moltiplicativo', () => {
    // 10% di riga e 10% globale fanno 19%, non 20%.
    const t = calcolaPreventivo([riga(1, 1000, 500, 10)], percentualeDaNumero(10))
    expect(importoAStringa(t.imponibile)).toBe('810.00')
  })

  it('applica lo sconto globale a tutte le aliquote', () => {
    const t = calcolaPreventivo(
      [riga(1, 1000, 500, 0, 10), riga(1, 1000, 500, 0, 22)],
      percentualeDaNumero(10),
    )
    for (const quota of t.ripartizioneIva) {
      expect(importoAStringa(quota.imponibile)).toBe('900.00')
    }
  })

  it('espone lo sconto complessivo concesso', () => {
    const t = calcolaPreventivo([riga(1, 1000, 500)], percentualeDaNumero(15))
    expect(importoAStringa(t.scontoGlobale)).toBe('150.00')
  })

  it('mantiene il totale uguale alla somma delle righe stampate', () => {
    // Proprieta' fondamentale: il cliente che ricalcola a mano deve trovare
    // lo stesso numero. Si arrotonda per riga, non sul totale.
    const righe = [riga(3, 33.335, 0), riga(7, 14.286, 0), riga(1, 0.005, 0)]
    const t = calcolaPreventivo(righe)
    const sommaRighe = t.righe.reduce((s, r) => s + r.imponibile, 0)
    expect(t.imponibile).toBe(sommaRighe)
  })

  it('gestisce un preventivo interamente in perdita', () => {
    const t = calcolaPreventivo([riga(1, 100, 300)])
    expect(t.margine).toBe(-20_000)
    expect(t.marginePct).toBe(-20_000) // -200,00%
  })
})

describe('valutaSoglia', () => {
  const soglia = percentualeDaNumero(20)

  it('segnala il preventivo sotto la soglia di marginalita', () => {
    expect(valutaSoglia(percentualeDaNumero(15), soglia)).toBe('sotto_soglia')
  })

  it('non segnala il preventivo sopra soglia', () => {
    expect(valutaSoglia(percentualeDaNumero(25), soglia)).toBe('sopra_soglia')
  })

  it('considera sopra soglia il valore esattamente uguale', () => {
    expect(valutaSoglia(percentualeDaNumero(20), soglia)).toBe('sopra_soglia')
  })

  it('non valuta un preventivo senza imponibile', () => {
    expect(valutaSoglia(null, soglia)).toBe('non_valutabile')
  })

  it('segnala il margine negativo', () => {
    expect(valutaSoglia(percentualeDaNumero(-5), soglia)).toBe('sotto_soglia')
  })
})
