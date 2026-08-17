import { describe, expect, it } from 'vitest'
import {
  faldeDalloSnapshot,
  produzioneFisicaDaStudio,
} from './produzione-studio-fisica'
import { chiaveSito, type ArchivioClimatologia } from '@/lib/solar/clima'
import type { Climatologia } from '@/lib/solar/clima/climatologia'
import type { AnalisiTetto, Coordinate, FaldaTetto } from '@/lib/solar'
import type { LayoutStudioFalda } from './studio-tetto'
import type { RettangoloModulo } from '@/lib/solar'

function falda(
  indice: number,
  pitch: number,
  azimut: number,
  center: Coordinate | null = null,
): FaldaTetto {
  return {
    indice,
    pitchDegrees: pitch,
    azimuthDegrees: azimut,
    areaMeters2: 30,
    groundAreaMeters2: null,
    center,
    boundingBox: null,
    sunshineMedio: null,
    planeHeightAtCenterMeters: null,
  }
}

function analisi(falde: FaldaTetto[], location: Coordinate | null): AnalisiTetto {
  return {
    formattedAddress: 'Via di prova 1',
    // Il tipo dichiara `location` non-nullable, ma il codice la difende con `?.`
    // (Solar può non restituirla): il cast riproduce quel caso reale nel test.
    location: location as Coordinate,
    boundingBox: null,
    imageryQuality: null,
    imageryDate: null,
    maxArrayPanelsCount: null,
    maxSunshineHoursPerYear: null,
    wholeRoofAreaMeters2: null,
    falde,
  }
}

function layout(faldaIndice: number, nModuli = 12, wattPicco = 500): LayoutStudioFalda {
  return {
    faldaIndice,
    formatoId: 'std',
    wattPicco,
    quantitaRichiesta: nModuli,
    landscape: false,
    moduli: Array.from({ length: nModuli }, () => ({}) as unknown as RettangoloModulo),
  }
}

const LOC: Coordinate = { latitude: 44.11, longitude: 9.96 }

describe('mapping falde studio → motore fisico', () => {
  it('unisce inclinazione/esposizione dell’analisi alla potenza dei layout', () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180), falda(1, 30, 90)], LOC),
      layouts: [layout(0, 12), layout(1, 6)],
      layout: null,
      faldeRimosse: [],
    }
    const { falde, lat, lng } = faldeDalloSnapshot(snap)
    expect(falde).toHaveLength(2)
    expect(falde[0]).toEqual({ kWp: 6, tiltDeg: 8, azimutDeg: 180 }) // 12 × 500 W
    expect(falde[1]).toEqual({ kWp: 3, tiltDeg: 30, azimutDeg: 90 }) // 6 × 500 W
    expect(lat).toBe(44.11)
    expect(lng).toBe(9.96)
  })

  it('salta le falde rimosse e i layout senza falda nell’analisi', () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180)], LOC),
      layouts: [layout(0, 12), layout(1, 6), layout(9, 4)],
      layout: null,
      faldeRimosse: [0], // la 0 è rimossa; la 1 e la 9 non sono nell'analisi
    }
    expect(faldeDalloSnapshot(snap).falde).toHaveLength(0)
  })

  it('senza coordinate nell’analisi ripiega sul centro di una falda', () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180, { latitude: 43.5, longitude: 11.2 })], null),
      layouts: [layout(0, 12)],
      layout: null,
      faldeRimosse: [],
    }
    const { lat, lng } = faldeDalloSnapshot(snap)
    expect(lat).toBe(43.5)
    expect(lng).toBe(11.2)
  })
})

function climaDiffusa(): Climatologia {
  const ghi = Array.from({ length: 12 }, () =>
    Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 16 ? 400 : 0)),
  )
  return {
    fonte: 'PVGIS-TMY',
    lat: LOC.latitude,
    lng: LOC.longitude,
    elevazioneM: 10,
    ghiAnnuoKwhM2: 1450,
    ghi,
    dni: Array.from({ length: 12 }, () => new Array<number>(24).fill(0)),
    dhi: ghi.map((r) => [...r]),
    temperatura: Array.from({ length: 12 }, () => new Array<number>(24).fill(15)),
  }
}

function archivioCaldo(): ArchivioClimatologia {
  const dati = new Map<string, Climatologia>()
  dati.set(chiaveSito(LOC.latitude, LOC.longitude), climaDiffusa())
  return {
    leggi: async (k) => dati.get(k) ?? null,
    scrivi: async (k, c) => {
      dati.set(k, c)
    },
  }
}

describe('produzione fisica dallo studio', () => {
  it('stima una produzione positiva dalle falde reali', async () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180)], LOC),
      layouts: [layout(0, 12)],
      layout: null,
      faldeRimosse: [],
    }
    const kwh = await produzioneFisicaDaStudio(snap, { archivio: archivioCaldo() })
    expect(kwh).not.toBeNull()
    expect(kwh!).toBeGreaterThan(0)
  })

  it('senza moduli non inventa nulla: ripiego con null', async () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180)], LOC),
      layouts: [],
      layout: null,
      faldeRimosse: [],
    }
    expect(await produzioneFisicaDaStudio(snap, { archivio: archivioCaldo() })).toBeNull()
  })

  it('senza coordinate ripiega con null invece di indovinare', async () => {
    const snap = {
      analisi: analisi([falda(0, 8, 180)], null), // niente location, niente center
      layouts: [layout(0, 12)],
      layout: null,
      faldeRimosse: [],
    }
    expect(await produzioneFisicaDaStudio(snap, { archivio: archivioCaldo() })).toBeNull()
  })
})
