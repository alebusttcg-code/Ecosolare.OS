import { describe, expect, it } from 'vitest'
import { layoutModuliInFalda, moduloDaCentro, ruotaModulo, snapCentroModulo } from './layout-moduli'
import { FORMATI_MODULO_FV } from './moduli-fv'

describe('layoutModuliInFalda', () => {
  const falda = [
    { latitude: 45.0, longitude: 9.0 },
    { latitude: 45.0, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0 },
  ]

  it('colloca al più la quantità richiesta', () => {
    const layout = layoutModuliInFalda({
      poligono: falda,
      formato: FORMATI_MODULO_FV[0]!,
      quantita: 4,
      azimuthDegrees: 180,
    })
    expect(layout.richiesti).toBe(4)
    expect(layout.collocati).toBeLessThanOrEqual(4)
    expect(layout.collocati).toBeGreaterThan(0)
    expect(layout.moduli).toHaveLength(layout.collocati)
    expect(layout.kWp).toBeCloseTo(
      (layout.collocati * FORMATI_MODULO_FV[0]!.wattPicco) / 1000,
      5,
    )
  })

  it('zero se quantità 0', () => {
    const layout = layoutModuliInFalda({
      poligono: falda,
      formato: FORMATI_MODULO_FV[0]!,
      quantita: 0,
      azimuthDegrees: 180,
    })
    expect(layout.collocati).toBe(0)
  })

  it('moduloDaCentro ricostruisce 4 angoli attorno al centro', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const m = moduloDaCentro({
      centro: origine,
      formato: FORMATI_MODULO_FV[0]!,
      azimuthDegrees: 180,
      landscape: true,
      origineProiezione: origine,
    })
    expect(m.angoli).toHaveLength(4)
    expect(m.centro.latitude).toBeCloseTo(origine.latitude, 6)
    expect(m.rotazioneDegrees).toBe(0)
  })

  it('rotazione cambia gli angoli mantenendo il centro', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const m0 = moduloDaCentro({
      centro: origine,
      formato: FORMATI_MODULO_FV[0]!,
      azimuthDegrees: 180,
      landscape: true,
      origineProiezione: origine,
    })
    const m90 = ruotaModulo(
      m0,
      90,
      FORMATI_MODULO_FV[0]!,
      180,
      true,
      origine,
    )
    expect(m90.rotazioneDegrees).toBe(90)
    expect(m90.centro.latitude).toBeCloseTo(m0.centro.latitude, 6)
    expect(m90.angoli[0]!.latitude).not.toBeCloseTo(m0.angoli[0]!.latitude, 6)
  })

  it('snap calamita attacca bordo a bordo con gap', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const formato = FORMATI_MODULO_FV[0]!
    const azimuth = 180
    const a = moduloDaCentro({
      centro: origine,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
    })
    const w = formato.lunghezzaM
    const contatto = w + 0.03
    const vicino = offsetCentroLocale(origine, azimuth, 0, contatto + 0.12, 0)
    const snappato = snapCentroModulo({
      centro: vicino,
      rotazioneDegrees: 0,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
      fissi: [a],
    })
    const ideale = offsetCentroLocale(origine, azimuth, 0, contatto, 0)
    expect(snappato.latitude).toBeCloseTo(ideale.latitude, 7)
    expect(snappato.longitude).toBeCloseTo(ideale.longitude, 7)
  })

  it('snap allinea gli assi (flush) quando sono vicini', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const formato = FORMATI_MODULO_FV[0]!
    const azimuth = 180
    const a = moduloDaCentro({
      centro: origine,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
    })
    const w = formato.lunghezzaM
    // A contatto sul lato u, ma sfalsato di 0.1 m su v → deve flushare v=0.
    const quasi = offsetCentroLocale(origine, azimuth, 0, w + 0.03, 0.1)
    const snappato = snapCentroModulo({
      centro: quasi,
      rotazioneDegrees: 0,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
      fissi: [a],
    })
    const ideale = offsetCentroLocale(origine, azimuth, 0, w + 0.03, 0)
    expect(snappato.latitude).toBeCloseTo(ideale.latitude, 7)
    expect(snappato.longitude).toBeCloseTo(ideale.longitude, 7)
  })

  it('snap non scatta oltre la soglia', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const formato = FORMATI_MODULO_FV[0]!
    const azimuth = 180
    const a = moduloDaCentro({
      centro: origine,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
    })
    const lontano = offsetCentroLocale(
      origine,
      azimuth,
      0,
      formato.lunghezzaM + 0.03 + 1.5,
      0,
    )
    const snappato = snapCentroModulo({
      centro: lontano,
      rotazioneDegrees: 0,
      formato,
      azimuthDegrees: azimuth,
      landscape: true,
      origineProiezione: origine,
      fissi: [a],
    })
    expect(snappato.latitude).toBeCloseTo(lontano.latitude, 8)
    expect(snappato.longitude).toBeCloseTo(lontano.longitude, 8)
  })
})

/** Offset in metri lungo u/v del sistema modulo (azimuth+90+rot). */
function offsetCentroLocale(
  origine: { latitude: number; longitude: number },
  azimuthDegrees: number,
  rotazioneDegrees: number,
  du: number,
  dv: number,
): { latitude: number; longitude: number } {
  const θ = ((azimuthDegrees + 90 + rotazioneDegrees) * Math.PI) / 180
  const cosA = Math.cos(θ)
  const sinA = Math.sin(θ)
  const e = du * cosA - dv * sinA
  const n = du * sinA + dv * cosA
  const mPerDegLat = (Math.PI / 180) * 6_371_000
  const mPerDegLng =
    mPerDegLat * Math.cos((origine.latitude * Math.PI) / 180)
  return {
    latitude: origine.latitude + n / mPerDegLat,
    longitude: origine.longitude + e / mPerDegLng,
  }
}
