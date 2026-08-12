import { describe, expect, it } from 'vitest'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import { planimetriaDaStudio } from './planimetria-moduli'

function snapshotDueFalde(): SnapshotStudioTetto {
  const modulo = (lat: number, lng: number) => ({
    angoli: [
      { latitude: lat, longitude: lng },
      { latitude: lat, longitude: lng + 0.0001 },
      { latitude: lat + 0.0001, longitude: lng + 0.0001 },
      { latitude: lat + 0.0001, longitude: lng },
    ] as const,
    centro: { latitude: lat + 0.00005, longitude: lng + 0.00005 },
    rotazioneDegrees: 0,
  })

  return {
    analisi: {
      formattedAddress: 'Test',
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
          sunshineMedio: null,
          planeHeightAtCenterMeters: null,
        },
        {
          indice: 1,
          pitchDegrees: 15,
          azimuthDegrees: 90,
          areaMeters2: 20,
          groundAreaMeters2: 19,
          center: { latitude: 45.1005, longitude: 9.2005 },
          boundingBox: null,
          sunshineMedio: null,
          planeHeightAtCenterMeters: null,
        },
      ],
    },
    poligoni: {
      '0': [
        { latitude: 45.1, longitude: 9.2 },
        { latitude: 45.1, longitude: 9.2002 },
        { latitude: 45.1002, longitude: 9.2002 },
        { latitude: 45.1002, longitude: 9.2 },
      ],
      '1': [
        { latitude: 45.1004, longitude: 9.2004 },
        { latitude: 45.1004, longitude: 9.2006 },
        { latitude: 45.1006, longitude: 9.2006 },
        { latitude: 45.1006, longitude: 9.2004 },
      ],
    },
    faldeRimosse: [],
    layouts: [
      {
        faldaIndice: 0,
        formatoId: 'm',
        wattPicco: 500,
        quantitaRichiesta: 2,
        landscape: true,
        moduli: [modulo(45.10005, 9.20005), modulo(45.10005, 9.20012)],
      },
      {
        faldaIndice: 1,
        formatoId: 'm',
        wattPicco: 500,
        quantitaRichiesta: 1,
        landscape: true,
        moduli: [modulo(45.10045, 9.20045)],
      },
    ],
    consumoAnnuoKwh: 8000,
    produzioneAnnuakWh: 4000,
    tariffaImportEurKwh: 0.3,
    tariffaExportEurKwh: 0.1,
  }
}

describe('planimetria multi-falda', () => {
  it('include poligoni e moduli di tutte le falde attive', () => {
    const p = planimetriaDaStudio(snapshotDueFalde())
    expect(p).not.toBeNull()
    expect(p!.poligoniPaths).toHaveLength(2)
    expect(p!.moduliPaths).toHaveLength(3)
    expect(p!.legenda).toContain('F1:2')
    expect(p!.legenda).toContain('F2:1')
    expect(p!.viewBox.split(' ')).toHaveLength(4)
    expect(p!.fotoDataUri).toBeNull()
  })

  it('esclude falde rimosse', () => {
    const base = snapshotDueFalde()
    const p = planimetriaDaStudio({ ...base, faldeRimosse: [1] })
    expect(p).not.toBeNull()
    expect(p!.moduliPaths).toHaveLength(2)
    expect(p!.legenda).toContain('F1:2')
    expect(p!.legenda).not.toContain('F2:')
    expect(p!.fotoDataUri).toBeNull()
  })

  it('preferisce l’anteprima Moduli senza overlay SVG', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQ'
    const p = planimetriaDaStudio({
      ...snapshotDueFalde(),
      anteprimaModuliDataUri: jpeg,
      anteprimaTettoDataUri: 'data:image/jpeg;base64,clean',
    })
    expect(p).not.toBeNull()
    expect(p!.fotoDataUri).toBe(jpeg)
    expect(p!.fotoSenzaModuliDataUri).toBe('data:image/jpeg;base64,clean')
    expect(p!.fotoConModuliIntegrati).toBe(true)
    expect(p!.moduliPaths).toHaveLength(0)
    expect(p!.poligoniPaths).toHaveLength(0)
    expect(p!.legenda).toContain('moduli')
  })
})
