import { describe, expect, it } from 'vitest'
import {
  attesaPrimaDelProssimo,
  haAncoraTentativi,
  prossimoTentativo,
  TENTATIVI_MASSIMI,
} from './ritentativi'

describe('ritentativi dell’outbox', () => {
  it('parte da mezzo minuto e raddoppia', () => {
    expect(attesaPrimaDelProssimo(1)).toBe(30_000)
    expect(attesaPrimaDelProssimo(2)).toBe(60_000)
    expect(attesaPrimaDelProssimo(3)).toBe(120_000)
  })

  it('non supera le sei ore', () => {
    // Senza tetto, al decimo tentativo l'attesa sarebbe di giorni: l'evento
    // risulterebbe «in attesa» pur essendo di fatto abbandonato.
    expect(attesaPrimaDelProssimo(30)).toBe(6 * 60 * 60_000)
  })

  it('smette di riprovare dopo il numero massimo di tentativi', () => {
    expect(haAncoraTentativi(TENTATIVI_MASSIMI - 1)).toBe(true)
    expect(haAncoraTentativi(TENTATIVI_MASSIMI)).toBe(false)
    expect(prossimoTentativo(TENTATIVI_MASSIMI, new Date())).toBeNull()
  })

  it('copre almeno una notte prima di arrendersi', () => {
    // Un guasto notturno di un servizio esterno non deve trasformarsi in
    // eventi falliti da recuperare a mano il mattino dopo.
    let totale = 0
    for (let n = 1; n <= TENTATIVI_MASSIMI; n += 1) totale += attesaPrimaDelProssimo(n)
    expect(totale).toBeGreaterThan(8 * 60 * 60_000)
  })

  it('calcola il momento del prossimo tentativo a partire da adesso', () => {
    const adesso = new Date('2026-03-01T10:00:00Z')
    expect(prossimoTentativo(1, adesso)).toEqual(new Date('2026-03-01T10:00:30Z'))
  })
})
