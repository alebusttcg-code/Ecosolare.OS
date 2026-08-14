import { describe, expect, it } from 'vitest'
import { posizioneSolare, irraggiamentoExtraterrestre } from './posizione-solare'
import {
  cosAngoloIncidenza,
  trasponiHayDavies,
  type IngressoTrasposizione,
} from './trasposizione'

const RAD = Math.PI / 180

/** Ingresso coerente: GHI = DNI·cosZ + DHI, com'è (a meno di misura) nei dati reali. */
function ingresso(
  over: Partial<IngressoTrasposizione> & {
    zenitDeg: number
    dni: number
    dhi: number
  },
): IngressoTrasposizione {
  const cosZ = Math.cos(over.zenitDeg * RAD)
  return {
    ghi: over.dni * Math.max(0, cosZ) + over.dhi,
    e0: 1361,
    azimutSoleDeg: 180,
    tiltDeg: 0,
    azimutModuloDeg: 180,
    ...over,
  }
}

describe('angolo di incidenza', () => {
  it('sole allineato alla normale del modulo → cos 1', () => {
    // Modulo inclinato 30° verso sud, sole a zenit 30° esattamente a sud.
    expect(cosAngoloIncidenza(30, 180, 30, 180)).toBeCloseTo(1, 6)
  })

  it('sole dietro il pannello → 0, mai negativo', () => {
    // Modulo verticale a sud, sole a nord.
    expect(cosAngoloIncidenza(45, 0, 90, 180)).toBe(0)
  })
})

describe('trasposizione Hay-Davies', () => {
  it('a inclinazione 0° il POA coincide col GHI', () => {
    const inp = ingresso({ zenitDeg: 40, dni: 700, dhi: 150, tiltDeg: 0 })
    const r = trasponiHayDavies(inp)
    expect(r.poa).toBeCloseTo(inp.ghi, 4)
  })

  it('d’inverno una falda a sud inclinata rende più dell’orizzontale', () => {
    // Sole basso (zenit 65°) a sud: inclinare verso sud avvicina il piano al sole.
    const base = { zenitDeg: 65, dni: 600, dhi: 120, azimutSoleDeg: 180 }
    const orizz = trasponiHayDavies(ingresso({ ...base, tiltDeg: 0 }))
    const inclinata = trasponiHayDavies(
      ingresso({ ...base, tiltDeg: 35, azimutModuloDeg: 180 }),
    )
    expect(inclinata.poa).toBeGreaterThan(orizz.poa)
  })

  it('una falda a nord rende meno di una a sud', () => {
    const base = { zenitDeg: 45, dni: 700, dhi: 150, tiltDeg: 30, azimutSoleDeg: 180 }
    const sud = trasponiHayDavies(ingresso({ ...base, azimutModuloDeg: 180 }))
    const nord = trasponiHayDavies(ingresso({ ...base, azimutModuloDeg: 0 }))
    expect(sud.poa).toBeGreaterThan(nord.poa)
  })

  it('col sole sotto l’orizzonte niente diretto, solo diffuso/riflesso', () => {
    const r = trasponiHayDavies(
      ingresso({ zenitDeg: 95, dni: 0, dhi: 20, tiltDeg: 30 }),
    )
    expect(r.poaDiretto).toBe(0)
    expect(r.poa).toBeGreaterThanOrEqual(0)
  })

  it('caso reale coerente: mezzogiorno estivo su falda quasi piana a sud', () => {
    const giorno = 172
    const pos = posizioneSolare(44.11, 9.96, giorno, 11.3) // ~mezzogiorno solare
    const r = trasponiHayDavies({
      ghi: 850,
      dni: 800,
      dhi: 110,
      e0: irraggiamentoExtraterrestre(giorno),
      zenitDeg: pos.zenitDeg,
      azimutSoleDeg: pos.azimutDeg,
      tiltDeg: 8,
      azimutModuloDeg: 180,
    })
    // Su un tetto quasi piano a mezzogiorno d'estate il POA è vicino al GHI,
    // di poco sopra (l'inclinazione a sud aiuta il diretto).
    expect(r.poa).toBeGreaterThan(830)
    expect(r.poa).toBeLessThan(1000)
  })
})
