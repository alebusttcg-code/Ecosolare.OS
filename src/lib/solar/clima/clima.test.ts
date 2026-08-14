import { describe, expect, it, vi } from 'vitest'
import { chiaveSito, getClimatologia, type ArchivioClimatologia } from './index'
import type { Climatologia } from './climatologia'

/** Archivio in memoria: la logica di cache si prova senza database. */
function archivioFinto(): ArchivioClimatologia & { dati: Map<string, Climatologia> } {
  const dati = new Map<string, Climatologia>()
  return {
    dati,
    leggi: async (k) => dati.get(k) ?? null,
    scrivi: async (k, c) => {
      dati.set(k, c)
    },
  }
}

/** Una risposta PVGIS finta ma valida (8.760 righe, come pretende lo schema). */
function rispostaPvgisFinta(): Response {
  const tmy_hourly = Array.from({ length: 8760 }, () => ({
    'time(UTC)': '20080115:1200',
    'T2m': 15,
    'G(h)': 500,
    'Gb(n)': 300,
    'Gd(h)': 200,
  }))
  const corpo = {
    inputs: { location: { latitude: 44.11, longitude: 9.96, elevation: 16 } },
    outputs: { tmy_hourly },
  }
  return { ok: true, json: async () => corpo } as unknown as Response
}

describe('chiave di cache per sito', () => {
  it('arrotonda alla griglia ~1 km, forma stabile', () => {
    expect(chiaveSito(44.114, 9.963)).toBe('44.11,9.96')
    expect(chiaveSito(44.116, 9.966)).toBe('44.12,9.97')
  })

  it('case vicine cadono sulla stessa chiave (una sola chiamata)', () => {
    // ~200 m di distanza: stessa climatologia, stesso dato pagato una volta.
    expect(chiaveSito(44.1101, 9.9601)).toBe(chiaveSito(44.1099, 9.9599))
  })
})

describe('getClimatologia: scarica una volta, poi possiede', () => {
  it('alla prima richiesta scarica, riduce e salva', async () => {
    const archivio = archivioFinto()
    const fetchImpl = vi.fn(async () => rispostaPvgisFinta())

    const c = await getClimatologia(44.11, 9.96, { archivio, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(c.fonte).toBe('PVGIS-TMY')
    expect(archivio.dati.has('44.11,9.96')).toBe(true)
  })

  it('alla seconda richiesta non tocca la rete: risponde dalla cache', async () => {
    const archivio = archivioFinto()
    const fetchImpl = vi.fn(async () => rispostaPvgisFinta())

    await getClimatologia(44.11, 9.96, { archivio, fetchImpl })
    // Una casa a 150 m: stessa chiave, nessuna nuova chiamata.
    await getClimatologia(44.1112, 9.9612, { archivio, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('con la cache calda non chiama mai la rete', async () => {
    const archivio = archivioFinto()
    const preesistente = {
      fonte: 'PVGIS-TMY' as const,
      lat: 44.11,
      lng: 9.96,
      elevazioneM: 16,
      ghiAnnuoKwhM2: 1469,
      ghi: [],
      dni: [],
      dhi: [],
      temperatura: [],
    }
    await archivio.scrivi('44.11,9.96', preesistente as unknown as Climatologia)
    // Un fetch che esplode se chiamato: la prova che l'autonomia a runtime tiene.
    const fetchImpl = vi.fn(async () => {
      throw new Error('la rete non deve essere toccata')
    })

    const c = await getClimatologia(44.11, 9.96, { archivio, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(c.ghiAnnuoKwhM2).toBe(1469)
  })
})
