import { describe, expect, it } from 'vitest'
import { intestazioniStampa } from './intestazioni-stampa'

/**
 * Il difetto che questo file sorveglia è arrivato in produzione come
 * «Network.setExtraHTTPHeaders: Invalid header value»: un messaggio che non
 * dice quale intestazione né quale carattere, e che manda a cercare il
 * problema dentro Chromium invece che nella configurazione.
 */
describe('intestazioni per la stampa', () => {
  it('toglie gli spazi che un segreto incollato si porta dietro', () => {
    const conACapo = `segreto-lungo-abbastanza${String.fromCharCode(10)}`
    expect(intestazioniStampa({ 'x-pdf-interno': conACapo })).toEqual({
      'x-pdf-interno': 'segreto-lungo-abbastanza',
    })
  })

  it('salta i valori assenti invece di mandarli vuoti', () => {
    expect(
      intestazioniStampa({ Cookie: null, 'x-altro': undefined, 'x-vuoto': '   ' }),
    ).toEqual({})
  })

  it('conserva ciò che è già valido', () => {
    expect(intestazioniStampa({ 'Accept-Language': 'it-IT,it;q=0.9' })).toEqual({
      'Accept-Language': 'it-IT,it;q=0.9',
    })
  })

  it('nomina l’intestazione colpevole quando resta illegale', () => {
    const spezzato = `con${String.fromCharCode(10)}un a capo dentro`
    expect(() => intestazioniStampa({ 'x-pdf-interno': spezzato })).toThrow(/x-pdf-interno/)
    // Accentate comprese: sono legali in una stringa, non in un'intestazione.
    expect(() => intestazioniStampa({ 'x-token': 'però' })).toThrow(/x-token/)
  })

  it('non mette mai il valore nel messaggio: è un segreto', () => {
    // I messaggi d'errore finiscono nei log, e i log si leggono in tre.
    const segreto = `SEGRETISSIMO${String.fromCharCode(9)}`
    let messaggio = ''
    try {
      intestazioniStampa({ 'x-pdf-interno': `${segreto}${String.fromCharCode(10)}x` })
    } catch (errore) {
      messaggio = errore instanceof Error ? errore.message : String(errore)
    }
    expect(messaggio).toContain('x-pdf-interno')
    expect(messaggio).not.toContain('SEGRETISSIMO')
  })
})
