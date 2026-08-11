import { describe, expect, it } from 'vitest'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import {
  CAMPI_GEOMETRIA_STUDIO,
  faldaRiferimento,
  haDatiStudioPerSopralluogo,
  orientamentoDaAzimuth,
  risposteDaStudioTetto,
} from './sopralluogo-studio-tetto'

function snapshotBase(
  override: Partial<SnapshotStudioTetto> = {},
): SnapshotStudioTetto {
  return {
    analisi: {
      formattedAddress: 'Via Test',
      location: { latitude: 45.1, longitude: 9.2 },
      boundingBox: null,
      imageryQuality: null,
      imageryDate: null,
      maxArrayPanelsCount: null,
      maxSunshineHoursPerYear: null,
      wholeRoofAreaMeters2: 80,
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
          sunshineMedio: 3,
          planeHeightAtCenterMeters: null,
        },
      ],
    },
    poligoni: {},
    faldeRimosse: [],
    layouts: [
      {
        faldaIndice: 0,
        formatoId: 'm',
        wattPicco: 500,
        quantitaRichiesta: 8,
        landscape: true,
        moduli: Array.from({ length: 8 }, () => ({
          angoli: [
            { latitude: 0, longitude: 0 },
            { latitude: 0, longitude: 0.001 },
            { latitude: 0.001, longitude: 0.001 },
            { latitude: 0.001, longitude: 0 },
          ] as const,
          centro: { latitude: 0.0005, longitude: 0.0005 },
          rotazioneDegrees: 0,
        })),
      },
    ],
    consumoAnnuoKwh: 5000,
    produzioneAnnuakWh: 5000,
    tariffaImportEurKwh: 0.3,
    tariffaExportEurKwh: 0.1,
    ...override,
  }
}

describe('sopralluogo da studio tetto', () => {
  it('mappa azimuth → orientamento form', () => {
    expect(orientamentoDaAzimuth(180)).toBe('sud')
    expect(orientamentoDaAzimuth(90)).toBe('est')
    expect(orientamentoDaAzimuth(135)).toBe('sud_est')
    expect(orientamentoDaAzimuth(225)).toBe('sud_ovest')
    expect(orientamentoDaAzimuth(0)).toBe('nord')
  })

  it('precompila copertura e potenza dalla falda con moduli', () => {
    const r = risposteDaStudioTetto(snapshotBase())
    expect(r.tipo_tetto).toBe('misto')
    expect(r.orientamento).toBe('sud')
    expect(r.inclinazione).toBe(20)
    expect(r.superficie_utile).toBe(65)
    expect(r.potenza_stimata).toBe(4)
    expect(faldaRiferimento(snapshotBase())?.indice).toBe(0)
  })

  it('ignora falde rimosse e riconosce piano', () => {
    const r = risposteDaStudioTetto(
      snapshotBase({
        faldeRimosse: [0, 1],
        layouts: [],
        analisi: {
          ...snapshotBase().analisi,
          falde: [
            {
              indice: 2,
              pitchDegrees: 2,
              azimuthDegrees: 180,
              areaMeters2: 50,
              groundAreaMeters2: 50,
              center: null,
              boundingBox: null,
              sunshineMedio: null,
              planeHeightAtCenterMeters: null,
            },
          ],
        },
      }),
    )
    expect(r.tipo_tetto).toBe('piano')
    expect(r.orientamento).toBeUndefined()
    expect(r.superficie_utile).toBe(50)
  })

  it('rileva presenza dati importabili', () => {
    expect(haDatiStudioPerSopralluogo(null)).toBe(false)
    expect(haDatiStudioPerSopralluogo(snapshotBase())).toBe(true)
  })

  it('CAMPI_GEOMETRIA_STUDIO copre le chiavi del prefill', () => {
    const chiavi = Object.keys(risposteDaStudioTetto(snapshotBase()))
    const ammessi = new Set<string>(CAMPI_GEOMETRIA_STUDIO)
    expect(chiavi.every((k) => ammessi.has(k))).toBe(true)
  })
})
