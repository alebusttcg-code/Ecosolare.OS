import { describe, expect, it } from 'vitest'
import { bilanciaEnergia } from './bilancio-energia'
import {
  bollettaConFvAnnuacents,
  calcolaEconomiaFv,
  costoEnergiaCents,
} from './economia-fv'
import { calcolaDetrazioneIrpef } from './incentivi'
import { simulaImpiantoFv, type ParametriSimulazioneFv } from './simulazione-fv'
import type { SnapshotStudioTetto } from './studio-tetto'

/** Parametri allineati ai dossier commerciali di riferimento (solo nei test). */
const PARAMETRI_TEST: ParametriSimulazioneFv = {
  detrazionePct: 50,
  detrazioneAnni: 10,
  orizzonteAnni: 25,
  inflazioneEnergiaPct: 3,
  tassoScontoPct: 5,
  degradazioneProduzionePctAnno: 0.5,
  frazioneAutoconsumoDefault: 0.4,
}

function snapshotCliente(
  override: Partial<SnapshotStudioTetto> &
    Pick<
      SnapshotStudioTetto,
      'consumoAnnuoKwh' | 'produzioneAnnuakWh' | 'frazioneAutoconsumo'
    >,
): SnapshotStudioTetto {
  return {
    analisi: {
      formattedAddress: 'Via Test 1',
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
          pitchDegrees: 4,
          azimuthDegrees: 174,
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
    layouts: [
      {
        faldaIndice: 0,
        formatoId: 'mod-500',
        wattPicco: 500,
        quantitaRichiesta: 12,
        landscape: true,
        moduli: Array.from({ length: 12 }, () => ({
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
    tariffaImportEurKwh: 0.3,
    tariffaExportEurKwh: 0.1,
    ...override,
  }
}

describe('bilancio energia — conservazione', () => {
  it('riproduce i flussi Riboldi (Designer)', () => {
    // 8066 prod, 8000 cons, autoconsumo 3292 → export 4774, rete 4708
    const b = bilanciaEnergia({
      produzioneKwh: 8066,
      consumoKwh: 8000,
      frazioneAutoconsumo: 3292 / 8066,
    })
    expect(b.autoconsumoKwh).toBe(3292)
    expect(b.exportKwh).toBe(4774)
    expect(b.daReteKwh).toBe(4708)
    expect(b.autoconsumoKwh + b.exportKwh).toBe(b.produzioneKwh)
    expect(b.autoconsumoKwh + b.daReteKwh).toBe(b.consumoKwh)
  })

  it('con consumo 0 esporta tutta la produzione (impianto aggiuntivo)', () => {
    const b = bilanciaEnergia({
      produzioneKwh: 5235,
      consumoKwh: 0,
      frazioneAutoconsumo: 0.4,
    })
    expect(b.autoconsumoKwh).toBe(0)
    expect(b.exportKwh).toBe(5235)
    expect(b.daReteKwh).toBe(0)
  })
})

describe('economia FV — bollette da situazione cliente', () => {
  it('Riboldi: bolletta attuale 200 €/mese e risparmio coerente', () => {
    const bilancio = bilanciaEnergia({
      produzioneKwh: 8066,
      consumoKwh: 8000,
      frazioneAutoconsumo: 3292 / 8066,
    })
    expect(costoEnergiaCents(8000, 0.3)).toBe(240_000)
    expect(dividiMensile(240_000)).toBe(20_000) // € 200,00

    const conFv = bollettaConFvAnnuacents(bilancio, 0.3, 0.1)
    expect(conFv).toBe(93_500) // (4708×0,30 − 4774×0,10) €
    expect(dividiMensile(conFv)).toBe(7792) // € 77,92

    const detrazione = calcolaDetrazioneIrpef({
      prezzoLordoCents: 1_180_000,
      detrazionePct: 50,
      anniRate: 10,
    })
    expect(detrazione.detrazioneTotaleCents).toBe(590_000)

    const eco = calcolaEconomiaFv({
      bilancio,
      tariffaImportEurKwh: 0.3,
      tariffaExportEurKwh: 0.1,
      investimentoLordoCents: 1_180_000,
      detrazione,
      orizzonteAnni: 25,
      inflazioneEnergiaPct: 3,
      tassoScontoPct: 5,
      degradazioneProduzionePctAnno: 0.5,
    })
    expect(eco.bollettaAttualeMensileCents).toBe(20_000)
    expect(eco.bollettaConFvMensileCents).toBe(7792)
    expect(eco.risparmioMensileCents).toBe(12_208) // € 122,08
    expect(eco.risparmioAnnuoAnno1Cents).toBe(146_500)
    expect(eco.paybackAnni).not.toBeNull()
    expect(eco.cashflow).toHaveLength(25)
  })

  it('Ricci: consumo diverso → bolletta diversa (162,50 €/mese)', () => {
    expect(dividiMensile(costoEnergiaCents(6500, 0.3))).toBe(16_250)
  })

  it('stesso impianto, consumi diversi → risultati diversi', () => {
    const a = simulaImpiantoFv({
      snapshot: snapshotCliente({
        consumoAnnuoKwh: 8000,
        produzioneAnnuakWh: 8066,
        frazioneAutoconsumo: 3292 / 8066,
      }),
      investimentoLordoCents: 1_180_000,
      parametri: PARAMETRI_TEST,
    })
    const b = simulaImpiantoFv({
      snapshot: snapshotCliente({
        consumoAnnuoKwh: 6500,
        produzioneAnnuakWh: 7960,
        frazioneAutoconsumo: 0.4,
        analisi: {
          formattedAddress: 'Via Ricci',
          location: { latitude: 45, longitude: 9 },
          boundingBox: null,
          imageryQuality: null,
          imageryDate: null,
          maxArrayPanelsCount: null,
          maxSunshineHoursPerYear: null,
          wholeRoofAreaMeters2: null,
          falde: [
            {
              indice: 0,
              pitchDegrees: 8,
              azimuthDegrees: 203,
              areaMeters2: 35,
              groundAreaMeters2: 34,
              center: null,
              boundingBox: null,
              sunshineMedio: null,
              planeHeightAtCenterMeters: null,
            },
          ],
        },
      }),
      investimentoLordoCents: 1_180_000,
      parametri: PARAMETRI_TEST,
    })
    expect(a.economia.bollettaAttualeMensileCents).not.toBe(
      b.economia.bollettaAttualeMensileCents,
    )
    expect(a.bilancio.daReteKwh).not.toBe(b.bilancio.daReteKwh)
    expect(a.kWp).toBe(6)
    expect(b.kWp).toBe(6)
  })

  it('Tarantola: detrazione 50% su 10.000 € e consumo 0', () => {
    const detrazione = calcolaDetrazioneIrpef({
      prezzoLordoCents: 1_000_000,
      detrazionePct: 50,
      anniRate: 10,
    })
    expect(detrazione.detrazioneTotaleCents).toBe(500_000)

    const sim = simulaImpiantoFv({
      snapshot: snapshotCliente({
        consumoAnnuoKwh: 0,
        produzioneAnnuakWh: 5235,
        frazioneAutoconsumo: 0.4,
        layouts: [
          {
            faldaIndice: 0,
            formatoId: 'mod-500',
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
      }),
      investimentoLordoCents: 1_000_000,
      parametri: PARAMETRI_TEST,
    })
    expect(sim.kWp).toBe(4)
    expect(sim.bilancio.exportKwh).toBe(5235)
    expect(sim.economia.bollettaAttualeMensileCents).toBe(0)
    // Solo ricavo RID: credito mensile
    expect(sim.economia.bollettaConFvMensileCents).toBeLessThan(0)
    expect(sim.detrazione.detrazioneTotaleCents).toBe(500_000)
  })
})

function dividiMensile(annuoCents: number): number {
  return Math.round(annuoCents / 12)
}
