import { describe, expect, it } from 'vitest'
import { calcolaProduzioneOraria, type FaldaFv } from './produzione-oraria'
import { autoconsumoDaMatching, matriceConsumoMensileOraria, FAMIGLIA_1_2 } from './profili-carico'
import type { Climatologia } from '@/lib/solar/clima/climatologia'

/**
 * Climatologia sintetica a cielo diffuso (DNI=0, DHI=GHI): fisicamente coerente
 * e deterministica. Basta a esercitare tutta la catena — trasposizione,
 * temperatura, perdite, inverter — con un PR sensato. Il realismo dei numeri
 * veri è affidato alla validazione dal vivo (`npm run prova:pvgis`), non a un
 * fixture.
 */
function climaDiffusa(ghiDiurno: number): Climatologia {
  const matrice = () =>
    Array.from({ length: 12 }, () =>
      Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 16 ? ghiDiurno : 0)),
    )
  const temp = () =>
    Array.from({ length: 12 }, () => new Array<number>(24).fill(15))
  const ghi = matrice()
  return {
    fonte: 'PVGIS-TMY',
    lat: 44.11,
    lng: 9.96,
    elevazioneM: 16,
    ghiAnnuoKwhM2: 0,
    ghi,
    dni: Array.from({ length: 12 }, () => new Array<number>(24).fill(0)),
    dhi: ghi.map((r) => [...r]),
    temperatura: temp(),
  }
}

const FALDA_PIANA: FaldaFv[] = [{ kWp: 6, tiltDeg: 0, azimutDeg: 180 }]

describe('orchestratore produzione oraria', () => {
  it('produce energia e un PR plausibile (perdite × inverter)', () => {
    const p = calcolaProduzioneOraria(climaDiffusa(400), FALDA_PIANA, {
      potenzaAcMaxKw: 5,
    })
    expect(p.produzioneAnnuaKwh).toBeGreaterThan(0)
    // A cielo diffuso e tetto piano il POA = GHI: il PR è puro prodotto di
    // perdite di sistema × inverter × temperatura, sui 0,85–0,90.
    expect(p.performanceRatio).toBeGreaterThan(0.8)
    expect(p.performanceRatio).toBeLessThan(0.92)
  })

  it('la matrice mese×ora somma alla produzione annua', () => {
    const p = calcolaProduzioneOraria(climaDiffusa(400), FALDA_PIANA, {
      potenzaAcMaxKw: 5,
    })
    const somma = p.produzioneMensileOraria.reduce(
      (s, riga) => s + riga.reduce((a, v) => a + v, 0),
      0,
    )
    expect(somma).toBeCloseTo(p.produzioneAnnuaKwh, 0)
  })

  it('raddoppiando la potenza (con inverter adeguato) raddoppia la resa', () => {
    const clima = climaDiffusa(400)
    const uno = calcolaProduzioneOraria(clima, [{ kWp: 3, tiltDeg: 0, azimutDeg: 180 }], {
      potenzaAcMaxKw: 100,
    })
    const due = calcolaProduzioneOraria(clima, [{ kWp: 6, tiltDeg: 0, azimutDeg: 180 }], {
      potenzaAcMaxKw: 100,
    })
    expect(due.produzioneAnnuaKwh).toBeCloseTo(uno.produzioneAnnuaKwh * 2, -1)
  })

  it('un inverter piccolo tronca, uno generoso no', () => {
    const clima = climaDiffusa(900) // sole forte: il campo spinge oltre l'inverter
    const stretto = calcolaProduzioneOraria(clima, FALDA_PIANA, { potenzaAcMaxKw: 3 })
    const largo = calcolaProduzioneOraria(clima, FALDA_PIANA, { potenzaAcMaxKw: 100 })
    expect(stretto.clippingKwh).toBeGreaterThan(0)
    expect(largo.clippingKwh).toBe(0)
  })

  it('il guadagno bifacciale alza la resa', () => {
    const clima = climaDiffusa(400)
    const mono = calcolaProduzioneOraria(clima, FALDA_PIANA, { potenzaAcMaxKw: 100 })
    const bi = calcolaProduzioneOraria(clima, FALDA_PIANA, {
      potenzaAcMaxKw: 100,
      guadagnoBifaccialePct: 6,
    })
    expect(bi.produzioneAnnuaKwh).toBeGreaterThan(mono.produzioneAnnuaKwh)
  })

  it('senza potenza installata non produce nulla, senza rompersi', () => {
    const p = calcolaProduzioneOraria(climaDiffusa(400), [], { potenzaAcMaxKw: 5 })
    expect(p.produzioneAnnuaKwh).toBe(0)
    expect(p.performanceRatio).toBe(0)
  })

  it('si incastra col matching dell’autoconsumo, conservando l’energia', () => {
    const p = calcolaProduzioneOraria(climaDiffusa(400), FALDA_PIANA, {
      potenzaAcMaxKw: 5,
    })
    const consumo = matriceConsumoMensileOraria(4000, FAMIGLIA_1_2)
    const b = autoconsumoDaMatching(p.produzioneMensileOraria, consumo)
    expect(b.autoconsumoKwh + b.exportKwh).toBeCloseTo(b.produzioneKwh, 3)
    expect(b.autoconsumoKwh).toBeLessThanOrEqual(b.consumoKwh)
    // Produzione di giorno, consumo serale: l'autoconsumo non è totale.
    expect(b.frazioneAutoconsumo).toBeGreaterThan(0)
    expect(b.frazioneAutoconsumo).toBeLessThan(1)
  })
})
