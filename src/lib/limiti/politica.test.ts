import { describe, expect, it } from 'vitest'
import {
  LIMITE_GLOBALE,
  LIMITE_PER_IP,
  LIMITE_TOKEN_ERRATO,
  stimaScorrevole,
  valuta,
  type Finestra,
} from './politica'

const FINESTRA: Finestra = { massimo: 10, durataMs: 60_000 }
const INIZIO = new Date('2026-08-12T10:00:00.000Z')

function fra(secondi: number): Date {
  return new Date(INIZIO.getTime() + secondi * 1000)
}

describe('stima della finestra scorrevole', () => {
  it('all’inizio della finestra conta solo quella corrente', () => {
    const stato = { windowStart: INIZIO, count: 4, previousCount: 8 }
    // La precedente pesa per intero, perché la finestra osservata la copre tutta.
    expect(stimaScorrevole(stato, FINESTRA, INIZIO)).toBe(12)
  })

  it('a metà finestra la precedente pesa la metà', () => {
    const stato = { windowStart: INIZIO, count: 4, previousCount: 8 }
    expect(stimaScorrevole(stato, FINESTRA, fra(30))).toBe(8)
  })

  it('a fine finestra la precedente è sparita', () => {
    const stato = { windowStart: INIZIO, count: 4, previousCount: 8 }
    expect(stimaScorrevole(stato, FINESTRA, fra(59))).toBe(5)
  })

  it('una finestra scaduta decade invece di azzerarsi di colpo', () => {
    const stato = { windowStart: INIZIO, count: 10, previousCount: 0 }
    expect(stimaScorrevole(stato, FINESTRA, fra(60))).toBe(10)
    expect(stimaScorrevole(stato, FINESTRA, fra(90))).toBe(5)
    expect(stimaScorrevole(stato, FINESTRA, fra(120))).toBe(0)
  })

  it('un contatore vecchio di ore non conta nulla', () => {
    const stato = { windowStart: INIZIO, count: 999, previousCount: 999 }
    expect(stimaScorrevole(stato, FINESTRA, fra(7200))).toBe(0)
  })
})

describe('valutazione del limite', () => {
  it('consente fino al massimo compreso', () => {
    const stato = { windowStart: INIZIO, count: 10, previousCount: 0 }
    const esito = valuta(stato, FINESTRA, INIZIO)
    expect(esito.consentito).toBe(true)
    expect(esito.riprovaTraSecondi).toBe(0)
  })

  it('rifiuta oltre il massimo e dice quanto aspettare', () => {
    const stato = { windowStart: INIZIO, count: 11, previousCount: 0 }
    const esito = valuta(stato, FINESTRA, fra(20))
    expect(esito.consentito).toBe(false)
    expect(esito.usate).toBe(11)
    expect(esito.riprovaTraSecondi).toBe(40)
  })

  it('non promette mai zero secondi di attesa a chi è stato rifiutato', () => {
    // Zero verrebbe letto come «riprova subito», e chi riprova subito viene
    // rifiutato di nuovo: un ciclo stretto che nessuno dei due vuole.
    const stato = { windowStart: INIZIO, count: 11, previousCount: 0 }
    expect(valuta(stato, FINESTRA, fra(59.9)).riprovaTraSecondi).toBeGreaterThan(0)
  })

  it('il doppio passaggio a cavallo di due finestre non passa', () => {
    // Il caso che la finestra fissa lascerebbe passare: massimo raggiunto
    // all'ultimo istante e di nuovo al primo della finestra dopo.
    const dopoIlRibaltamento = { windowStart: fra(60), count: 10, previousCount: 10 }
    expect(valuta(dopoIlRibaltamento, FINESTRA, fra(61)).consentito).toBe(false)
  })
})

describe('soglie di /api/intake', () => {
  it('lasciano passare un modulo del sito insistente', () => {
    // Tre invii ravvicinati dello stesso modulo non devono mai essere fermati:
    // il primo obbligo dell'endpoint è non perdere un lead.
    const stato = { windowStart: INIZIO, count: 3, previousCount: 0 }
    expect(valuta(stato, LIMITE_PER_IP, INIZIO).consentito).toBe(true)
  })

  it('il limite per indirizzo è più stretto di quello globale', () => {
    expect(LIMITE_PER_IP.massimo).toBeLessThan(LIMITE_GLOBALE.massimo)
  })

  it('i tentativi con token errato sono i più stretti di tutti', () => {
    // Un token da 24 caratteri con dieci tentativi all'ora non si indovina:
    // è il conto che rende inutile provarci.
    expect(LIMITE_TOKEN_ERRATO.massimo).toBeLessThan(LIMITE_PER_IP.massimo)
  })
})
