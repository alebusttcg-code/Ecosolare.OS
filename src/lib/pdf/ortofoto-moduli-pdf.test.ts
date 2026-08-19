import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import { geoAPixel } from '@/lib/solar'
import { fotoTettoPng } from '@/lib/solar/foto-tetto'
import {
  arricchisciPlanimetriaConOrtofoto,
  centroDaPunti,
  inquadraturaDaStudio,
  ORTOFOTO_PIXEL_H,
  ORTOFOTO_PIXEL_W,
  ORTOFOTO_SCALE,
  puntiStudioPerOrtofoto,
  zoomCheContienePunti,
} from './ortofoto-moduli-pdf'
import type { PlanimetriaPdfDto } from './dati-preventivo'

// La foto aerea arriva da Google Solar (GeoTIFF ricampionato → PNG). Qui la si
// mocka: il test verifica l'integrazione nell'ortofoto, non la rete/geotiff.
vi.mock('@/lib/solar/foto-tetto', () => ({ fotoTettoPng: vi.fn() }))
const fotoMock = vi.mocked(fotoTettoPng)

const PNG_FINTO = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(40).fill(0),
])

function snapshotMini(): SnapshotStudioTetto {
  const modulo = (lat: number, lng: number) => ({
    angoli: [
      { latitude: lat, longitude: lng },
      { latitude: lat, longitude: lng + 0.00008 },
      { latitude: lat + 0.00008, longitude: lng + 0.00008 },
      { latitude: lat + 0.00008, longitude: lng },
    ] as const,
    centro: { latitude: lat + 0.00004, longitude: lng + 0.00004 },
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
      ],
    },
    poligoni: {
      '0': [
        { latitude: 45.0999, longitude: 9.1999 },
        { latitude: 45.0999, longitude: 9.2003 },
        { latitude: 45.1003, longitude: 9.2003 },
        { latitude: 45.1003, longitude: 9.1999 },
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
        moduli: [modulo(45.10005, 9.20005), modulo(45.10005, 9.20015)],
      },
    ],
    consumoAnnuoKwh: 8000,
    produzioneAnnuakWh: 4000,
    tariffaImportEurKwh: 0.3,
    tariffaExportEurKwh: 0.1,
  }
}

const schemaBase = (): PlanimetriaPdfDto => ({
  viewBox: '0 0 10 10',
  poligoniPaths: ['M 0 0 L 1 0 L 1 1 Z'],
  moduliPaths: ['M 0.2 0.2 L 0.4 0.2 L 0.4 0.4 Z'],
  legenda: '2 moduli · 1 kWp · 1 falda (F1:2)',
  fotoDataUri: null,
})

describe('ortofoto moduli PDF', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fotoMock.mockReset()
  })

  it('calcola centro e zoom che contiene i punti nel frame', () => {
    const snap = snapshotMini()
    const punti = puntiStudioPerOrtofoto(snap)
    expect(punti.length).toBeGreaterThan(3)
    const centro = centroDaPunti(punti)!
    const zoom = zoomCheContienePunti(punti, centro)
    expect(zoom).toBeGreaterThanOrEqual(15)
    expect(zoom).toBeLessThanOrEqual(21)

    const mx = ORTOFOTO_PIXEL_W * 0.045
    const my = ORTOFOTO_PIXEL_H * 0.045
    for (const p of punti) {
      const { x, y } = geoAPixel(
        p,
        centro,
        zoom,
        ORTOFOTO_SCALE,
        ORTOFOTO_PIXEL_W,
        ORTOFOTO_PIXEL_H,
      )
      expect(x).toBeGreaterThanOrEqual(mx)
      expect(x).toBeLessThanOrEqual(ORTOFOTO_PIXEL_W - mx)
      expect(y).toBeGreaterThanOrEqual(my)
      expect(y).toBeLessThanOrEqual(ORTOFOTO_PIXEL_H - my)
    }
  })

  it('inquadraturaDaStudio espone le dimensioni pixel del frame', () => {
    const iq = inquadraturaDaStudio(snapshotMini())
    expect(iq).not.toBeNull()
    expect(iq!.pixelW).toBe(1280)
    expect(iq!.pixelH).toBe(1280)
    expect(iq!.scale).toBe(2)
  })

  it('senza API key lascia lo schema (foto null)', async () => {
    const base = schemaBase()
    const out = await arricchisciPlanimetriaConOrtofoto(base, snapshotMini(), null)
    expect(out).toEqual(base)
    expect(out.fotoDataUri).toBeNull()
    expect(fotoMock).not.toHaveBeenCalled()
  })

  it('se la foto Solar non c’è lascia lo schema', async () => {
    fotoMock.mockResolvedValue(null)
    const base = schemaBase()
    const out = await arricchisciPlanimetriaConOrtofoto(base, snapshotMini(), 'fake-key')
    expect(out.fotoDataUri).toBeNull()
    expect(out.viewBox).toBe(base.viewBox)
  })

  it('con la foto Solar produce foto e path in pixel', async () => {
    fotoMock.mockResolvedValue(PNG_FINTO)
    const base = schemaBase()
    const out = await arricchisciPlanimetriaConOrtofoto(base, snapshotMini(), 'fake-key')
    expect(out.fotoDataUri).toMatch(/^data:image\/png;base64,/)
    expect(out.fotoSenzaModuliDataUri).toMatch(/^data:image\/png;base64,/)
    expect(out.fotoConModuliIntegrati).toBe(false)
    expect(out.fotoPixelW).toBe(1280)
    expect(out.fotoPixelH).toBe(1280)
    expect(out.viewBox).toBe('0 0 1280 1280')
    expect(out.moduliPaths.length).toBe(2)
    expect(out.poligoniPaths.length).toBe(1)
    expect(out.moduliPaths[0]).toMatch(/^M /)
  })

  it('preserva la cattura editor con pannelli e aggiunge l’ortofoto pulita', async () => {
    fotoMock.mockResolvedValue(PNG_FINTO)
    const fotoEditor = 'data:image/jpeg;base64,/9j/4AAQ'
    const out = await arricchisciPlanimetriaConOrtofoto(
      {
        ...schemaBase(),
        fotoDataUri: fotoEditor,
        fotoConModuliIntegrati: true,
      },
      snapshotMini(),
      'fake-key',
    )

    expect(out.fotoDataUri).toBe(fotoEditor)
    expect(out.fotoSenzaModuliDataUri).toMatch(/^data:image\/png;base64,/)
    expect(out.fotoConModuliIntegrati).toBe(true)
  })
})
