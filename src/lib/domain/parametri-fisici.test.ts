import { describe, expect, it } from 'vitest'
import {
  assemblaParametriFisici,
  PARAMETRI_FISICI_PREDEFINITI,
  sistemaDaParametri,
} from './parametri-fisici'

describe('assemblaggio dei parametri fisici', () => {
  it('senza configurazione usa i default dichiarati', () => {
    expect(assemblaParametriFisici()).toEqual(PARAMETRI_FISICI_PREDEFINITI)
    expect(assemblaParametriFisici({})).toEqual(PARAMETRI_FISICI_PREDEFINITI)
  })

  it('un valore configurato supera il default, gli altri restano', () => {
    const p = assemblaParametriFisici({ albedo: 0.25, perditaSporcamento: 0.05 })
    expect(p.albedo).toBe(0.25)
    expect(p.perdite.sporcamento).toBe(0.05)
    // Non toccati:
    expect(p.noct).toBe(PARAMETRI_FISICI_PREDEFINITI.noct)
    expect(p.perdite.mismatch).toBe(PARAMETRI_FISICI_PREDEFINITI.perdite.mismatch)
  })

  it('accetta i formati che arrivano da app_settings (stringa, virgola, {valore})', () => {
    expect(assemblaParametriFisici({ albedo: '0,3' }).albedo).toBe(0.3)
    expect(assemblaParametriFisici({ noct: '48' }).noct).toBe(48)
    expect(
      assemblaParametriFisici({ efficienzaInverter: { valore: 0.98 } }).efficienzaInverter,
    ).toBe(0.98)
  })

  it('un valore assente o non numerico ripiega sul default, non rompe', () => {
    expect(assemblaParametriFisici({ albedo: undefined }).albedo).toBe(
      PARAMETRI_FISICI_PREDEFINITI.albedo,
    )
    expect(assemblaParametriFisici({ noct: 'non-un-numero' }).noct).toBe(
      PARAMETRI_FISICI_PREDEFINITI.noct,
    )
    expect(assemblaParametriFisici({ coeffTemperatura: Number.NaN }).coeffTemperatura).toBe(
      PARAMETRI_FISICI_PREDEFINITI.coeffTemperatura,
    )
  })
})

describe('costruzione del sistema dal preventivo', () => {
  it('unisce la potenza CA dell’impianto ai parametri di flotta', () => {
    const sistema = sistemaDaParametri(5, PARAMETRI_FISICI_PREDEFINITI)
    expect(sistema.potenzaAcMaxKw).toBe(5)
    expect(sistema.guadagnoBifaccialePct).toBe(PARAMETRI_FISICI_PREDEFINITI.guadagnoBifaccialePct)
    expect(sistema.perdite).toEqual(PARAMETRI_FISICI_PREDEFINITI.perdite)
    expect(sistema.albedo).toBe(PARAMETRI_FISICI_PREDEFINITI.albedo)
  })
})
