import { describe, expect, it } from 'vitest'
import type { RisultatoSimulazioneFv } from '@/lib/domain/simulazione-fv'
import { mappaSimulazionePerPdf } from './mappa-simulazione-pdf'

describe('mappaSimulazionePerPdf — etichette falda', () => {
  it('usa l’indice Solar (non la posizione in array)', () => {
    const sim = {
      moduli: 4,
      kWp: 2,
      wattPicco: 500,
      produzioneKwh: 3000,
      consumoKwh: 4000,
      resaSpecificaKwhKwp: 1500,
      tariffaImportEurKwh: 0.3,
      tariffaExportEurKwh: 0.1,
      frazioneAutoconsumoUsata: 0.4,
      falde: [
        {
          indice: 2,
          pitchDegrees: 20,
          azimuthDegrees: 180,
          areaMeters2: 30,
          moduli: 4,
          kWp: 2,
        },
      ],
      bilancio: {
        produzioneKwh: 3000,
        consumoKwh: 4000,
        autoconsumoKwh: 1200,
        exportKwh: 1800,
        daReteKwh: 2800,
        frazioneAutoconsumoEffettiva: 0.4,
      },
      detrazione: {
        detrazionePct: 50,
        anniRate: 10,
        detrazioneTotaleCents: 500_000,
        prezzoNettoIndicativoCents: 500_000,
        rataAnnuaCents: 50_000,
      },
      economia: {
        bollettaAttualeAnnuacents: 120_000,
        bollettaConFvAnnuacents: 60_000,
        bollettaAttualeMensileCents: 10_000,
        bollettaConFvMensileCents: 5_000,
        risparmioMensileCents: 5_000,
        risparmioAnnuoAnno1Cents: 60_000,
        paybackAnni: 8,
        npvCents: 100_000,
        cashflow: [],
      },
    } satisfies RisultatoSimulazioneFv

    const pdf = mappaSimulazionePerPdf(sim)
    expect(pdf.dettagliImpianto.falde[0]!.etichetta).toMatch(/^Falda 3 ·/)
    expect(pdf.simulazione.produzioneMensileKwh).toHaveLength(12)
    expect(pdf.simulazione.flussiNum.produzione).toBe(3000)
    expect(pdf.dettagliImpianto.moduli).toBe(4)
  })

  it('esclude falde senza moduli dal PDF cliente', () => {
    const sim = {
      moduli: 4,
      kWp: 2,
      wattPicco: 500,
      produzioneKwh: 3000,
      consumoKwh: 4000,
      resaSpecificaKwhKwp: 1500,
      tariffaImportEurKwh: 0.3,
      tariffaExportEurKwh: 0.1,
      frazioneAutoconsumoUsata: 0.4,
      falde: [
        {
          indice: 0,
          pitchDegrees: 20,
          azimuthDegrees: 180,
          areaMeters2: 30,
          moduli: 4,
          kWp: 2,
        },
        {
          indice: 1,
          pitchDegrees: 15,
          azimuthDegrees: 90,
          areaMeters2: 20,
          moduli: 0,
          kWp: 0,
        },
      ],
      bilancio: {
        produzioneKwh: 3000,
        consumoKwh: 4000,
        autoconsumoKwh: 1200,
        exportKwh: 1800,
        daReteKwh: 2800,
        frazioneAutoconsumoEffettiva: 0.4,
      },
      detrazione: {
        detrazionePct: 50,
        anniRate: 10,
        detrazioneTotaleCents: 500_000,
        prezzoNettoIndicativoCents: 500_000,
        rataAnnuaCents: 50_000,
      },
      economia: {
        bollettaAttualeAnnuacents: 120_000,
        bollettaConFvAnnuacents: 60_000,
        bollettaAttualeMensileCents: 10_000,
        bollettaConFvMensileCents: 5_000,
        risparmioMensileCents: 5_000,
        risparmioAnnuoAnno1Cents: 60_000,
        paybackAnni: 8,
        npvCents: 100_000,
        cashflow: [],
      },
    } satisfies RisultatoSimulazioneFv

    const pdf = mappaSimulazionePerPdf(sim)
    expect(pdf.dettagliImpianto.falde).toHaveLength(1)
    expect(pdf.dettagliImpianto.falde[0]!.etichetta).toContain('Falda 1')
  })
})
