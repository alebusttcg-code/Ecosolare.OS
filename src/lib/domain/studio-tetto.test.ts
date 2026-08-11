import { describe, expect, it } from 'vitest'
import {
  contaModuli,
  kWpDaLayout,
  kWpDaLayouts,
  layoutsDelloStudio,
  RESA_SPECIFICA_DEFAULT_KWH_KWP,
  stimaProduzioneAnnuakWh,
  stimaProduzioneDaStudio,
  studioCompleto,
  type LayoutStudioFalda,
  type SnapshotStudioTetto,
} from './studio-tetto'

function moduliFake(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    angoli: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.001, longitude: 0.001 },
      { latitude: 0.001, longitude: 0 },
    ] as const,
    centro: { latitude: 0.0005, longitude: 0.0005 },
    rotazioneDegrees: i,
  }))
}

function layoutFalda(
  faldaIndice: number,
  nModuli: number,
  wattPicco = 500,
): LayoutStudioFalda {
  return {
    faldaIndice,
    formatoId: 'viessmann-500',
    wattPicco,
    quantitaRichiesta: nModuli,
    landscape: true,
    moduli: moduliFake(nModuli),
  }
}

const analisiDueFalde: SnapshotStudioTetto['analisi'] = {
  formattedAddress: 'Via Roma 1',
  location: { latitude: 45.1, longitude: 9.2 },
  boundingBox: null,
  imageryQuality: null,
  imageryDate: null,
  maxArrayPanelsCount: null,
  maxSunshineHoursPerYear: null,
  wholeRoofAreaMeters2: null,
  falde: [
    {
      indice: 0,
      pitchDegrees: 20,
      azimuthDegrees: 180,
      areaMeters2: 40,
      groundAreaMeters2: 38,
      center: { latitude: 45.1, longitude: 9.2 },
      boundingBox: null,
      sunshineMedio: 4,
      planeHeightAtCenterMeters: null,
    },
    {
      indice: 1,
      pitchDegrees: 18,
      azimuthDegrees: 90,
      areaMeters2: 25,
      groundAreaMeters2: 24,
      center: { latitude: 45.1001, longitude: 9.2001 },
      boundingBox: null,
      sunshineMedio: 3.2,
      planeHeightAtCenterMeters: null,
    },
  ],
}

describe('studio tetto — multi-falda', () => {
  it('calcola kWp come moduli × Wp / 1000', () => {
    expect(kWpDaLayout(layoutFalda(0, 12))).toBe(6)
  })

  it('somma kWp e moduli su più falde', () => {
    const layouts = [layoutFalda(0, 6), layoutFalda(1, 2)]
    expect(kWpDaLayouts(layouts)).toBe(4)
    expect(contaModuli(layouts)).toBe(8)
  })

  it('accetta payload legacy con `layout` singolo', () => {
    const legacy = layoutsDelloStudio({
      layouts: [],
      layout: layoutFalda(0, 12),
    })
    expect(legacy).toHaveLength(1)
    expect(legacy[0]!.faldaIndice).toBe(0)
  })

  it('stima produzione come somma per-falda (sud > est)', () => {
    const soloSud = stimaProduzioneDaStudio({
      analisi: analisiDueFalde,
      faldeRimosse: [],
      layouts: [layoutFalda(0, 6)],
    })
    const soloEst = stimaProduzioneDaStudio({
      analisi: analisiDueFalde,
      faldeRimosse: [],
      layouts: [layoutFalda(1, 6)],
    })
    const entrambe = stimaProduzioneDaStudio({
      analisi: analisiDueFalde,
      faldeRimosse: [],
      layouts: [layoutFalda(0, 6), layoutFalda(1, 2)],
    })
    expect(soloSud).toBeGreaterThan(soloEst)
    expect(entrambe).toBeGreaterThan(soloSud)
    expect(entrambe).toBeLessThan(soloSud + soloEst) // 2 moduli est < 6
  })

  it('stima produzione con resa fissa di fallback', () => {
    expect(stimaProduzioneAnnuakWh(6)).toBe(6 * RESA_SPECIFICA_DEFAULT_KWH_KWP)
  })

  it('richiede almeno un layout con moduli per essere completo', () => {
    const base: SnapshotStudioTetto = {
      analisi: analisiDueFalde,
      poligoni: {},
      faldeRimosse: [],
      layouts: [layoutFalda(0, 12)],
      consumoAnnuoKwh: 8000,
      produzioneAnnuakWh: 7920,
      tariffaImportEurKwh: 0.3,
      tariffaExportEurKwh: 0.1,
    }
    expect(studioCompleto(base)).toBe(true)
    expect(studioCompleto({ ...base, layouts: [] })).toBe(false)
    expect(studioCompleto({ ...base, produzioneAnnuakWh: 0 })).toBe(false)
  })
})
