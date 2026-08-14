import { describe, expect, it } from 'vitest'
import { riduciTmyAClimatologia } from './climatologia'
import type { RigaTmy } from './pvgis'

function riga(time: string, gh: number, gbn = 0, gdh = 0, t = 15): RigaTmy {
  return { 'time(UTC)': time, 'G(h)': gh, 'Gb(n)': gbn, 'Gd(h)': gdh, 'T2m': t }
}

describe('riduzione TMY → climatologia giorno-tipo', () => {
  it('media la stessa ora dello stesso mese su più giorni', () => {
    const righe = [
      riga('20080101:1200', 100, 0, 0, 5),
      riga('20080102:1200', 200, 0, 0, 7),
      riga('20080715:1200', 800, 0, 0, 28),
    ]
    const c = riduciTmyAClimatologia(righe, { lat: 44, lng: 10 })

    // Gennaio, ora 12: media di 100 e 200.
    expect(c.ghi[0]![12]).toBe(150)
    expect(c.temperatura[0]![12]).toBe(6)
    // Luglio, ora 12: unico valore.
    expect(c.ghi[6]![12]).toBe(800)
    // Le celle senza dati restano a zero, non NaN.
    expect(c.ghi[0]![0]).toBe(0)
    expect(Number.isNaN(c.ghi[3]![9])).toBe(false)
  })

  it('somma il GHI annuo in kWh/m² (W/m² per ora = Wh/m²)', () => {
    const righe = [
      riga('20080101:1200', 500),
      riga('20080101:1300', 500),
      riga('20080601:1200', 1000),
    ]
    // (500 + 500 + 1000) Wh/m² = 2000 → 2 kWh/m².
    const c = riduciTmyAClimatologia(righe, { lat: 44, lng: 10 })
    expect(c.ghiAnnuoKwhM2).toBe(2)
  })

  it('conserva forma 12×24 e metadati posizione', () => {
    const c = riduciTmyAClimatologia([riga('20080101:1200', 100)], {
      lat: 44.11,
      lng: 9.96,
      elevazioneM: 16,
    })
    expect(c.fonte).toBe('PVGIS-TMY')
    expect(c.lat).toBe(44.11)
    expect(c.elevazioneM).toBe(16)
    expect(c.ghi).toHaveLength(12)
    expect(c.ghi[0]).toHaveLength(24)
  })

  it('scarta i timestamp illeggibili invece di inquinare le medie', () => {
    const righe = [
      riga('20080101:1200', 100),
      riga('data-rotta', 999_999),
      riga('20080199:9900', 999_999), // mese/ora fuori range
    ]
    const c = riduciTmyAClimatologia(righe, { lat: 44, lng: 10 })
    expect(c.ghi[0]![12]).toBe(100)
    expect(c.ghiAnnuoKwhM2).toBe(0) // 100 Wh → arrotondato a 0 kWh, non 1.000
  })
})
