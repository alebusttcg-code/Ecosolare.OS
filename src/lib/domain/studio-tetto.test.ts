import { describe, expect, it } from 'vitest'
import {
  kWpDaLayout,
  RESA_SPECIFICA_DEFAULT_KWH_KWP,
  stimaProduzioneAnnuakWh,
  studioCompleto,
  type SnapshotStudioTetto,
} from './studio-tetto'

const layoutBase = {
  faldaIndice: 0,
  formatoId: 'viessmann-500',
  wattPicco: 500,
  quantitaRichiesta: 12,
  landscape: true,
  moduli: Array.from({ length: 12 }, (_, i) => ({
    angoli: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.001, longitude: 0.001 },
      { latitude: 0.001, longitude: 0 },
    ] as const,
    centro: { latitude: 0.0005, longitude: 0.0005 },
    rotazioneDegrees: i,
  })),
}

describe('studio tetto — KPI', () => {
  it('calcola kWp come moduli × Wp / 1000', () => {
    expect(kWpDaLayout(layoutBase)).toBe(6)
  })

  it('stima produzione con resa specifica di default', () => {
    expect(stimaProduzioneAnnuakWh(6)).toBe(6 * RESA_SPECIFICA_DEFAULT_KWH_KWP)
  })

  it('richiede analisi, moduli e produzione per essere completo', () => {
    const base: SnapshotStudioTetto = {
      analisi: {
        formattedAddress: 'Via Roma 1',
        location: { latitude: 44, longitude: 10 },
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
            center: null,
            boundingBox: null,
            sunshineMedio: null,
            planeHeightAtCenterMeters: null,
          },
        ],
      },
      poligoni: {},
      faldeRimosse: [],
      layout: layoutBase,
      consumoAnnuoKwh: 8000,
      produzioneAnnuakWh: 7920,
      tariffaImportEurKwh: 0.3,
      tariffaExportEurKwh: 0.1,
    }
    expect(studioCompleto(base)).toBe(true)
    expect(studioCompleto({ ...base, layout: null })).toBe(false)
    expect(studioCompleto({ ...base, produzioneAnnuakWh: 0 })).toBe(false)
  })
})
