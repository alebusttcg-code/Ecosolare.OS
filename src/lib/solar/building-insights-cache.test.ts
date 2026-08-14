import { describe, expect, it, vi } from 'vitest'
import {
  buildingInsightsConCache,
  chiaveEdificio,
  type ArchivioBuildingInsights,
  type DatiTetto,
} from './building-insights-cache'
import type { EsitoBuildingInsights } from './building-insights'

function datiFinti(sunshine = 1400): DatiTetto {
  return {
    location: { latitude: 44.11, longitude: 9.96 },
    boundingBox: null,
    imageryQuality: null,
    imageryDate: null,
    maxArrayPanelsCount: null,
    maxSunshineHoursPerYear: sunshine,
    wholeRoofAreaMeters2: null,
    falde: [],
  }
}

function archivioFinto(): ArchivioBuildingInsights & { dati: Map<string, DatiTetto> } {
  const dati = new Map<string, DatiTetto>()
  return {
    dati,
    leggi: async (k) => dati.get(k) ?? null,
    scrivi: async (k, d) => {
      dati.set(k, d)
    },
  }
}

const LOC = { latitude: 44.11031, longitude: 9.96119 }

describe('chiave edificio', () => {
  it('arrotonda alla griglia ~11 m', () => {
    expect(chiaveEdificio(44.11031, 9.96119)).toBe('44.1103,9.9612')
    expect(chiaveEdificio(44.11034, 9.96122)).toBe('44.1103,9.9612') // stessa cella
    expect(chiaveEdificio(44.115, 9.965)).not.toBe('44.1103,9.9612') // edificio diverso
  })
})

describe('buildingInsights con cache', () => {
  it('alla prima richiesta cerca (a pagamento) e salva', async () => {
    const archivio = archivioFinto()
    const cerca = vi.fn(
      async (): Promise<EsitoBuildingInsights> => ({ ok: true, dati: datiFinti(1325) }),
    )

    const esito = await buildingInsightsConCache(LOC, { archivio, cerca })

    expect(cerca).toHaveBeenCalledTimes(1)
    expect(esito.ok && esito.dati.maxSunshineHoursPerYear).toBe(1325)
    expect(archivio.dati.has('44.1103,9.9612')).toBe(true)
  })

  it('alla seconda richiesta non paga: risponde dalla cache', async () => {
    const archivio = archivioFinto()
    const cerca = vi.fn(
      async (): Promise<EsitoBuildingInsights> => ({ ok: true, dati: datiFinti() }),
    )

    await buildingInsightsConCache(LOC, { archivio, cerca })
    // Stesso tetto, click a pochi metri: stessa cella, nessuna nuova ricerca.
    await buildingInsightsConCache(
      { latitude: 44.11034, longitude: 9.96122 },
      { archivio, cerca },
    )

    expect(cerca).toHaveBeenCalledTimes(1)
  })

  it('un fallimento non si mette in cache: resta transitorio', async () => {
    const archivio = archivioFinto()
    const cerca = vi.fn(
      async (): Promise<EsitoBuildingInsights> => ({
        ok: false,
        errore: { codice: 'edificio_non_trovato', messaggio: 'non trovato' },
      }),
    )

    const esito = await buildingInsightsConCache(LOC, { archivio, cerca })

    expect(esito.ok).toBe(false)
    expect(archivio.dati.size).toBe(0) // niente da ripescare al prossimo giro
  })

  it('se la scrittura in cache fallisce, il risultato torna lo stesso', async () => {
    const archivio: ArchivioBuildingInsights = {
      leggi: async () => null,
      scrivi: async () => {
        throw new Error('cache giù')
      },
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cerca = async (): Promise<EsitoBuildingInsights> => ({ ok: true, dati: datiFinti(1200) })

    const esito = await buildingInsightsConCache(LOC, { archivio, cerca })
    expect(esito.ok && esito.dati.maxSunshineHoursPerYear).toBe(1200)
  })
})
